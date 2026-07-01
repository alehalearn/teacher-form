'use client';

import { useState, useTransition } from 'react';
import { patchApplicant } from '../actions';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Applicant } from '@/lib/types';
import {
  STATUS_OPTIONS, GENDERS, MARITAL_OPTIONS, YES_NO
} from '@/lib/constants';

export default function ApplicantEditForm({ applicant }: { applicant: Applicant }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [local, setLocal] = useState<Partial<Applicant>>(applicant);

  function update<K extends keyof Applicant>(key: K, value: Applicant[K]) {
    setLocal(prev => ({ ...prev, [key]: value }));
  }

  function isDirty(): boolean {
    for (const k of Object.keys(local) as (keyof Applicant)[]) {
      if (JSON.stringify(local[k]) !== JSON.stringify(applicant[k])) return true;
    }
    return false;
  }

  async function uploadIdProof(file: File) {
    setErrorMsg(null);
    const supabase = getBrowserClient();
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${applicant.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('id-proofs')
      .upload(path, file, { upsert: true });
    if (upErr) {
      setStatus('error');
      setErrorMsg(`ID proof upload failed: ${upErr.message}`);
      return;
    }
    // Save path on the applicant row, which is itself whitelisted.
    startTransition(async () => {
      const res = await patchApplicant({
        id: applicant.id,
        changes: { id_proof_path: path }
      });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(res.error || 'Failed to save ID proof path');
      } else {
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      }
    });
  }

  async function viewIdProof() {
    const supabase = getBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/id-proof/${applicant.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (!res.ok) {
      setStatus('error');
      setErrorMsg('Could not retrieve ID proof link');
      return;
    }
    const { url } = await res.json();
    window.open(url, '_blank', 'noopener');
  }

  function save() {
    setStatus('saving');
    setErrorMsg(null);
    const changes: Record<string, unknown> = {};
    for (const k of Object.keys(local) as (keyof Applicant)[]) {
      if (JSON.stringify(local[k]) !== JSON.stringify(applicant[k])) {
        changes[k as string] = local[k];
      }
    }
    if (Object.keys(changes).length === 0) {
      setStatus('idle');
      return;
    }
    startTransition(async () => {
      const res = await patchApplicant({ id: applicant.id, changes });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(res.error || 'Save failed');
      } else {
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      }
    });
  }

  return (
    <div className="card">
      <h2>Applicant details</h2>
      <p style={{ color: '#6b7280', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Form-fed fields below are read-only. They were captured at submission time and cannot be changed from the admin panel.
      </p>

      {status === 'saved' && <div className="alert alert-success">Saved.</div>}
      {status === 'error' && <div className="alert alert-error">{errorMsg}</div>}

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '16px 0 12px' }}>
        Submitted by applicant (read-only)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ReadOnly label="Full Name" value={applicant.full_name} />
        <ReadOnly label="District" value={applicant.district} />
        <ReadOnly label="Place" value={applicant.place} />
        <ReadOnly label="Qualification" value={applicant.qualification} />
        <ReadOnly label="Age" value={String(applicant.age)} />
        <ReadOnly label="Phone" value={applicant.phone} />
        <ReadOnly label="WhatsApp" value={applicant.whatsapp || '—'} />
        <ReadOnly label="Email" value={applicant.email} />
        <ReadOnly label="Subject" value={(applicant.subject || []).join(', ')} />
        <ReadOnly label="Syllabus" value={applicant.syllabus + (applicant.syllabus_other ? ` (${applicant.syllabus_other})` : '')} />
        <ReadOnly label="Medium" value={applicant.medium} />
        <ReadOnly label="Connectivity" value={applicant.connectivity} />
        <ReadOnly label="Gadgets" value={(applicant.gadgets || []).join(', ')} />
        <ReadOnly label="Offline experience" value={applicant.offline_exp} fullWidth />
        <ReadOnly label="Online experience" value={applicant.online_exp} fullWidth />
      </div>

      {applicant.photo_url && (
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: '#6b7280' }}>Photo</label>
          <div><img src={applicant.photo_url} alt="applicant"
                    style={{ maxWidth: 120, borderRadius: 8, marginTop: 4 }} /></div>
        </div>
      )}

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '24px 0 12px' }}>
        Staff enrichment (editable)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Code">
          <input type="text" value={local.code || ''}
                 onChange={e => update('code', e.target.value)} />
        </Field>
        <Field label="Status">
          <select value={local.status || 'New'}
                  onChange={e => update('status', e.target.value as Applicant['status'])}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Gender">
          <select value={local.gender || ''}
                  onChange={e => update('gender', e.target.value)}>
            <option value="">—</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Date of Birth">
          <input type="date" value={local.dob || ''}
                 onChange={e => update('dob', e.target.value)} />
        </Field>
        <Field label="Marital Status">
          <select value={local.marital_status || ''}
                  onChange={e => update('marital_status', e.target.value)}>
            <option value="">—</option>
            {MARITAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="University & College">
          <input type="text" value={local.university || ''}
                 onChange={e => update('university', e.target.value)} />
        </Field>
        <Field label="Preferred Time">
          <input type="text" value={local.preferred_time || ''}
                 onChange={e => update('preferred_time', e.target.value)} />
        </Field>
        <Field label="Foreign students ready?">
          <select value={local.foreign_ready || ''}
                  onChange={e => update('foreign_ready', e.target.value)}>
            <option value="">—</option>
            {YES_NO.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field label="Languages (comma-separated)">
          <input type="text"
                 value={(local.languages || []).join(', ')}
                 onChange={e => update('languages',
                   e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
        </Field>
        <Field label="MS Office skilled?">
          <select value={local.ms_office || ''}
                  onChange={e => update('ms_office', e.target.value)}>
            <option value="">—</option>
            {YES_NO.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field label="Alt Number">
          <input type="text" value={local.alt_number || ''}
                 onChange={e => update('alt_number', e.target.value)} />
        </Field>
        <Field label="Address" fullWidth>
          <textarea value={local.address || ''}
                    onChange={e => update('address', e.target.value)} />
        </Field>
        <Field label="Future Career Preference" fullWidth>
          <input type="text" value={local.future_pref || ''}
                 onChange={e => update('future_pref', e.target.value)} />
        </Field>
        <Field label="Skills / Extra-curricular" fullWidth>
          <textarea value={local.skills || ''}
                    onChange={e => update('skills', e.target.value)} />
        </Field>
      </div>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '24px 0 12px' }}>
        Family KYC
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Father Name">
          <input type="text" value={local.father_name || ''}
                 onChange={e => update('father_name', e.target.value)} />
        </Field>
        <Field label="Father Occupation">
          <input type="text" value={local.father_occ || ''}
                 onChange={e => update('father_occ', e.target.value)} />
        </Field>
        <Field label="Father Contact">
          <input type="text" value={local.father_contact || ''}
                 onChange={e => update('father_contact', e.target.value)} />
        </Field>
        <Field label="Mother Name">
          <input type="text" value={local.mother_name || ''}
                 onChange={e => update('mother_name', e.target.value)} />
        </Field>
        <Field label="Mother Occupation">
          <input type="text" value={local.mother_occ || ''}
                 onChange={e => update('mother_occ', e.target.value)} />
        </Field>
        <Field label="Mother Contact">
          <input type="text" value={local.mother_contact || ''}
                 onChange={e => update('mother_contact', e.target.value)} />
        </Field>
      </div>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '24px 0 12px' }}>
        Bank details
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Account Number">
          <input type="text" value={local.bank_account || ''}
                 onChange={e => update('bank_account', e.target.value)} />
        </Field>
        <Field label="IFSC Code">
          <input type="text" value={local.bank_ifsc || ''}
                 onChange={e => update('bank_ifsc', e.target.value)} />
        </Field>
        <Field label="Branch">
          <input type="text" value={local.bank_branch || ''}
                 onChange={e => update('bank_branch', e.target.value)} />
        </Field>
        <Field label="Account Holder Name">
          <input type="text" value={local.bank_holder || ''}
                 onChange={e => update('bank_holder', e.target.value)} />
        </Field>
      </div>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '24px 0 12px' }}>
        Declaration & ID proof
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Declaration text (staff-verified)">
          <select value={(local.declaration === 'I agree and commit to the above declaration.' || !local.declaration) ? 'agreed' : 'other'}
                  onChange={e => update('declaration',
                    e.target.value === 'agreed' ? 'I agree and commit to the above declaration.' : '')}>
            <option value="agreed">I agree and commit to the above declaration.</option>
            <option value="other">— (cleared, re-collect)</option>
          </select>
        </Field>
        <Field label="Declaration recorded at">
          <input type="datetime-local"
                 value={local.declaration_at ? local.declaration_at.slice(0, 16) : ''}
                 onChange={e => update('declaration_at',
                   e.target.value ? new Date(e.target.value).toISOString() : null)} />
        </Field>

        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>ID proof</label>
          {local.id_proof_path ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={viewIdProof}>
                View current ID proof (signed link, 1 hour)
              </button>
              <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                Replace…
                <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                       onChange={e => {
                         const f = e.target.files?.[0];
                         if (f) uploadIdProof(f);
                       }} />
              </label>
              <code style={{ fontSize: 12, color: '#6b7280' }}>{local.id_proof_path}</code>
            </div>
          ) : (
            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              Upload ID proof (PDF or image)
              <input type="file" accept="application/pdf,image/*" style={{ display: 'none' }}
                     onChange={e => {
                       const f = e.target.files?.[0];
                       if (f) uploadIdProof(f);
                     }} />
            </label>
          )}
          <div className="hint">
            Stored in private bucket. Accessed via 1-hour signed URLs only.
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', margin: '24px 0 12px' }}>
        Demo & interview
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Field label="Demo attend count">
          <input type="number" value={local.demo_attend ?? 0}
                 onChange={e => update('demo_attend', parseInt(e.target.value, 10) || 0)} />
        </Field>
        <Field label="Demo convert count">
          <input type="number" value={local.demo_convert ?? 0}
                 onChange={e => update('demo_convert', parseInt(e.target.value, 10) || 0)} />
        </Field>
        <Field label="Rating">
          <input type="number" step="0.1" value={local.rating ?? ''}
                 onChange={e => update('rating', e.target.value === '' ? null : parseFloat(e.target.value))} />
        </Field>
        <Field label="YouTube link">
          <input type="text" value={local.youtube_link || ''}
                 onChange={e => update('youtube_link', e.target.value)} />
        </Field>
        <Field label="Section (APT)">
          <input type="text" value={local.section_apt || ''}
                 onChange={e => update('section_apt', e.target.value)} />
        </Field>
        <Field label="Subject (APT)">
          <input type="text" value={local.subject_apt || ''}
                 onChange={e => update('subject_apt', e.target.value)} />
        </Field>
        <Field label="Medium (APT)">
          <input type="text" value={local.medium_apt || ''}
                 onChange={e => update('medium_apt', e.target.value)} />
        </Field>
        <Field label="Interviewer">
          <input type="text" value={local.interviewer || ''}
                 onChange={e => update('interviewer', e.target.value)} />
        </Field>
        <Field label="Remark" fullWidth>
          <textarea value={local.remark || ''}
                    onChange={e => update('remark', e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={pending || !isDirty()}>
          {pending ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save changes'}
        </button>
        {applicant.updated_at && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Last edited {new Date(applicant.updated_at).toLocaleString('en-IN')}
          </span>
        )}
      </div>
    </div>
  );
}

function ReadOnly({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className="field" style={{ marginBottom: 0, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label>{label}</label>
      <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 8, fontSize: 14, color: '#374151' }}>
        {value || <em style={{ color: '#9ca3af' }}>—</em>}
      </div>
    </div>
  );
}

function Field({ label, children, fullWidth }: { label: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className="field" style={{ marginBottom: 0, gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label>{label}</label>
      {children}
    </div>
  );
}