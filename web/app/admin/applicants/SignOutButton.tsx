'use client';

import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }
  return (
    <button onClick={signOut} className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}>
      Sign out
    </button>
  );
}