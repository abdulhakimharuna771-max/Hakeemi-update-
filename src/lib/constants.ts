import {
  Award,
  BookOpen,
  Briefcase,
  Building,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Flag,
  Globe,
  GraduationCap,
  Handshake,
  HandCoins,
  Lightbulb,
  Newspaper,
  Rocket,
  ShieldCheck,
  Sprout,
  Store,
  Target,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { ApplicationStatus, StatusTone } from './types';

/**
 * The seven registration steps.
 *
 * Uploaded documents do not gate submission in Phase 1 — a reviewer can request
 * specific documents later through the "more information required" workflow —
 * so the checklist treats them as optional.
 */
export const APPLICATION_STEPS = [
  { number: 1, key: 'personal', label: 'Personal', title: 'Personal information' },
  { number: 2, key: 'category', label: 'Category', title: 'Applicant category' },
  { number: 3, key: 'location', label: 'Location', title: 'Where you are based' },
  { number: 4, key: 'project', label: 'Idea', title: 'Business, project or innovation' },
  { number: 5, key: 'support', label: 'Support', title: 'Support needed' },
  { number: 6, key: 'documents', label: 'Documents', title: 'Supporting documents' },
  { number: 7, key: 'review', label: 'Review', title: 'Review and submit' },
] as const;

export type StepKey = (typeof APPLICATION_STEPS)[number]['key'];
export const LAST_STEP = APPLICATION_STEPS.length;

export function stepForKey(key: StepKey) {
  return APPLICATION_STEPS.find((step) => step.key === key)!;
}

/**
 * Maps a missing-field key from the database to a registration step.
 * `detail:<key>` entries come from a category's own detail_schema (Step 4).
 */
export function stepForFieldKey(fieldKey: string): number {
  if (fieldKey.startsWith('detail:')) return 4;
  if (fieldKey.startsWith('support_details.')) return 5;

  const map: Record<string, number> = {
    full_name: 1,
    phone: 1,
    address: 1,
    date_of_birth: 1,
    category_id: 2,
    state_id: 3,
    lga_id: 3,
    ward_id: 3,
    community: 3,
    project_name: 4,
    project_description: 4,
    problem_statement: 4,
    opportunity_statement: 4,
    current_stage: 4,
    target_beneficiaries: 4,
    skills: 4,
    expected_impact: 4,
    support_needs: 5,
    terms_accepted: 7,
  };

  return map[fieldKey] ?? 1;
}

/** Badge styling per status tone. Tones are stored in the database. */
export const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  info: 'bg-navy-50 text-navy-700 ring-navy-200',
  progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
};

export const TONE_DOT_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-navy-600',
  progress: 'bg-amber-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-600',
  danger: 'bg-red-600',
};

/** Fallback metadata if the database has not been seeded yet. */
const STATUS_FALLBACK: Record<ApplicationStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'progress' },
  MORE_INFORMATION_REQUIRED: { label: 'More Information Required', tone: 'warning' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'success' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  IN_DEVELOPMENT: { label: 'In Development', tone: 'progress' },
  COMPLETED: { label: 'Completed', tone: 'success' },
};

export function statusFallback(status: ApplicationStatus | null | undefined) {
  if (!status) return { label: 'Unknown', tone: 'neutral' as StatusTone };
  return STATUS_FALLBACK[status] ?? { label: status, tone: 'neutral' };
}

/** Icons referenced by applicant_categories.icon (a database column). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'graduation-cap': GraduationCap,
  store: Store,
  sprout: Sprout,
  briefcase: Briefcase,
  lightbulb: Lightbulb,
  users: Users,
  'trending-up': TrendingUp,
  'book-open': BookOpen,
  globe: Globe,
  building: Building,
  target: Target,
  award: Award,
  rocket: Rocket,
  handshake: Handshake,
  newspaper: Newspaper,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  flag: Flag,
};

/** Icons referenced by support_needs.code, for the support picker. */
export const SUPPORT_ICONS: Record<string, LucideIcon> = {
  TRAINING: BookOpen,
  MENTORSHIP: Handshake,
  FUNDING: HandCoins,
  EQUIPMENT: Wrench,
  TECHNOLOGY: Globe,
  MARKET_ACCESS: TrendingUp,
  PARTNERSHIP: Users,
  BUSINESS_DEVELOPMENT: Building,
  CAREER_DEVELOPMENT: Award,
  DIGITAL_SKILLS: Globe,
  OTHER: CircleDot,
};

/** Notification severity → icon + colour, used by the notification feed. */
export const SEVERITY_STYLES = {
  info: { icon: CircleAlert, className: 'text-navy-600 bg-navy-50 ring-navy-100' },
  success: { icon: CircleCheck, className: 'text-emerald-700 bg-emerald-50 ring-emerald-100' },
  warning: { icon: CircleAlert, className: 'text-amber-700 bg-amber-50 ring-amber-100' },
  danger: { icon: CircleAlert, className: 'text-red-700 bg-red-50 ring-red-100' },
} as const;

export const CONTACT_MESSAGE_MAX_LENGTH = 2000;

/** Accepted document uploads — mirrored by the storage bucket configuration. */
export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const ACCEPTED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.doc',
  '.docx',
] as const;

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
