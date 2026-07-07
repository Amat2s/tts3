import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { AvailabilityDay, AvailabilitySlot } from '@/lib/api/lecturers'

// Unit 98/100: a lecturer preference cell holds exactly one level. Neutral
// cells are never stored — a neutral cell is the absence of a row. These string
// values mirror the backend `PreferenceLevel` enum.
export type LecturerPreferenceLevel = 'preferred' | 'avoid'

// A single room-specific preference cell as returned by the backend.
export interface LecturerPreference {
  id: string
  lecturer_id: string
  day: AvailabilityDay
  slot: AvailabilitySlot
  room_id: string
  level: LecturerPreferenceLevel
  created_at: string
  updated_at: string
}

// Cell key (no level) for delete-back-to-neutral.
export interface LecturerPreferenceCell {
  lecturer_id: string
  day: AvailabilityDay
  slot: AvailabilitySlot
  room_id: string
}

// Cell key + level for upsert (create-or-overwrite).
export interface LecturerPreferenceUpsert extends LecturerPreferenceCell {
  level: LecturerPreferenceLevel
}

// Translate structured backend errors into readable messages for the grid. The
// Unit 98 endpoints return `{ error: { code, message } }` envelopes, whose
// message `apiRequest` already surfaces on `err.message`; we keep that specific
// message and only fall back to a canned per-status string for generic failures.
function parsePreferenceError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const isGeneric =
      !err.message || /^Request failed with status/.test(err.message)
    const fallback: Record<number, string> = {
      404: 'Lecturer or room not found.',
      422: 'Invalid preference data.',
      409: 'Unable to save preference.',
    }
    const canned = fallback[err.status]
    if (canned) {
      throw new ApiRequestError({
        status: err.status,
        message: isGeneric ? canned : err.message,
        detail: err.detail,
      })
    }
  }
  throw err
}

export async function listLecturerPreferences(
  lecturerId: string
): Promise<LecturerPreference[]> {
  try {
    return await apiRequest<LecturerPreference[]>(
      `/lecturers/${lecturerId}/preferences`
    )
  } catch (err) {
    parsePreferenceError(err)
  }
}

export async function upsertLecturerPreference(
  cell: LecturerPreferenceUpsert
): Promise<LecturerPreference> {
  try {
    return await apiRequest<LecturerPreference>('/lecturer-preferences', {
      method: 'PUT',
      body: JSON.stringify(cell),
    })
  } catch (err) {
    parsePreferenceError(err)
  }
}

export async function deleteLecturerPreference(
  cell: LecturerPreferenceCell
): Promise<void> {
  try {
    return await apiRequest<void>('/lecturer-preferences', {
      method: 'DELETE',
      body: JSON.stringify(cell),
    })
  } catch (err) {
    parsePreferenceError(err)
  }
}
