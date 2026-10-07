import { getServerSupabase } from '../supabase/server';
import { isSupabaseConfigured } from '../supabase/config';
import type {
  ApplicationChecklist,
  ApplicationDocument,
  ApplicationStatus,
  ApplicationSupportNeed,
  Notification,
  StatusHistoryEntry,
} from '../types';

/**
 * Applicant-owned reads.
 *
 * Every query here runs through the signed-in user's session, so Row Level
 * Security is what keeps one applicant out of another's data. There is no
 * service-role client in this application, by design.
 */

export interface ApplicantApplication {
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
  category_details: Record<string, string | number | null> | null;
  terms_accepted: boolean;
  accuracy_confirmed: boolean;
  review_notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

const APPLICATION_COLUMNS = `
  id, application_number, program_id, category_id, status, current_step, completion_percent,
  full_name, phone, contact_email, date_of_birth, address,
  state_id, lga_id, ward_id, community,
  project_name, project_description, problem_statement, opportunity_statement, current_stage,
  target_beneficiaries, skills, expected_impact, category_details,
  terms_accepted, accuracy_confirmed, review_notes, submitted_at, created_at, updated_at
`;

/** The signed-in applicant's own application for a programme (RLS-scoped). */
export async function getApplicantApplication(
  programId?: number
): Promise<ApplicantApplication | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();

  let query = supabase.from('applications').select(APPLICATION_COLUMNS);

  if (typeof programId === 'number') {
    query = query.eq('program_id', programId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ApplicantApplication>();

  if (error) {
    console.error('getApplicantApplication failed:', error.message);
    return null;
  }
  return data;
}

/**
 * The authoritative completeness state, computed in the database.
 * Returns null if the application is not the caller's own.
 */
export async function getApplicationChecklist(
  applicationId: string
): Promise<ApplicationChecklist | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();

  const { data, error } = await supabase.rpc('get_application_checklist', {
    p_application_id: applicationId,
  });

  if (error) {
    console.error('getApplicationChecklist failed:', error.message);
    return null;
  }
  return (data as ApplicationChecklist) ?? null;
}

export async function getApplicationSupportNeeds(
  applicationId: string
): Promise<ApplicationSupportNeed[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('application_support_needs')
    .select('support_need_id, details, support_needs ( code, name )')
    .eq('application_id', applicationId);

  if (error) {
    console.error('getApplicationSupportNeeds failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ApplicationSupportNeed[];
}

export async function getApplicationDocuments(
  applicationId: string
): Promise<ApplicationDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('application_documents')
    .select(
      'id, application_id, document_type_id, storage_path, file_name, file_size, mime_type, review_status, review_notes, uploaded_at, document_types ( code, name )'
    )
    .eq('application_id', applicationId)
    .is('deleted_at', null)
    .order('uploaded_at', { ascending: false });

  if (error) {
    console.error('getApplicationDocuments failed:', error.message);
    return [];
  }
  return (data ?? []) as unknown as ApplicationDocument[];
}

/** Timeline entries the applicant is allowed to see (reviewer notes excluded). */
export async function getStatusHistory(applicationId: string): Promise<StatusHistoryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('application_status_history')
    .select('id, from_status, to_status, note, created_at')
    .eq('application_id', applicationId)
    .eq('visible_to_applicant', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('getStatusHistory failed:', error.message);
    return [];
  }
  return (data ?? []) as StatusHistoryEntry[];
}

export async function getNotifications(userId: string, limit = 20): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, application_id, type, title, body, action_url, severity, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getNotifications failed:', error.message);
    return [];
  }
  return (data ?? []) as Notification[];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await getServerSupabase();

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}
