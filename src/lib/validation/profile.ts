import { z } from 'zod';

import { optionalPhoneSchema } from './auth';

/** Selects arrive as strings; an empty value means "not provided". */
const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || /^\d+$/.test(value), { message: 'Select a valid option' })
  .transform((value) => (value === undefined ? undefined : Number(value)));

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/**
 * Fields an applicant may change about themselves.
 *
 * Deliberately excludes role, profile_completion and anything review-related —
 * those are protected in the database as well, so a crafted request cannot
 * change them even if this schema were bypassed.
 */
export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, 'Enter your full name')
    .max(160, 'Full name is too long')
    .refine((value) => /\s/.test(value), { message: 'Enter both your first and last name' }),
  phone: optionalPhoneSchema,
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => {
        if (!value) return true;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        const age = (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 10 && age <= 100;
      },
      { message: 'Enter a valid date of birth' }
    ),
  address: optionalText(400, 'Address is too long'),
  state_id: optionalId,
  lga_id: optionalId,
  ward_id: optionalId,
  community: optionalText(160, 'Community name is too long'),
});

export type ProfileInput = z.input<typeof profileSchema>;
