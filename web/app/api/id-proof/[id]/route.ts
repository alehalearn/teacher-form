// GET /api/id-proof/[id]
// Returns a short-lived signed URL for the applicant's ID proof.
// Only authenticated staff can call this. The signed URL expires in 1 hour.

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: row, error } = await supabase
    .from('applicants')
    .select('id_proof_path, full_name')
    .eq('id', params.id)
    .single();

  if (error || !row || !row.id_proof_path) {
    return NextResponse.json({ error: 'no id proof on file' }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('id-proofs')
    .createSignedUrl(row.id_proof_path, 60 * 60); // 1 hour

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  return NextResponse.json({
    url: signed.signedUrl,
    expires_in_seconds: 3600,
    applicant: row.full_name
  });
}