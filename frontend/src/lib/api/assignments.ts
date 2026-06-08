import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { SessionType } from '@/lib/api/sessions'

export type AssignmentDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'

export type AssignmentSlot = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'

export interface AssignmentSessionSummary {
  id: string
  unit_id: string
  session_type: SessionType
  duration: number
  lecturer_id: string
  lecturer_display_name: string
  student_count: number
}

export interface AssignmentUnitSummary {
  id: string
  code: string
  name: string
}

export interface AssignmentRoomSummary {
  id: string
  name: string
}

export interface Assignment {
  id: string
  session_id: string
  room_id: string
  day: AssignmentDay
  start_slot: AssignmentSlot
  created_at: string
  updated_at: string
  session: AssignmentSessionSummary
  unit: AssignmentUnitSummary
  room: AssignmentRoomSummary
}

export interface AssignmentCreate {
  session_id: string
  room_id: string
  day: AssignmentDay
  start_slot: AssignmentSlot
}

export interface AssignmentMove {
  room_id: string
  day: AssignmentDay
  start_slot: AssignmentSlot
}

function parseAssignmentError(err: unknown): never {
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

    if (err.status === 409 || (typeof detail === 'string' && detail.includes('already scheduled'))) {
      throw new ApiRequestError({ status: 409, message: 'This session is already scheduled.', detail: err.detail })
    }
    if (err.status === 404) {
      const msg = typeof detail === 'string' ? detail.toLowerCase() : ''
      if (msg.includes('session')) {
        throw new ApiRequestError({ status: 404, message: 'Session not found.', detail: err.detail })
      }
      if (msg.includes('room')) {
        throw new ApiRequestError({ status: 404, message: 'Room not found.', detail: err.detail })
      }
      if (msg.includes('assignment')) {
        throw new ApiRequestError({ status: 404, message: 'Assignment not found.', detail: err.detail })
      }
      throw new ApiRequestError({ status: 404, message: detail ?? 'Resource not found.', detail: err.detail })
    }
    if (err.status === 422) {
      const msg = typeof detail === 'string' ? detail.toLowerCase() : ''
      if (msg.includes('day')) {
        throw new ApiRequestError({ status: 422, message: 'Invalid day value.', detail: err.detail })
      }
      if (msg.includes('slot')) {
        throw new ApiRequestError({ status: 422, message: 'Invalid slot value.', detail: err.detail })
      }
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid assignment data.', detail: err.detail })
    }
  }
  throw err
}

export async function listAssignments(): Promise<Assignment[]> {
  return apiRequest<Assignment[]>('/assignments')
}

export async function scheduleSession(input: AssignmentCreate): Promise<Assignment> {
  try {
    return await apiRequest<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (err) {
    parseAssignmentError(err)
  }
}

export async function moveAssignment(assignmentId: string, input: AssignmentMove): Promise<Assignment> {
  try {
    return await apiRequest<Assignment>(`/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    })
  } catch (err) {
    parseAssignmentError(err)
  }
}

export async function unscheduleAssignment(assignmentId: string): Promise<void> {
  return apiRequest<void>(`/assignments/${assignmentId}`, { method: 'DELETE' })
}
