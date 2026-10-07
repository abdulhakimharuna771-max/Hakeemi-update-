'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { fieldErrorsFrom } from '@/lib/validation/errors';
import type { AuthFormState } from '@/lib/forms';
import { publicOrigin } from '@/lib/http';
import {
  describeAuthError,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth';

/** Absolute origin of the current deployment, for auth email links. */
async function resolveOrigin(): Promise<string> {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');

  // publicOrigin() ignores a bind address such as 0.0.0.0, so a confirmation
  // link can never be emitted with a host the applicant cannot open.
  return publicOrigin(await headers());
}

/** Only allow internal, absolute-path redirects — never an open redirect. */
function safeNext(value: unknown, fallback: string): string {
  const candidate = typeof value === 'string' ? value : '';
  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    return candidate;
  }
  return fallback;
}

const NOT_CONFIGURED_MESSAGE =
  'The programme database is not connected yet, so accounts cannot be created or used. Please contact the programme office.';

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------
export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = signUpSchema.safeParse({
    full_name: formData.get('full_name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    password: formData.get('password') ?? '',
    terms: formData.get('terms') === 'on' || formData.get('terms') === 'true',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const origin = await resolveOrigin();
  const supabase = await getServerSupabase();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user() trigger to pre-fill the profile.
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/portal/dashboard')}`,
    },
  });

  if (error) {
    return { status: 'error', message: describeAuthError(error.message) };
  }

  // A session means email confirmation is switched off for this project.
  if (data.session) {
    redirect('/portal/dashboard');
  }

  // Otherwise the applicant must confirm their address before continuing.
  // The same response is returned whether or not the address already exists,
  // so this form cannot be used to discover who has an account.
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export async function signInAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: NOT_CONFIGURED_MESSAGE };
  }

  const next = safeNext(formData.get('next'), '/portal/dashboard');

  const parsed = signInSchema.safeParse({
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const message = describeAuthError(error.message);

    if (error.message.toLowerCase().includes('email not confirmed')) {
      redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&notice=unverified`);
    }

    return { status: 'error', message };
  }

  if (data.user && !(data.user.email_confirmed_at ?? data.user.confirmed_at)) {
    redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&notice=unverified`);
  }

  redirect(next);
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getServerSupabase();
    await supabase.auth.signOut();
  }
  redirect('/login?notice=signed-out');
}

// ---------------------------------------------------------------------------
// Resend verification email
// ---------------------------------------------------------------------------
export async function resendVerificationAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = resendVerificationSchema.safeParse({ email: formData.get('email') ?? '' });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Enter the email address you registered with.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const origin = await resolveOrigin();
  const supabase = await getServerSupabase();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/portal/dashboard')}`,
    },
  });

  if (error) {
    return { status: 'error', message: describeAuthError(error.message) };
  }

  return {
    status: 'success',
    message: `If an unverified account exists for ${parsed.data.email}, a new verification link is on its way. Check your spam folder if it does not arrive within a few minutes.`,
  };
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------
export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') ?? '' });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Enter the email address you registered with.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const origin = await resolveOrigin();
  const supabase = await getServerSupabase();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/reset-password')}`,
  });

  if (error && !error.message.toLowerCase().includes('security purposes')) {
    console.error('requestPasswordResetAction failed:', error.message);
  }

  // Always report success: whether an account exists must not be discoverable.
  return {
    status: 'success',
    message: `If an account exists for ${parsed.data.email}, a password reset link has been sent. The link expires shortly, so use it soon after it arrives.`,
  };
}

// ---------------------------------------------------------------------------
// Set a new password (requires the session created by the reset link)
// ---------------------------------------------------------------------------
export async function updatePasswordAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) {
    return { status: 'error', message: NOT_CONFIGURED_MESSAGE };
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password') ?? '',
    confirm_password: formData.get('confirm_password') ?? '',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: 'error',
      message: 'Your reset link has expired or was already used. Request a new link to continue.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { status: 'error', message: describeAuthError(error.message) };
  }

  redirect('/portal/dashboard?notice=password-updated');
}
