import type { ZodError } from 'zod';

/**
 * Convert Zod issues into a { field: firstMessage } map for form display.
 *
 * Uses issues directly rather than flatten() so it works with any schema shape,
 * including dynamic objects and unions, and keeps the first message per field
 * (which is the one shown next to the input).
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && !result[key]) {
      result[key] = issue.message;
    }
  }

  return result;
}
