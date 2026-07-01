'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw new Error(err.message);
      router.push('/admin/applicants');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1>Staff Login</h1>
      <p className="subtitle">ALEHA TEACHER admin panel</p>

      <form onSubmit={handleLogin} className="card">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label>Email</label>
          <input type="email" value={email} required
                 onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label>Password</label>
          <input type="password" value={password} required
                 onChange={e => setPassword(e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}
                style={{ width: '100%' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}