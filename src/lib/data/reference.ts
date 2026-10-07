import { cache } from 'react';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type {
  ApplicantCategory,
  ApplicationStatusRow,
  DocumentType,
  LocationOption,
  Program,
  SupportNeed,
} from '@/lib/types';

/**
 * Reference data reads.
 *
 * All of these are world-readable rows (public RLS policies), so the same
 * functions serve the public landing page and the signed-in portal. Results are
 * cached per request by React, which keeps a multi-component page to a single
 * round trip.
 */

export const getActiveCategories = cache(async (): Promise<ApplicantCategory[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('applicant_categories')
    .select('id, code, name, short_description, description, icon, form_variant, detail_schema, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('getActiveCategories failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    detail_schema: Array.isArray(row.detail_schema) ? row.detail_schema : [],
  })) as ApplicantCategory[];
});

export const getActiveSupportNeeds = cache(async (): Promise<SupportNeed[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('support_needs')
    .select('id, code, name, description, requires_details, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('getActiveSupportNeeds failed:', error.message);
    return [];
  }
  return (data ?? []) as SupportNeed[];
});

export const getActiveDocumentTypes = cache(async (): Promise<DocumentType[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('document_types')
    .select('id, code, name, description, is_required, applies_to_categories, max_size_mb, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('getActiveDocumentTypes failed:', error.message);
    return [];
  }
  return (data ?? []) as DocumentType[];
});

/** The programme currently accepting applications, if any. */
export const getOpenProgram = cache(async (): Promise<Program | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('programs')
    .select('id, code, name, summary, description, status, focus_areas, opens_at, closes_at, is_active')
    .eq('status', 'OPEN')
    .eq('is_active', true)
    .order('opens_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle<Program>();

  if (error) {
    console.error('getOpenProgram failed:', error.message);
    return null;
  }
  return data;
});

/** Status metadata used to render the progress tracker. */
export const getApplicationStatuses = cache(async (): Promise<ApplicationStatusRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('application_statuses')
    .select('code, label, description, sort_order, tone, visible_to_applicant, is_terminal, is_initial')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('getApplicationStatuses failed:', error.message);
    return [];
  }
  return (data ?? []) as ApplicationStatusRow[];
});

/** The 37 states (plus the FCT) that top the location cascade. */
export const getStates = cache(async (): Promise<LocationOption[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('level', 'state')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('getStates failed:', error.message);
    return [];
  }
  return (data ?? []) as LocationOption[];
});

/** Resolve display names for up to three geography ids in a single query. */
export async function getLocationNamesByIds(
  ids: (number | null | undefined)[]
): Promise<Map<number, string>> {
  const wanted = [...new Set(ids.filter((id): id is number => typeof id === 'number'))];
  if (wanted.length === 0 || !isSupabaseConfigured()) return new Map();

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.from('locations').select('id, name').in('id', wanted);

  if (error) {
    console.error('getLocationNamesByIds failed:', error.message);
    return new Map();
  }
  return new Map((data ?? []).map((row) => [row.id as number, row.name as string]));
}
