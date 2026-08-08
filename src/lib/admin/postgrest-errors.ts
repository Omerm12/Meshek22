/**
 * Telling "this object has not been deployed yet" apart from a real failure.
 *
 * Lives in its own module so the counts loader and the order queries can both
 * use it without importing each other.
 */

/** The subset of a PostgREST / Postgres error we reason about. */
export interface PostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Codes that mean the function, table or column does not exist — i.e. a
 * migration has not been applied — as opposed to something being broken.
 */
const MISSING_OBJECT_CODES = new Set([
  "PGRST202", // function not found in schema cache
  "PGRST205", // table not found in schema cache
  "42883",    // undefined_function
  "42P01",    // undefined_table
  "42703",    // undefined_column
]);

export function isMissingObjectError(error: PostgrestErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING_OBJECT_CODES.has(error.code)) return true;
  // Some PostgREST builds report the condition only in the message.
  const message = error.message ?? "";
  return /could not find the (function|table)/i.test(message);
}
