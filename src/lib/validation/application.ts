import { z } from 'zod';

import type { ApplicantCategory, CategoryDetailField } from '../types';
import { optionalPhoneSchema, phoneSchema } from './auth';

/**
 * Application validation, shared by the wizard and the server actions.
 *
 * Step 4 is partly dynamic: the category-specific questions come from
 * applicant_categories.detail_schema in the database, and this module compiles
 * those descriptors into a Zod schema. That mirrors the SQL function
 * validate_category_details(), so the browser and the database agree on the
 * rules — and adding a category still requires no code change.
 */

/** Select values arrive from <select> as strings, so coerce carefully. */
const idField = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .regex(/^\d+$/, message)
    .transform((value) => Number(value));

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const PERSONAL_STEP_SCHEMA = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, 'Enter your full name')
    .max(160, 'Full name is too long')
    .refine((value) => /\s/.test(value), { message: 'Enter both your first and last name' }),
  phone: phoneSchema,
  // Configurable in the database (applications.date_of_birth is nullable and the
  // checklist marks it optional) — collected, but not required.
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
        const now = new Date();
        const age = (now.getTime() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 10 && age <= 100;
      },
      { message: 'Enter a valid date of birth' }
    ),
  address: z
    .string()
    .trim()
    .min(6, 'Enter your residential address')
    .max(400, 'Address is too long'),
});

export const CATEGORY_STEP_SCHEMA = z.object({
  category_id: idField('Select the category that best describes you'),
});

export const LOCATION_STEP_SCHEMA = z.object({
  state_id: idField('Select your state'),
  lga_id: idField('Select your local government area'),
  ward_id    : idField('Select your ward'),
  community: optionalText(160, 'Community name is too long'),
});

export const PROJECT_BASE_SCHEMA = z.object({
  project_name: z
    .string()
    .trim()
    .min(3, 'Give your business, project or idea a name')
    .max(200, 'Name is too long'),
  project_description: z
    .string()
    .trim()
    .min(30, 'Describe it in at least 30 characters so a reviewer understands it')
    .max(3000, 'Keep the description under 3000 characters'),
  problem_statement: z
    .string()
    .trim()
    .min(20, 'Describe the problem in at least 20 characters')
    .max(3000, 'Keep this under 3000 characters'),
  opportunity_statement: optionalText(3000, 'Keep this under 3000 characters'),
  current_stage: z.string().trim().min(1, 'Select the current stage'),
  target_beneficiaries: optionalText(500, 'Keep this under 500 characters'),
  expected_impact: optionalText(1500, 'Keep this under 1500 characters'),
});

export const STAGE_OPTIONS = [
  { value: 'Idea / concept', label: 'Idea / concept' },
  { value: 'Research or planning', label: 'Research or planning' },
  { value: 'Prototype in development', label: 'Prototype in development' },
  { value: 'Working prototype', label: 'Working prototype' },
  { value: 'Operating', label: 'Operating' },
  { value: 'Growing / expanding', label: 'Growing / expanding' },
] as const;

export const SUPPORT_STEP_SCHEMA = z.object({
  support_needs: z
    .array(z.string())
    .min(1, 'Select at least one type of support you need')
    .max(20, 'Select the support you need'),
  support_details: z.record(z.string(), z.string().max(600, 'Keep this under 600 characters')).optional(),
});

export const REVIEW_STEP_SCHEMA = z.object({
  terms_accepted: z.literal(true, { message: 'You must accept the declaration before submitting' }),
  accuracy_confirmed: z.literal(true, { message: 'Please confirm that your information is accurate' }),
});

/** Compile a category's detail_schema into a Zod object. */
export function buildCategoryDetailsSchema(fields: CategoryDetailField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const required = Boolean(field.required);
    let base: z.ZodTypeAny;

    switch (field.type) {
      case 'number':
        base = z
          .string()
          .trim()
          .refine((value) => value === '' || /^\d{1,9}$/.test(value), {
            message: 'Enter a whole number',
          });
        break;
      case 'select': {
        const values = (field.options ?? []).map((option) => option.value) as [string, ...string[]];
        base = values.length > 0 ? z.enum(values, { message: 'Select an option' }) : z.string();
        break;
      }
      case 'textarea':
        base = z.string().trim().max(3000, 'Keep this under 3000 characters');
        break;
      case 'date':
        base = z
          .string()
          .trim()
          .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), {
            message: 'Enter a valid date',
          });
        break;
      default:
        base = z.string().trim().max(500, 'Keep this under 500 characters');
    }

    if (!required) {
      shape[field.key] = base
        .optional()
        .transform((value) => (typeof value === 'string' && value.length === 0 ? undefined : value));
    } else {
      shape[field.key] = base.refine(
        (value) => value !== undefined && value !== null && String(value).trim().length > 0,
        { message: `${field.label} is required` }
      );
    }
  }

  return z.object(shape).partial().passthrough();
}

/** Full client-side schema used by the Review step before submitting. */
export function buildFullApplicationSchema(category: ApplicantCategory | null) {
  return z.object({
    ...PERSONAL_STEP_SCHEMA.shape,
    ...CATEGORY_STEP_SCHEMA.shape,
    ...LOCATION_STEP_SCHEMA.shape,
    ...PROJECT_BASE_SCHEMA.shape,
    ...SUPPORT_STEP_SCHEMA.shape,
    ...REVIEW_STEP_SCHEMA.shape,
    skills: z.array(z.string()).optional(),
    category_details: category ? buildCategoryDetailsSchema(category.detail_schema) : z.object({}),
  });
}

export type ApplicationFormValues = z.input<ReturnType<typeof buildFullApplicationSchema>>;

/**
 * Which React Hook Form fields belong to each step, so "Next" validates only
 * what the applicant can actually see.
 */
export function fieldNamesForStep(step: number, category: ApplicantCategory | null): string[] {
  switch (step) {
    case 1:
      return ['full_name', 'phone', 'date_of_birth', 'address'];
    case 2:
      return ['category_id'];
    case 3:
      return ['state_id', 'lga_id', 'ward_id', 'community'];
    case 4: {
      const base = [
        'project_name',
        'project_description',
        'problem_statement',
        'opportunity_statement',
        'current_stage',
        'target_beneficiaries',
        'expected_impact',
        'skills',
      ];
      const detailFields = (category?.detail_schema ?? []).map((field) => `category_details.${field.key}`);
      return [...base, ...detailFields];
    }
    case 5:
      return ['support_needs', 'support_details'];
    case 6:
      return [];
    case 7:
      return ['terms_accepted', 'accuracy_confirmed'];
    default:
      return [];
  }
}

export { optionalPhoneSchema };
