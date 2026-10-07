'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Circle, CircleCheck, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { FieldCheckbox, FieldInput } from '@/components/ui/form-controls';
import {
  resendVerificationAction,
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from '@/app/auth/actions';
import { INITIAL_AUTH_STATE, type AuthFormState } from '@/lib/forms';

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
      {children}
    </Button>
  );
}

function FormAlert({ state }: { state: AuthFormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return (
    <Alert variant={state.status === 'success' ? 'success' : 'error'} className="mb-6">
      {state.message}
    </Alert>
  );
}

/** Live checklist showing which password rules the current value already meets. */
function PasswordRequirements({ value }: { value: string }) {
  const rules = [
    { label: 'At least 12 characters', met: value.length >= 12 },
    { label: 'Upper and lower case letters', met: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: 'At least one number', met: /\d/.test(value) },
    { label: 'At least one symbol', met: /[^A-Za-z0-9]/.test(value) },
  ];

  return (
    <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-xs ${rule.met ? 'text-emerald-700' : 'text-slate-500'}`}
        >
          {rule.met ? (
            <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <Circle aria-hidden="true" className="size-3.5 shrink-0" />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.met ? '— requirement met' : '— requirement not met yet'}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign up                                                                    */
/* -------------------------------------------------------------------------- */

export function SignUpForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signUpAction,
    INITIAL_AUTH_STATE
  );
  const [password, setPassword] = useState('');
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />

      <FieldInput
        id="signup-name"
        name="full_name"
        label="Full name"
        required
        autoComplete="name"
        placeholder="e.g. Amina Yusuf Bello"
        error={errors.full_name}
      />

      <FieldInput
        id="signup-email"
        name="email"
        type="email"
        label="Email address"
        required
        autoComplete="email"
        placeholder="you@example.com"
        hint="We send a verification link here. You must verify it before you can submit an application."
        error={errors.email}
      />

      <FieldInput
        id="signup-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        label="Phone number"
        required
        autoComplete="tel"
        placeholder="08031234567"
        error={errors.phone}
      />

      <div>
        <FieldInput
          id="signup-password"
          name="password"
          type="password"
          label="Password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <PasswordRequirements value={password} />
      </div>

      <FieldCheckbox
        id="signup-terms"
        name="terms"
        className="mt-1"
        error={errors.terms}
        label={
          <>
            I confirm that the information I provide is accurate and complete, and I accept that the
            programme may verify it.
          </>
        }
      />

      <SubmitButton>
        Create my account
        <ArrowRight aria-hidden="true" className="size-4" />
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-navy-800 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                    */
/* -------------------------------------------------------------------------- */

export function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signInAction,
    INITIAL_AUTH_STATE
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next} />

      <FieldInput
        id="signin-email"
        name="email"
        type="email"
        label="Email address"
        required
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email}
      />

      <div>
        <FieldInput
          id="signin-password"
          name="password"
          type="password"
          label="Password"
          required
          autoComplete="current-password"
          error={errors.password}
        />
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-navy-800 hover:underline">
            Forgot your password?
          </Link>
        </div>
      </div>

      <SubmitButton>
        Sign in
        <ArrowRight aria-hidden="true" className="size-4" />
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        No account yet?{' '}
        <Link href="/register" className="font-semibold text-navy-800 hover:underline">
          Start registration
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    requestPasswordResetAction,
    INITIAL_AUTH_STATE
  );
  const errors = state.fieldErrors ?? {};

  if (state.status === 'success') {
    return (
      <div className="space-y-5">
        <FormAlert state={state} />
        <Link href="/login" className="inline-block text-sm font-semibold text-navy-800 hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />

      <FieldInput
        id="forgot-email"
        name="email"
        type="email"
        label="Email address"
        required
        autoComplete="email"
        placeholder="you@example.com"
        hint="We will send a password reset link if an account exists for this address."
        error={errors.email}
      />

      <SubmitButton>
        <Mail aria-hidden="true" className="size-4" />
        Send reset link
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="font-semibold text-navy-800 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    updatePasswordAction,
    INITIAL_AUTH_STATE
  );
  const [password, setPassword] = useState('');
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormAlert state={state} />

      <div>
        <FieldInput
          id="reset-password"
          name="password"
          type="password"
          label="New password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <PasswordRequirements value={password} />
      </div>

      <FieldInput
        id="reset-confirm"
        name="confirm_password"
        type="password"
        label="Confirm new password"
        required
        autoComplete="new-password"
        error={errors.confirm_password}
      />

      <SubmitButton>
        Set new password
        <ArrowRight aria-hidden="true" className="size-4" />
      </SubmitButton>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Resend verification                                                        */
/* -------------------------------------------------------------------------- */

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    resendVerificationAction,
    INITIAL_AUTH_STATE
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert state={state} />

      <FieldInput
        id="resend-email"
        name="email"
        type="email"
        label="Email address"
        required
        defaultValue={email}
        autoComplete="email"
        error={errors.email}
      />

      <SubmitButton>Resend verification email</SubmitButton>
    </form>
  );
}
