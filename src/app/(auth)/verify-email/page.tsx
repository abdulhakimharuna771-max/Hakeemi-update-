import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MailCheck } from 'lucide-react';

import { ResendVerificationForm } from '@/components/auth/auth-forms';
import { Alert } from '@/components/ui/feedback';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { buttonStyles } from '@/components/ui/button';
import { getSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const metadata: Metadata = {
  title: 'Verify your email address',
  description: 'Confirm your email address to continue your registration.',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? '';

  // If the address is already verified and the visitor is signed in, there is
  // nothing to do here.
  const session = await getSession();
  if (session?.emailVerified) {
    redirect('/portal/dashboard');
  }

  const configured = isSupabaseConfigured();

  return (
    <div>
      <span className="flex size-11 items-center justify-center rounded-md bg-emerald-50 ring-1 ring-emerald-100">
        <MailCheck aria-hidden="true" className="size-5 text-emerald-800" strokeWidth={1.75} />
      </span>

      <h1 className="mt-5 font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
        Check your email
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {email ? (
          <>
            We sent a verification link to <strong className="font-semibold text-navy-900">{email}</strong>.
          </>
        ) : (
          'We sent you a verification link.'
        )}{' '}
        Open it to verify your address — the link signs you in automatically.
      </p>

      {params.notice === 'unverified' ? (
        <Alert variant="warning" className="mt-6" title="Your email address is not verified yet">
          Your application is saved, but it cannot be submitted until you verify your address.
        </Alert>
      ) : null}

      <Alert variant="info" className="mt-6">
        The email can take a few minutes to arrive. If you cannot find it, check your spam or junk
        folder before requesting another one.
      </Alert>

      <Card className="mt-6">
        <CardHeader
          title="Didn't get the email?"
          description="Enter your address and we will send a new verification link."
          headingLevel="h2"
        />
        <CardBody>
          {configured ? (
            <ResendVerificationForm email={email} />
          ) : (
            <p className="text-sm leading-relaxed text-slate-600">
              The programme database is not connected, so verification emails cannot be sent right
              now.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/login" className={buttonStyles('secondary', 'md')}>
          Go to sign in
        </Link>
        <Link
          href="/portal/dashboard"
          className="text-sm font-semibold text-navy-800 hover:underline"
        >
          Continue filling in my application
        </Link>
      </div>
    </div>
  );
}
