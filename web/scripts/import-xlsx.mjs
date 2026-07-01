// scripts/import-xlsx.mjs
//
// One-shot migration: reads Teacher Registration Form (Responses).xlsx and
// inserts every applicant into Supabase.
//
// Run locally (NEVER deploy this — service role key):
//   cd web
//   npm install
//   cp .env.example .env.local && fill in keys
//   npm run import:xlsx
//
// Idempotency: re-running will skip rows that already exist (matched by `code`).
// To force re-import, run with --force (still skips duplicates on `code` if present).

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import path from 'node:path';

const SUPABASE_URL      = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Normalizers ────────────────────────────────────────────────────────────

function asString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString();
  return String(v).trim() || null;
}

function asInt(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  const s = String(v).trim();
  // Strip ".0" suffix from Excel float-encoded integers
  if (/^\d+\.0$/.test(s)) return parseInt(s, 10);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function asNumeric(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (s === '#DIV/0!' || s === '#REF!' || s === '#N/A' || s === '#VALUE!') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function asDate(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // Excel serial date (days since 1900-01-01). Convert manually.
    if (!Number.isFinite(v) || v < 1 || v > 100000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function asTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString();
  }
  return asDate(v); // fallback
}

function asArray(v) {
  const s = asString(v);
  if (!s) return null;
  return s.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
}

function asEnum(v, allowed) {
  const s = asString(v);
  if (!s) return null;
  // Status normalisations: strip emoji, trim
  const cleaned = s.replace(/[^\w\s]/g, '').trim();
  for (const a of allowed) {
    if (a.toLowerCase() === cleaned.toLowerCase()) return a;
  }
  return null;
}

// ─── Column mapping (1-indexed, matches openpyxl output earlier) ────────────

const COL = {
  timestamp: 1, code: 2, add: 3, full_name: 4, status: 5,
  photo: 6, gender: 7, dob: 8, broadcast: 9, marital: 10,
  subject: 11, qualification: 12, university: 13,
  offline_exp: 14, online_exp: 15, preferred_time: 16,
  gadgets: 17, connectivity: 18, foreign_ready: 19,
  languages: 20, ms_office: 21, contact: 22, alt_contact: 23,
  whatsapp: 24, email: 25, address: 26, future_pref: 27,
  skills: 28, father_name: 29, father_occ: 30, father_contact: 31,
  mother_name: 32, mother_occ: 33, mother_contact: 34,
  bank_account: 35, bank_ifsc: 36, bank_branch: 37, bank_holder: 38,
  id_proof: 39, declaration: 40, preferred_syllabus: 41,
  demo_attend: 42, demo_convert: 43, rating: 44, youtube_link: 45,
  section_apt: 46, subject_apt: 47, medium_apt: 48, remark: 49,
  interviewer: 50
};

const STATUSES = ['New', 'In Review', 'Active', 'Stopped', 'On Hold'];

function mapRow(raw) {
  // raw is an array indexed from 0; helpers expect 1-indexed access pattern,
  // so we shift by passing raw[i-1] below.
  const pick = (col) => raw[col - 1];

  const declarationText = asString(pick(COL.declaration));
  const declaration = declarationText && declarationText !== 'I agree and commit to the above declaration.'
    ? declarationText
    : 'I agree and commit to the above declaration.';
  const ts = asTimestamp(pick(COL.timestamp)) || new Date().toISOString();

  return {
    // Form-fed fields: blank for legacy rows (we don't have the original form data)
    full_name: asString(pick(COL.full_name)) || '(unknown)',
    district: '',
    place: '',
    qualification: asString(pick(COL.qualification)) || '',
    age: 0,
    offline_exp: asString(pick(COL.offline_exp)) || '',
    online_exp: asString(pick(COL.online_exp)) || '',
    subject: asArray(pick(COL.subject)) || [],
    syllabus: 'Sunni', // legacy default — staff can correct later
    medium: '',
    connectivity: asString(pick(COL.connectivity)) || '',
    phone: asString(pick(COL.contact)) || '',
    whatsapp: asString(pick(COL.whatsapp)),
    email: asString(pick(COL.email)) || '',
    gadgets: asArray(pick(COL.gadgets)) || [],

    // Manual enrichment fields
    code: asString(pick(COL.code)),
    status: asEnum(pick(COL.status), STATUSES) || 'New',
    gender: asString(pick(COL.gender)),
    dob: asDate(pick(COL.dob)),
    marital_status: asString(pick(COL.marital)),
    university: asString(pick(COL.university)),
    preferred_time: asString(pick(COL.preferred_time)),
    foreign_ready: asString(pick(COL.foreign_ready)),
    languages: asArray(pick(COL.languages)),
    ms_office: asString(pick(COL.ms_office)),
    alt_number: asString(pick(COL.alt_contact)),
    address: asString(pick(COL.address)),
    future_pref: asString(pick(COL.future_pref)),
    skills: asString(pick(COL.skills)),
    father_name: asString(pick(COL.father_name)),
    father_occ: asString(pick(COL.father_occ)),
    father_contact: asString(pick(COL.father_contact)),
    mother_name: asString(pick(COL.mother_name)),
    mother_occ: asString(pick(COL.mother_occ)),
    mother_contact: asString(pick(COL.mother_contact)),
    bank_account: asString(pick(COL.bank_account)),
    bank_ifsc: asString(pick(COL.bank_ifsc)),
    bank_branch: asString(pick(COL.bank_branch)),
    bank_holder: asString(pick(COL.bank_holder)),
    declaration,
    declaration_at: ts,
    preferred_syllabus: asString(pick(COL.preferred_syllabus)),
    demo_attend: asInt(pick(COL.demo_attend)) ?? 0,
    demo_convert: asInt(pick(COL.demo_convert)) ?? 0,
    rating: asNumeric(pick(COL.rating)),
    youtube_link: asString(pick(COL.youtube_link)),
    section_apt: asString(pick(COL.section_apt)),
    subject_apt: asString(pick(COL.subject_apt)),
    medium_apt: asString(pick(COL.medium_apt)),
    remark: asString(pick(COL.remark)),
    interviewer: asString(pick(COL.interviewer)),

    legacy_drive_url: asString(pick(COL.photo)),
    legacy_sheet_code: asString(pick(COL.code)),

    created_at: ts,
    updated_at: ts
  };
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const fileArg = args.find(a => !a.startsWith('--'));
  const xlsxPath = fileArg
    ? path.resolve(fileArg)
    : path.resolve('../Teacher Registration Form (Responses).xlsx');

  console.log(`Reading ${xlsxPath} …`);
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['Form Responses 1'];
  if (!ws) throw new Error('Sheet "Form Responses 1" not found');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  console.log(`Total rows including header: ${rows.length}`);

  // Skip header row.
  const dataRows = rows.slice(1).filter(r => r && r.length > 0 && r.some(c => c != null && c !== ''));
  console.log(`Non-empty data rows: ${dataRows.length}`);

  // Pull existing codes to dedupe (unless --force and we're re-importing fresh DB).
  let existingCodes = new Set();
  if (!force) {
    const { data, error } = await supabase
      .from('applicants')
      .select('code')
      .not('code', 'is', null);
    if (error) {
      console.error('Failed to fetch existing codes:', error.message);
      process.exit(1);
    }
    existingCodes = new Set((data || []).map(r => r.code).filter(Boolean));
    console.log(`Existing rows with codes: ${existingCodes.size}`);
  }

  let inserted = 0, skipped = 0, failed = 0;
  const BATCH = 200;

  for (let i = 0; i < dataRows.length; i += BATCH) {
    const batch = dataRows.slice(i, i + BATCH);
    const payload = [];
    for (const raw of batch) {
      const row = mapRow(raw);
      if (row.code && existingCodes.has(row.code)) {
        skipped++;
        continue;
      }
      if (!row.full_name || row.full_name === '(unknown)') {
        skipped++;
        continue;
      }
      payload.push(row);
    }
    if (payload.length === 0) {
      console.log(`Batch ${Math.floor(i / BATCH) + 1}: 0 to insert (skipped ${skipped} cumulative)`);
      continue;
    }
    const { data, error } = await supabase
      .from('applicants')
      .insert(payload)
      .select('id');
    if (error) {
      console.error(`Batch starting at row ${i + 2} failed:`, error.message);
      failed += payload.length;
    } else {
      inserted += data.length;
      for (const r of payload) {
        if (r.code) existingCodes.add(r.code);
      }
    }
    console.log(`Batch ${Math.floor(i / BATCH) + 1}: inserted=${inserted} skipped=${skipped} failed=${failed}`);
  }

  console.log('\n=== DONE ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicate / blank): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});