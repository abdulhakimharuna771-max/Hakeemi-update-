import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { getServerSupabase } from './supabase/server';
import { isSupabaseConfigured } from './supabase/config';
import type { Profile } from './types';

/**
 * Authentication helpers for Server Components and Server Actions.
 *
 * `proxy.ts` performs an optimistic redirect for unauthenticated visitors, but
 * it is explicitly not the authorisation boundary: every protected page and
 * every server action calls one of these helpers, which validates the session
 * against Supabase Auth and returns the user's own profile only.
 */

export interface SessionContext {
  user: User;
  profile: Profile | null;
  emailVerified: boolean;
}

/** The signed-in user plus their profile, or null when signed out. */
export async function getSession(): Promise<SessionContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await getServerSupabase();

  // getUser() revalidates the JWT with the Auth server — unlike getSession(),
  // it cannot be satisfied by a forged cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, role, full_name, phone, date_of_birth, address, state_id, lga_id, ward_id, community, profile_completion, created_at, updated_at'
    )
    .eq('id', user.id)
    .maybeSingle<Profile>();

  return {
    user,
    profile: profile ?? null,
    emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  };
}

/** Require any signed-in user, verified or not. */
export async function requireUser(redirectTo = '/portal/dashboard'): Promise<SessionContext> {
  if (!isSupabaseConfigured()) redirect('/login?error=not_configured');

  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}

/**
 * Require a signed-in user with a verified email address.
 * Unverified applicants are sent to the verification screen with instructions.
 */
export async function requireVerifiedUser(
  redirectTo = '/portal/dashboard'
): Promise<SessionContext & { profile: Profile }> {
  const session = await requireUser(redirectTo);

  if (!session.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email ?? '')}`);
  }

  if (!session.profile) {
    // Extremely unlikely: the signup trigger creates the profile. Recover by
    // creating it rather than dead-ending the applicant.
    const supabase = await getServerSupabase();
    await supabase
      .from('profiles')
      .upsert({ id: session.user.id }, { onConflict: 'id', ignoreDuplicates: true });

    const { data } = await supabase
      .from('profiles')
      .select(
        'id, role, full_name, phone, date_of_birth, address, state_id, lga_id, ward_id, community, profile_completion, created_at, updated_at'
      )
      .eq('id', session.user.id)
      .maybeSingle<Profile>();

    if (!data) {
      throw new Error('Unable to load your profile. Please sign out and sign in again.');
    }
    return { ...session, profile: data };
  }

  return { ...session, profile: session.profile };
}
