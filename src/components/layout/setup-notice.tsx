import { Alert } from '@/components/ui/feedback';

/**
 * Shown when the application has been started without Supabase credentials.
 *
 * The platform fails loudly but gracefully: the interface stays navigable and
 * explains exactly what an operator has to do, instead of throwing a runtime
 * error or pretending to work.
 */
export function SetupNotice() {
  return (
    <Alert variant="warning" title="Supabase is not configured yet">
      <p>
        Registration, sign-in and document upload are disabled until the project credentials are
        present. Copy <code className="rounded bg-white/70 px-1 py-0.5 text-xs">.env.example</code> to{' '}
        <code className="rounded bg-white/70 px-1 py-0.5 text-xs">.env.local</code>, then set{' '}
        <code className="rounded bg-white/70 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
        <code className="rounded bg-white/70 px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        The steps are in <strong>SETUP.md</strong>.
      </p>
    </Alert>
  );
}
