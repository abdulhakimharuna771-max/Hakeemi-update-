/**
 * Typed database models.
 *
 * These mirror the SQL in supabase/migrations. Keep them in step with the
 * schema — the future Patron Dashboard can import the same types.
 */

export type UserRole = 'applicant' | 'admin' | 'super_admin';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFORMATION_REQUIRED'
  | 'SHORTLISTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_DEVELOPMENT'
  | 'COMPLETED';

export type LocationLevel = 'state' | 'lga' | 'ward' | 'community';

export type NotificationType =
  | 'GENERAL'
  | 'APPLICATION_SUBMITTED'
  | 'APPLICATION_RECEIVED'
  | 'STATUS_CHANGED'
  | 'INFORMATION_REQUIRED'
  | 'SHORTLISTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DOCUMENT_UPDATE'
  | 'PROGRAM_ANNOUNCEMENT';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'progress';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address: string | null;
  state_id: number | null;
  lga_id: number | null;
  ward_id: number | null;
  community: string | null;
  profile_completion: number;
  created_at: string;
  updated_at: string;
}

export interface ApplicantCategory {
  id: number;
  code: string;
  name: string;
  short_description: string | null;
  description: string | null;
  icon: string | null;
  form_variant: string;
  detail_schema: CategoryDetailField[];
  sort_order: number;
}

/** One descriptor inside applicant_categories.detail_schema. */
export interface CategoryDetailField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
}

export interface SupportNeed {
  id: number;
  code: string;
  name: string;
  description: string | null;
  requires_details: boolean;
  sort_order: number;
}

export interface DocumentType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_required: boolean;
  applies_to_categories: string[] | null;
  max_size_mb: number;
  sort_order: number;
}

export interface Program {
  id: number;
  code: string;
  name: string;
  summary: string | null;
  description: string | null;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
  focus_areas: string[] | null;
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
}

export interface ApplicationStatusRow {
  code: ApplicationStatus;
  label: string;
  description: string | null;
  sort_order: number;
  tone: StatusTone;
  visible_to_applicant: boolean;
  is_terminal: boolean;
  is_initial: boolean;
}

export interface LocationOption {
  id: number;
  name: string;
}

/**
 * The application shape returned by the save_application_draft and
 * submit_application RPCs. Reviewer-only columns are deliberately absent.
 */
export interface ApplicationDraft {
  id: string;
  application_number: string | null;
  program_id: number;
  category_id: number | null;
  status: ApplicationStatus;
  current_step: number;
  completion_percent: number;
  full_name: string | null;
  phone: string | null;
  contact_email: string | null;
  date_of_birth: string | null;
  address: string | null;
  state_id: number | null;
  lga_id: number | null;
  ward_id: number | null;
  community: string | null;
  project_name: string | null;
  project_description: string | null;
  problem_statement: string | null;
  opportunity_statement: string | null;
  current_stage: string | null;
  target_beneficiaries: string | null;
  skills: string[] | null;
  expected_impact: string | null;
  category_details: Record<string, string | number | null>;
  terms_accepted: boolean;
  accuracy_confirmed: boolean;
  terms_accepted_at: string | null;
  review_notes: string | null;
  missing_fields: string[] | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistField {
  key: string;
  label: string;
  step: number;
  required: boolean;
  done: boolean;
}

export interface ApplicationChecklist {
  application_id: string;
  status: ApplicationStatus;
  is_editable: boolean;
  completion_percent: number;
  missing_fields: string[];
  fields: ChecklistField[];
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type_id: number | null;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  review_status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  review_notes: string | null;
  uploaded_at: string;
  document_types?: { code: string; name: string } | null;
}

export interface Notification {
  id: string;
  application_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  severity: 'info' | 'success' | 'warning' | 'danger';
  is_read: boolean;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  note: string | null;
  created_at: string;
}

export interface ApplicationSupportNeed {
  support_need_id: number;
  details: string | null;
  support_needs: { code: string; name: string } | null;
}
