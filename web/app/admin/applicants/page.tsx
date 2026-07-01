import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase-server';
import { STATUS_OPTIONS } from '@/lib/constants';
import type { Applicant } from '@/lib/types';
import SignOutButton from './SignOutButton';

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 50;

export default async function ApplicantsPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/login');

  const q = (searchParams.q || '').trim();
  const status = searchParams.status || '';
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('applicants')
    .select('id, code, full_name, district, status, created_at, phone, email', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <div className="container wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Applicants</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>
            {count ?? 0} total · signed in as {user.email}
          </span>
          <SignOutButton />
        </div>
      </div>

      <form className="toolbar" method="get">
        <input className="grow" name="q" placeholder="Search by name, code, phone, email…"
               defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
        {(q || status) && (
          <Link href="/admin/applicants" className="btn btn-secondary">Clear</Link>
        )}
      </form>

      {error && <div className="alert alert-error">{error.message}</div>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>District</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(!data || data.length === 0) && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>
                No applicants match the current filter.
              </td></tr>
            )}
            {data?.map((a: Pick<Applicant, 'id' | 'code' | 'full_name' | 'district' | 'status' | 'created_at' | 'phone' | 'email'>) => (
              <tr key={a.id}>
                <td>{a.code || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                <td><strong>{a.full_name}</strong></td>
                <td>{a.district}</td>
                <td>{a.phone}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.email}
                </td>
                <td>
                  <span className={`status-badge status-${a.status.replace(' ', '\\ ')}`}>
                    {a.status}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#6b7280' }}>
                  {new Date(a.created_at).toLocaleDateString('en-IN')}
                </td>
                <td>
                  <Link href={`/admin/applicants/${a.id}`} className="btn btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 12 }}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        {page > 1 && (
          <Link href={{ pathname: '/admin/applicants', query: { ...searchParams, page: page - 1 } }}
                className="btn btn-secondary">Previous</Link>
        )}
        <span style={{ padding: '10px 12px', color: '#6b7280', fontSize: 13 }}>
          Page {page} of {totalPages}
        </span>
        {page < totalPages && (
          <Link href={{ pathname: '/admin/applicants', query: { ...searchParams, page: page + 1 } }}
                className="btn btn-secondary">Next</Link>
        )}
      </div>
    </div>
  );
}