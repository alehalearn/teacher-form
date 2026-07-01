// Browser-side Supabase client (anon key).
// Used by the public /apply form for inserts and photo uploads.
// Safe to expose — RLS restricts anon to insert-only on applicants.

import { createBrowserClient } from '@supabase/ssr';

export function getBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}