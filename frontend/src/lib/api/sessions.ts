import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { LecturerSummary } from '@/lib/api/units'
import type { YearLevel } from '@/lib/api/students'

// Post-v1 (Unit 60): session types are reduced to lecture and tutorial only.
export type SessionType = 'lecture' | 'tutorial'

export interface Session {
  id: string
  unit_id: string
  session_type: SessionType
  duration: number
  // Unit 59: per-session lecturer. Nullable — a session without a lecturer is
  // simply not schedulable.
  lecturer_id: string | null
  lecturer: LecturerSummary | null
  created_at: string
  updated_at: string
}

export interface SessionCreate {
  session_type: SessionType
  duration: number
  // When omitted and the unit has exactly one team lecturer, the server
  // assigns that lecturer automatically.
  lecturer_id?: string | null
}

export interface SessionUpdate {
  session_type?: SessionType
  duration?: number
  // When supplied, the new lecturer must belong to the unit's teaching team.
  lecturer_id?: string | null
}

export interface SchedulableSession {
  session_id: string
  unit_id: string
  unit_code: string
  unit_name: string
  session_type: SessionType
  duration: number
  lecturer_id: string
  lecturer_display_name: string
  // Unit 60: derived from the hidden session-student allocation rows.
  student_count: number
  // Internal validation payload only — the UI must NOT display tutorial
  // allocation membership; these ids exist so later units can validate
  // student-level placement conflicts.
  allocated_student_ids: string[]
  // Optional until the backend schedulable DTO surfaces it (consumed by the
  // later validation unit). Derived from the parent unit's year level.
  unit_year_level?: YearLevel
}

function parseSessionError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const rawDetail =
      typeof err.detail === 'object' && err.detail !== null
        ? (err.detail as { detail?: unknown }).detail
        : undefined

    const detail =
      typeof rawDetail === 'string'
        ? rawDetail
        : Array.isArray(rawDetail)
          ? rawDetail
              .map((d) =>
                typeof d === 'object' &&
                d !== null &&
                'msg' in d &&
                typeof (d as { msg?: unknown }).msg === 'string'
                  ? (d as { msg: string }).msg
                  : null
              )
              .filter((m): m is string => Boolean(m))
              .join(' ')
          : undefined

    if (err.status === 404) {
      throw new ApiRequestError({ status: 404, message: 'Session or unit not found.', detail: err.detail })
    }
    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid session data.', detail: err.detail })
    }
  }
  throw err
}

export async function listUnitSessions(unitId: string): Promise<Session[]> {
  return apiRequest<Session[]>(`/units/${unitId}/sessions`)
}

export async function createUnitSession(unitId: string, data: SessionCreate): Promise<Session> {
  try {
    return await apiRequest<Session>(`/units/${unitId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseSessionError(err)
  }
}

export async function updateSession(sessionId: string, data: SessionUpdate): Promise<Session> {
  try {
    return await apiRequest<Session>(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseSessionError(err)
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  return apiRequest<void>(`/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function listSchedulableSessions(): Promise<SchedulableSession[]> {
  return apiRequest<SchedulableSession[]>('/sessions/schedulable')
}
