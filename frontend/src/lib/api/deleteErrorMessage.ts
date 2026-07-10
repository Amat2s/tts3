import { ApiRequestError } from '@/lib/api/client'

/**
 * Shown when a blocked delete carries no structured backend reason (Unit 112).
 */
export const GENERIC_DELETE_BLOCKED_MESSAGE = "Couldn't delete — it's still in use."

/**
 * Extracts the backend's structured delete-blocked reason (the Unit 111
 * `{error:{code,message}}` 409 envelope) from a failed delete mutation,
 * falling back to a generic non-technical reason only when no structured
 * message is present.
 */
export function deleteBlockedMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    const detail = err.detail as { error?: { message?: unknown } } | null | undefined
    const structured =
      typeof detail?.error?.message === 'string' ? detail.error.message.trim() : ''
    if (structured.length > 0) return structured
  }
  return GENERIC_DELETE_BLOCKED_MESSAGE
}
