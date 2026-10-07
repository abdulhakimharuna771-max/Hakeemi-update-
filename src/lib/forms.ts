import type { ApplicationStatus } from './types';

/**
 * Shared form-state types.
 *
 * These live outside the `'use server'` action modules because a server-action
 * file may only export async functions — state constants have to be importable
 * by client components without pulling an object through the action boundary.
 */

/** Result of an authentication action, consumed by useActionState. */
export interface AuthFormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const INITIAL_AUTH_STATE: AuthFormState = { status: 'idle' };

/**
 * Result of a portal action.
 *
 * Failures never discard the applicant's input: the caller keeps its own state
 * and only uses this to report what happened.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; missingFields?: string[]; fieldErrors?: Record<string, string> };

/** Narrow a status to the editable set used across the portal. */
export function isEditableStatus(status: ApplicationStatus | null | undefined): boolean {
  return status === 'DRAFT' || status === 'MORE_INFORMATION_REQUIRED';
}
