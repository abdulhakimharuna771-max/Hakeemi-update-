import type { Metadata } from 'next';

import { SignInForm } from '@/components/auth/auth-forms';
import { Alert } from '@/components/ui/feedback';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Applicant login',
  description: 'Sign in to the applicant portal to continue your registration.',
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'That verification link is incomplete. Request a new one from the verification page.',
  invalid_link: 'That link is not valid any more. Please sign in, or request a new link.',
  not_configured: 'The programme database is not connected yet, so sign-in is unavailable.',
  access_denied: 'That link has already been used or has expired. Request a new one to continue.',
};

const NOTICES: Record<string, string> = {
  'signed-out': 'You have been signed out.',
  'session-expired': 'Your session ended. Please sign in again to continue.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;

  // Someone with a live session should not land on the login form.
  const session = await getSession();
  if (session) {
    redirect(
      params.next && params.next.startsWith('/') && !params.next.startsWith('//')
        ? params.next
        : '/portal/dashboard'
    );
  }

  const errorMessage = params.error
    ? ERROR_MESSAGES[params.error] ?? decodeURIComponent(params.error)
    : null;
  const notice = params.notice ? NOTICES[params.notice] ?? null : null;

  const next =
    params.next && params.next.startsWith('/') && !params.next.startsWith('//')
      ? params.next
      : '/portal/dashboard';

  return (
    <div>
      <h1 className="font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
        Sign in to your dashboard
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Continue your registration, track your application and manage your documents.
      </p>

      {errorMessage ? (
        <Alert variant="error" className="mt-6">
          {errorMessage}
        </Alert>
      ) : null}

      {notice ? (
        <Alert variant="info" className="mt-6">
          {notice}
        </Alert>
      ) : null}

      <div className="mt-7">
        <SignInForm next={next} />
      </div>
    </div>
  );
}
