// Server action — called from the edit form.
// Server stamps updated_at + updated_by, writes an audit_log row per changed
// field, and only allows edits to whitelisted columns.

'use server';

import { revalidatePath } from 'next/cache';
import { getServerClient } from '@/lib/supabase-server';
import { EDITABLE_STAFF_FIELDS } from '@/lib/types';

interface PatchPayload {
  id: string;
  changes: Record<string, unknown>;
}

export async function patchApplicant(payload: PatchPayload) {
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Filter incoming changes to whitelisted columns only.
  const safeChanges: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload.changes)) {
    if ((EDITABLE_STAFF_FIELDS as readonly string[]).includes(k)) {
      safeChanges[k] = v;
    }
  }
  if (Object.keys(safeChanges).length === 0) {
    return { ok: false, error: 'No editable fields supplied' };
  }

  // Fetch current values to compute audit diffs.
  const { data: before, error: readErr } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', payload.id)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  // Apply update with audit stamps.
  const { error: updErr } = await supabase
    .from('applicants')
    .update({ ...safeChanges, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', payload.id);
  if (updErr) return { ok: false, error: updErr.message };

  // Write audit log entries — one row per changed field.
  const auditRows = Object.entries(safeChanges).map(([field, newVal]) => ({
    applicant_id: payload.id,
    staff_id: user.id,
    staff_email: user.email!,
    field_name: field,
    old_value: before?.[field] == null ? null : String(before[field]),
    new_value: newVal == null ? null : String(newVal),
  }));
  if (auditRows.length > 0) {
    const { error: logErr } = await supabase.from('audit_log').insert(auditRows);
    if (logErr) return { ok: false, error: `Audit log failed: ${logErr.message}` };
  }

  revalidatePath(`/admin/applicants/${payload.id}`);
  return { ok: true, count: Object.keys(safeChanges).length };
}