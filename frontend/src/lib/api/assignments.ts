import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { AvailabilityDay, AvailabilitySlot } from '@/lib/api/lecturers'
import type { SessionType } from '@/lib/api/sessions'

export interface AssignmentResponse {
  assignment_id: string
  session_id: string
  unit_id: string
  unit_code: string
  unit_name: string
  session_type: SessionType
  duration: number
  lecturer_display_name: string
  student_count: number
  day: AvailabilityDay
  start_slot: AvailabilitySlot
  room_id: string
  created_at: string
  updated_at: string
}

export interface AssignmentItem {
  session_id: string
  day: AvailabilityDay
  start_slot: AvailabilitySlot
  room_id: string
}

export interface AssignmentSaveRequest {
  assignments: AssignmentItem[]
}

function parseAssignmentSaveError(err: unknown): never {
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
      throw new ApiRequestError({ status: 404, message: detail ?? 'Session or room not found.', detail: err.detail })
    }
    if (err.status === 409) {
      throw new ApiRequestError({ status: 409, message: detail ?? 'Assignment conflict detected.', detail: err.detail })
    }
    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid assignment data.', detail: err.detail })
    }
  }
  throw err
}

export async function listAssignments(): Promise<AssignmentResponse[]> {
  return apiRequest<AssignmentResponse[]>('/assignments')
}

export async function saveAssignments(input: AssignmentSaveRequest): Promise<AssignmentResponse[]> {
  try {
    return await apiRequest<AssignmentResponse[]>('/assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch (err) {
    parseAssignmentSaveError(err)
  }
}

export async function clearAssignments(): Promise<void> {
  return apiRequest<void>('/assignments', { method: 'DELETE' })
}
