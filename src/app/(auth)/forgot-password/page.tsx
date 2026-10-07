import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a password reset link for your applicant account.',
};

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
        Reset your password
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Enter the email address you registered with and we will send you a link to choose a new
        password.
      </p>

      <div className="mt-7">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
