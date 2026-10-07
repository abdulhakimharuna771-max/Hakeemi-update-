/**
 * Supabase configuration.
 *
 * Only the public URL and the anon key may ever reach the browser — both are
 * safe to expose because Row Level Security is what actually protects the data.
 * A service-role key must never be referenced from this application.
 */

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export const SUPABASE_BUCKET = 'applicant-documents';

export const isSupabaseConfigured = (): boolean =>
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;

/** Thrown when the app is started without a Supabase project configured. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      'Supabase is not configured. Copy .env.example to .env.local and set ' +
        'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see SETUP.md).'
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }
}
