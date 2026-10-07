import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from '@/components/auth/auth-forms';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { buttonStyles } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';
import { getSession } from '@/lib/auth';

/**
 * Rendered per request: the page depends on the signed-in session created by
 * the reset link, so it must never be prerendered into a fixed "expired link"
 * state at build time.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Set a new password for your applicant account.',
};

export default async function ResetPasswordPage() {
  const session = await getSession();

  // The reset link is exchanged for a short-lived session by /auth/confirm.
  // Without that session there is nothing to update — say so plainly instead of
  // showing a form that cannot work.
  if (!session) {
    return (
      <div>
        <h1 className="font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
          Choose a new password
        </h1>

        <Alert variant="warning" className="mt-6" title="This reset link is no longer valid">
          Password reset links expire, and they can only be used once. Request a new link and use it
          soon after it arrives.
        </Alert>

        <div className="mt-6">
          <EmptyState
            icon={KeyRound}
            title="Request a new reset link"
            description="We will email you a fresh link to set your password."
            action={
              <Link href="/forgot-password" className={buttonStyles('primary', 'md')}>
                Request a new link
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {session.user.email ? (
          <>
            Setting a new password for{' '}
            <strong className="font-semibold text-navy-900">{session.user.email}</strong>.
          </>
        ) : (
          'Set a new password for your account.'
        )}
      </p>

      <div className="mt-7">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
