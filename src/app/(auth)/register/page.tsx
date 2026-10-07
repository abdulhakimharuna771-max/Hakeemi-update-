import type { Metadata } from 'next';

import { SignUpForm } from '@/components/auth/auth-forms';
import { Alert } from '@/components/ui/feedback';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Register for the Final Year Project & Innovation Development Program.',
};

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-serif text-2xl tracking-[-0.015em] text-navy-900 sm:text-3xl">
        Create your account
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        This account holds your registration, documents and application status. Registration has
        seven short steps and saves your progress as you go.
      </p>

      <div className="mt-7">
        <SignUpForm />
      </div>

      <Alert variant="info" className="mt-8">
        After signing up we send a verification link to your email address. You can start filling in
        the form immediately, but you must verify your address before you can submit.
      </Alert>
    </div>
  );
}
