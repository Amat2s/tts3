import { ApiRequestError } from '@/lib/api/client'

/**
 * Normalize any thrown value into a user-facing error message (Unit 50).
 *
 * Centralizes the "what string do we show the user" decision so query/mutation
 * error states stay consistent across the app. Expected API failures carry a
 * specific backend message (`ApiRequestError`); anything else falls back to the
 * supplied actionable message rather than leaking a raw technical string.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message || fallback
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
