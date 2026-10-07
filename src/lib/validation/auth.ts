import { z } from 'zod';

/**
 * Centralised authentication validation.
 *
 * Shared by the client forms (for immediate feedback) and the server actions
 * (which re-validate everything, since a client can never be trusted).
 */

/** Nigerian numbers are conventionally 11 digits starting 0, or +234 followed by 10. */
/**
 * Nigerian mobile numbers: 0803…, 0903…, +234803… or 234803…
 * The wizard strips spaces, hyphens and brackets before testing, exactly as
 * these schemas do, so browser and server agree.
 */
export const PHONE_PATTERN = /^(?:\+?234|0)[789]\d{9}$/;
export const PHONE_MESSAGE = 'Enter a valid Nigerian phone number, e.g. 08031234567';

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => PHONE_PATTERN.test(value), {
    message: PHONE_MESSAGE,
  });

/** Optional variant: empty string is treated as "not provided". */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => value === '' || PHONE_PATTERN.test(value), {
    message: PHONE_MESSAGE,
  });

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email address is required')
  .max(254, 'Email address is too long')
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

/**
 * Password policy.
 *
 * Supabase applies its own minimum as well — set the same policy (12 characters,
 * mixed character classes) under Authentication → Policies in the dashboard.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(72, 'Passwords cannot be longer than 72 characters')
  .refine((value) => /[a-z]/.test(value), { message: 'Include at least one lowercase letter' })
  .refine((value) => /[A-Z]/.test(value), { message: 'Include at least one uppercase letter' })
  .refine((value) => /\d/.test(value), { message: 'Include at least one number' })
  .refine((value) => /[^A-Za-z0-9]/.test(value), {
    message: 'Include at least one symbol (for example ! ? # %)',
  });

export const signUpSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, 'Enter your full name')
    .max(160, 'Name is too long')
    .refine((value) => /\s/.test(value), { message: 'Enter both your first and last name' }),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  terms: z.literal(true, { message: 'Please accept the declaration to continue' }),
});

export const signInSchema = z.object({
  email: emailSchema,
  // Never apply the strength policy when signing in: an existing account may
  // predate a policy change, and a failed policy check would leak nothing useful.
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

/** Turn a Supabase auth error into a message an applicant can act on. */
export function describeAuthError(message: string): string {
  const normalised = message.toLowerCase();

  if (normalised.includes('invalid login credentials')) {
    return 'The email address or password is incorrect.';
  }
  if (normalised.includes('email not confirmed')) {
    return 'Please verify your email address first — check your inbox for the verification link.';
  }
  if (normalised.includes('user already registered') || normalised.includes('already been registered')) {
    return 'An account already exists with this email address. Try signing in instead.';
  }
  if (normalised.includes('rate limit') || normalised.includes('too many requests')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (normalised.includes('same password') || normalised.includes('different from the old')) {
    return 'Choose a password you have not used before.';
  }
  if (normalised.includes('weak password') || normalised.includes('password should be')) {
    return 'That password is too weak. Use at least 12 characters with upper case, lower case, a number and a symbol.';
  }
  if (normalised.includes('unable to validate email')) {
    return 'That email address could not be verified. Check the spelling and try again.';
  }
  if (normalised.includes('for security purposes')) {
    return 'Please wait a moment before requesting another email.';
  }

  return message;
}

/**
 * Messages shown when an emailed link fails.
 *
 * Supabase's own wording is written for developers ("PKCE code verifier not
 * found in storage…"). An applicant needs to know what to do next, so the
 * common cases are translated and anything unrecognised gets a neutral, honest
 * fallback rather than a raw technical string on the login screen.
 */
export function describeEmailLinkError(message: string): string {
  const normalised = message.toLowerCase();

  if (normalised.includes('pkce') || normalised.includes('code verifier')) {
    return 'This link was opened in a different browser or device from the one used to request it. Sign in with your password, or request a new link.';
  }
  if (
    normalised.includes('expired') ||
    normalised.includes('invalid') ||
    normalised.includes('not found') ||
    normalised.includes('already been used')
  ) {
    return 'This link has expired or has already been used. Request a new one and open it in the same browser you signed up in.';
  }
  if (normalised.includes('rate limit') || normalised.includes('too many requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }

  return 'That link could not be used. Sign in, or request a new one.';
}
