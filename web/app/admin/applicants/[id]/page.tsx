import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerClient } from '@/lib/supabase-server';
import type { Applicant, AuditLogEntry } from '@/lib/types';
import ApplicantEditForm from './ApplicantEditForm';

export default async function ApplicantDetailPage({ params }: { params: { id: string } }) {
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const { data: applicant, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !applicant) notFound();

  const { data: audit } = await supabase
    .from('audit_log')
    .select('*')
    .eq('applicant_id', params.id)
    .order('changed_at', { ascending: false })
    .limit(50);

  return (
    <div className="container wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Link href="/admin/applicants" style={{ fontSize: 13 }}>← Back to list</Link>
          <h1 style={{ marginTop: 8 }}>{applicant.full_name}</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            {applicant.code ? <code>{applicant.code}</code> : 'No code yet'} ·
            {' '}<span className={`status-badge status-${applicant.status.replace(' ', '\\ ')}`}>{applicant.status}</span>
            {' '}· submitted {new Date(applicant.created_at).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <ApplicantEditForm applicant={applicant as Applicant} />

      <div className="card" style={{ marginTop: 24 }}>
        <h2>Recent edits</h2>
        {(!audit || audit.length === 0) ? (
          <p style={{ color: '#6b7280', marginTop: 8 }}>No staff edits yet.</p>
        ) : (
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>When</th>
                <th>By</th>
                <th>Field</th>
                <th>Old</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {(audit as AuditLogEntry[]).map(a => (
                <tr key={a.id}>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>
                    {new Date(a.changed_at).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontSize: 12 }}>{a.staff_email}</td>
                  <td><code>{a.field_name}</code></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
                    {a.old_value || <em>—</em>}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {a.new_value || <em>—</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}