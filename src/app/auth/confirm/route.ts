import { type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { describeEmailLinkError } from '@/lib/validation/auth';
import { redirectTo } from '@/lib/http';

/**
 * Handles every link Supabase Auth sends by email.
 *
 * Two shapes are supported so the project works with either email template:
 *   1. <app>/auth/confirm?token_hash=...&type=email|recovery|...  (recommended)
 *   2. <app>/auth/confirm?code=...                                (PKCE callback)
 *
 * The redirect target is validated to be an internal path, so a crafted link
 * cannot bounce an applicant to an external site.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const providerError = searchParams.get('error');
  const providerErrorDescription = searchParams.get('error_description');

  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('\\')
      ? nextParam
      : '/portal/dashboard';

  // Every failure lands on the login screen with an applicant-readable reason.
  const failure = (reason: string) =>
    redirectTo(request, `/login?error=${encodeURIComponent(describeEmailLinkError(reason))}`);

  if (providerError) {
    return failure(providerErrorDescription ?? providerError);
  }

  if (!isSupabaseConfigured()) {
    return failure('not_configured');
  }

  if (!tokenHash && !code) {
    return failure('missing_token');
  }

  const supabase = await getServerSupabase();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error('auth confirm (otp) failed:', error.message);
      return failure(error.message);
    }
    return redirectTo(request, next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('auth confirm (code) failed:', error.message);
      return failure(error.message);
    }
    return redirectTo(request, next);
  }

  return failure('invalid_link');
}
