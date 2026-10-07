'use server';

import { z } from 'zod';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSession } from '@/lib/auth';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/constants';
import { fieldErrorsFrom } from '@/lib/validation/errors';

export interface ContactFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_CONTACT_STATE: ContactFormState = { status: 'idle' };

const contactSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Enter your name')
    .max(160, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address').max(254, 'Email is too long'),
  phone: z.string().trim().max(32, 'Phone number is too long').optional(),
  subject: z.string().trim().max(200, 'Subject is too long').optional(),
  message: z
    .string()
    .trim()
    .min(10, 'Please write at least 10 characters')
    .max(CONTACT_MESSAGE_MAX_LENGTH, `Please keep your message under ${CONTACT_MESSAGE_MAX_LENGTH} characters`),
});

/**
 * Store an enquiry from the public contact form.
 *
 * Validation happens on the server and the row is subject to Row Level
 * Security: the public may insert, only admins may read. Nothing is sent by
 * email because no mail sender is configured for Phase 1 — the interface says
 * so rather than implying a message was emailed.
 */
export async function submitContactMessage(
  _previous: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  // Simple bot deterrence: the field is hidden from people and ignored by screens.
  if (String(formData.get('website') ?? '').length > 0) {
    return { status: 'success', message: 'Thank you — your message has been received.' };
  }

  const parsed = contactSchema.safeParse({
    full_name: formData.get('full_name') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    subject: formData.get('subject') ?? '',
    message: formData.get('message') ?? '',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please correct the highlighted fields and try again.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: 'error',
      message:
        'This form cannot send yet because the programme database has not been connected. Please try again later.',
    };
  }

  const session = await getSession();
  const supabase = await getServerSupabase();

  const { error } = await supabase.from('contact_messages').insert({
    full_name: parsed.data.full_name,
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone || null,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
    user_id: session?.user.id ?? null,
  });

  if (error) {
    console.error('submitContactMessage failed:', error.message);
    return {
      status: 'error',
      message: 'Your message could not be sent. Please try again in a moment.',
    };
  }

  return {
    status: 'success',
    message:
      'Thank you — your message has been received by the programme office. Messages are reviewed during office hours; there is no need to send it again.',
  };
}
