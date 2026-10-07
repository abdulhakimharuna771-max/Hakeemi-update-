'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getSession } from '@/lib/auth';
import type { LocationOption } from '@/lib/types';

/**
 * Geography lookups for the cascading State → LGA → Ward selects.
 *
 * Nigeria has 774 local government areas and 8,809 wards, so the whole tree is
 * never sent to the browser. Each level is fetched when its parent changes, and
 * the query is a single indexed read of the immediate children only.
 */

export async function loadChildLocations(
  parentId: number | string
): Promise<{ ok: true; options: LocationOption[] } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'The programme database is not connected.' };

  const session = await getSession();
  if (!session) return { ok: false, error: 'Your session has expired. Please sign in again.' };

  const parent = typeof parentId === 'number' ? parentId : Number.parseInt(String(parentId), 10);
  if (!Number.isFinite(parent) || parent <= 0) return { ok: true, options: [] };

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name')
    .eq('parent_id', parent)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('loadChildLocations failed:', error.message);
    return { ok: false, error: 'Locations could not be loaded. Please try again.' };
  }

  return { ok: true, options: (data ?? []) as LocationOption[] };
}
