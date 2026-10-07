import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from './config';

/**
 * Server Supabase client, bound to the request's cookies.
 *
 * Uses the anon key and the signed-in user's session only. Authorisation is
 * enforced by Row Level Security, so server code is not a privilege boundary
 * that could be bypassed by forgetting a check — it simply cannot read rows the
 * signed-in user may not see.
 */
export async function getServerSupabase(): Promise<SupabaseClient> {
  assertSupabaseConfigured();
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled in src/proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}
