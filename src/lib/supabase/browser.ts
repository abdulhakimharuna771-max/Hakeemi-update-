'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabaseConfigured } from './config';

/**
 * Browser Supabase client.
 *
 * Every write performed through this client is authorised by Row Level
 * Security, so a tampered browser cannot reach another applicant's rows.
 */
let cached: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  assertSupabaseConfigured();
  if (!cached) {
    cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return cached;
}
