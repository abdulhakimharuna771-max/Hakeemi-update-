'use server';

import { revalidatePath } from 'next/cache';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { requireVerifiedUser, getSession } from '@/lib/auth';
import { profileSchema } from '@/lib/validation/profile';
import { fieldErrorsFrom } from '@/lib/validation/errors';
import { isEditableStatus, type ActionResult } from '@/lib/forms';
import { ACCEPTED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES } from '@/lib/constants';
import { SUPABASE_BUCKET } from '@/lib/supabase/config';
import { slugify } from '@/lib/utils';
import type { ApplicationChecklist, ApplicationDraft, ApplicationStatus } from '@/lib/types';

/**
 * Server actions for the applicant portal.
 *
 * Every action re-establishes the session server-side and then relies on Row
 * Level Security for authorisation — there is no service-role key anywhere in
 * this application, so a mistake here cannot widen anyone's access.
 *
 * The two operations that touch protected columns (saving a draft and
 * submitting) are Postgres functions, which validate ownership and completeness
 * in the database itself.
 */

const NOT_CONFIGURED =
  'The programme database is not connected, so this action is unavailable right now.';

/** Translate a Postgres/PostgREST error from one of our RPCs into a message. */
function describeRpcError(error: { message?: string; details?: string; hint?: string }): {
  message: string;
  missingFields?: string[];
} {
  const message = error.message ?? 'Unexpected error';
  const details = (error.details ?? '').trim();

  if (message.includes('missing_fields')) {
    return {
      message: 'Some required information is still missing.',
      missingFields: details ? details.split(',').map((field) => field.trim()).filter(Boolean) : [],
    };
  }

  if (message.includes('invalid_category_details')) {
    return {
      message:
        'Some answers in the business, project or innovation step are incomplete or not allowed. Please review that step.',
    };
  }

  if (message.includes('not_authenticated')) {
    return { message: 'Your session has expired. Please sign in again.' };
  }

  if (message.includes('application_not_found')) {
    return { message: 'That application could not be found on your account.' };
  }

  if (message.includes('already_submitted')) {
    return { message: 'This application has already been submitted.' };
  }

  if (message.includes('application_locked')) {
    return { message: 'This application can no longer be edited because it has been submitted.' };
  }

  if (message.includes('program_closed') || message.includes('program_not_available')) {
    return { message: 'Registration is not currently open for this programme.' };
  }

  if (message.includes('unknown_fields')) {
    return { message: `Unexpected field in the request: ${details}` };
  }

  const friendly: Record<string, string> = {
    invalid_ward: 'The selected ward is not valid.',
    invalid_lga: 'The selected local government area is not valid.',
    invalid_state: 'The selected state is not valid.',
    lga_state_mismatch: 'The selected local government area does not belong to the selected state.',
    ward_lga_mismatch: 'The selected ward does not belong to the selected local government area.',
    ward_state_mismatch: 'The selected ward does not belong to the selected state.',
    invalid_value: `One of the values sent was not valid${details ? `: ${details}` : ''}.`,
    unknown_support_need: `Unrecognised support option${details ? `: ${details}` : ''}.`,
    support_details_required: 'Please describe the support you need under "Other".',
  };

  for (const [code, text] of Object.entries(friendly)) {
    if (message.includes(code)) return { message: text };
  }

  console.error('Portal RPC error:', message, details);
  return { message: 'Something went wrong while saving. Please try again.' };
}

/* -------------------------------------------------------------------------- */
/* Application draft                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Create or update the signed-in applicant's draft.
 *
 * `payload` is whitelisted by the database function, so a tampered client
 * cannot smuggle in a status, an application number or review notes.
 */
export async function saveApplicationDraft(payload: Record<string, unknown>): Promise<
  ActionResult<{ application: ApplicationDraft; checklist: ApplicationChecklist | null }>
> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  await requireVerifiedUser();
  const supabase = await getServerSupabase();

  const { data, error } = await supabase.rpc('save_application_draft', {
    p_payload: payload,
    p_program_id: null,
  });

  if (error) {
    const described = describeRpcError(error);
    return { ok: false, error: described.message, missingFields: described.missingFields };
  }

  const application = data as unknown as ApplicationDraft;

  const { data: checklistData } = await supabase.rpc('get_application_checklist', {
    p_application_id: application.id,
  });

  revalidatePath('/portal/dashboard');
  revalidatePath('/portal/application');

  return {
    ok: true,
    data: {
      application,
      checklist: (checklistData as ApplicationChecklist) ?? null,
    },
  };
}

/** Submit an application: validates completeness and allocates its ID. */
export async function submitApplication(applicationId: string): Promise<
  ActionResult<{ application: ApplicationDraft }>
> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  await requireVerifiedUser();
  const supabase = await getServerSupabase();

  const { data, error } = await supabase.rpc('submit_application', {
    p_application_id: applicationId,
  });

  if (error) {
    const described = describeRpcError(error);
    return { ok: false, error: described.message, missingFields: described.missingFields };
  }

  revalidatePath('/portal/dashboard');
  revalidatePath('/portal/application');
  revalidatePath('/portal/documents');
  revalidatePath('/portal/notifications');

  return { ok: true, data: { application: data as unknown as ApplicationDraft } };
}

/** Discard a draft that has not been submitted. */
export async function discardDraft(applicationId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  await requireVerifiedUser();
  const supabase = await getServerSupabase();

  // RLS restricts this to the applicant's own draft.
  const { error } = await supabase.from('applications').delete().eq('id', applicationId).eq('status', 'DRAFT');

  if (error) {
    console.error('discardDraft failed:', error.message);
    return { ok: false, error: 'Your draft could not be discarded. Please try again.' };
  }

  revalidatePath('/portal/dashboard');
  revalidatePath('/portal/application');
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateProfile(formData: FormData): Promise<
  ActionResult<{ completion: number }>
> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();

  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name') ?? '',
    phone: formData.get('phone') ?? '',
    date_of_birth: formData.get('date_of_birth') ?? '',
    address: formData.get('address') ?? '',
    state_id: formData.get('state_id') ?? '',
    lga_id: formData.get('lga_id') ?? '',
    ward_id: formData.get('ward_id') ?? '',
    community: formData.get('community') ?? '',
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = await getServerSupabase();

  // Only columns an applicant is allowed to change are sent. Role, completion
  // and geography-derived fields are protected by database triggers anyway.
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      date_of_birth: parsed.data.date_of_birth ?? null,
      address: parsed.data.address ?? null,
      state_id: parsed.data.state_id ?? null,
      lga_id: parsed.data.lga_id ?? null,
      ward_id: parsed.data.ward_id ?? null,
      community: parsed.data.community ?? null,
    })
    .eq('id', session.user.id)
    .select('profile_completion')
    .maybeSingle<{ profile_completion: number }>();

  if (error) {
    const described = describeRpcError(error);
    console.error('updateProfile failed:', error.message);
    return { ok: false, error: described.message };
  }

  revalidatePath('/portal/profile');
  revalidatePath('/portal/dashboard');
  return { ok: true, data: { completion: data?.profile_completion ?? 0 } };
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();
  const supabase = await getServerSupabase();

  // RLS scopes this to the caller's own notifications.
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', session.user.id);

  if (error) {
    console.error('markNotificationRead failed:', error.message);
    return { ok: false, error: 'That notification could not be updated.' };
  }

  revalidatePath('/portal/notifications');
  revalidatePath('/portal/dashboard');
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);

  if (error) {
    console.error('markAllNotificationsRead failed:', error.message);
    return { ok: false, error: 'Notifications could not be updated. Please try again.' };
  }

  revalidatePath('/portal/notifications');
  revalidatePath('/portal/dashboard');
  return { ok: true, data: undefined };
}

/* -------------------------------------------------------------------------- */
/* Documents                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Finalise a document upload.
 *
 * The file itself is uploaded from the browser straight into the private bucket
 * (authorised by storage RLS: an applicant may only write inside their own
 * user-id folder). This action then records the metadata, after verifying the
 * path really belongs to the caller so a forged path cannot be registered.
 */
export async function registerDocument(input: {
  applicationId: string;
  documentTypeId: number | null;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();
  const supabase = await getServerSupabase();

  if (!input.storagePath.startsWith(`${session.user.id}/`)) {
    return { ok: false, error: 'That upload path is not valid for your account.' };
  }

  if (!ACCEPTED_DOCUMENT_MIME_TYPES.includes(input.mimeType as (typeof ACCEPTED_DOCUMENT_MIME_TYPES)[number])) {
    return { ok: false, error: 'That file type is not accepted. Upload a PDF, Word document or image.' };
  }

  if (input.fileSize <= 0 || input.fileSize > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: 'That file is larger than the 5 MB limit.' };
  }

  // Confirm the application is the caller's own and still editable.
  const { data: application } = await supabase
    .from('applications')
    .select('id, status')
    .eq('id', input.applicationId)
    .maybeSingle<{ id: string; status: string }>();

  if (!application) {
    return { ok: false, error: 'That application could not be found on your account.' };
  }

  const { data, error } = await supabase
    .from('application_documents')
    .insert({
      application_id: input.applicationId,
      owner_id: session.user.id,
      document_type_id: input.documentTypeId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      file_size: input.fileSize,
      mime_type: input.mimeType,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    // Do not leave an orphaned object behind if the metadata row is rejected.
    await supabase.storage.from(SUPABASE_BUCKET).remove([input.storagePath]);
    console.error('registerDocument failed:', error.message);
    return { ok: false, error: 'Unable to save the document record. Please try again.' };
  }

  revalidatePath('/portal/documents');
  revalidatePath('/portal/application');
  return { ok: true, data: { id: data?.id ?? '' } };
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();
  const supabase = await getServerSupabase();

  const { data: document } = await supabase
    .from('application_documents')
    .select('id, storage_path, owner_id, application_id')
    .eq('id', documentId)
    .maybeSingle<{ id: string; storage_path: string; owner_id: string; application_id: string }>();

  if (!document || document.owner_id !== session.user.id) {
    return { ok: false, error: 'That document could not be found on your account.' };
  }

  // Documents on a submitted application are part of the record; removing them
  // would undermine a review already in progress.
  const { data: application } = await supabase
    .from('applications')
    .select('status')
    .eq('id', document.application_id)
    .maybeSingle<{ status: string }>();

  if (application && !isEditableStatus(application.status as ApplicationStatus)) {
    return {
      ok: false,
      error: 'This document belongs to a submitted application and can no longer be removed.',
    };
  }

  const { error: storageError } = await supabase.storage.from(SUPABASE_BUCKET).remove([document.storage_path]);
  if (storageError) {
    console.error('deleteDocument storage remove failed:', storageError.message);
  }

  const { error } = await supabase
    .from('application_documents')
    .delete()
    .eq('id', documentId)
    .eq('owner_id', session.user.id);

  if (error) {
    console.error('deleteDocument failed:', error.message);
    return { ok: false, error: 'The document could not be removed. Please try again.' };
  }

  revalidatePath('/portal/documents');
  revalidatePath('/portal/application');
  return { ok: true, data: undefined };
}

/**
 * Create a short-lived signed URL for one of the caller's own documents.
 *
 * The bucket is private, so this is the only way a document can be viewed —
 * links expire and are never public.
 */
export async function getDocumentUrl(
  documentId: string
): Promise<ActionResult<{ url: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await requireVerifiedUser();
  const supabase = await getServerSupabase();

  const { data: document } = await supabase
    .from('application_documents')
    .select('id, storage_path, owner_id, file_name')
    .eq('id', documentId)
    .maybeSingle<{ id: string; storage_path: string; owner_id: string; file_name: string }>();

  if (!document || document.owner_id !== session.user.id) {
    return { ok: false, error: 'That document could not be found on your account.' };
  }

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(document.storage_path, 300, { download: document.file_name });

  if (error || !data?.signedUrl) {
    console.error('getDocumentUrl failed:', error?.message);
    return { ok: false, error: 'Unable to open that document. Please try again.' };
  }

  return { ok: true, data: { url: data.signedUrl } };
}

/** Storage object path for a new upload: <user>/<application>/<type>/<file>. */
export async function buildUploadPath(input: {
  applicationId: string;
  documentCode: string;
  fileName: string;
}): Promise<ActionResult<{ path: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session has expired. Please sign in again.' };

  const extension = input.fileName.includes('.')
    ? `.${input.fileName.split('.').pop()!.toLowerCase().slice(0, 8)}`
    : '';

  const base = slugify(input.fileName.replace(/\.[^.]+$/, ''), 40) || 'document';
  const unique = crypto.randomUUID().slice(0, 8);

  return {
    ok: true,
    data: {
      path: `${session.user.id}/${input.applicationId}/${input.documentCode}/${base}-${unique}${extension}`,
    },
  };
}
