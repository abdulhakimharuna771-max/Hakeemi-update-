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

/**
 * Every request to Supabase is bounded.
 *
 * A paused project, an expired quota or a DNS failure otherwise leaves the
 * visitor watching a blank page while the SDK retries. Failing after ten
 * seconds lets the read layer return its empty state and the page render with
 * an honest "not published yet" message instead.
 *
 * Server-to-Supabase calls sit in a datacentre, so ten seconds is generous; a
 * caller-supplied signal always wins.
 */
export const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export const supabaseFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS) });
