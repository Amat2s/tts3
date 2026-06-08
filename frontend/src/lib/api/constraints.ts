import { apiRequest } from '@/lib/api/client'

export type ConstraintViolationType =
  | 'lecturer_conflict'
  | 'student_conflict'
  | 'room_conflict'
  | 'room_capacity'
  | 'lecturer_availability'
  | 'duration_boundary'
  | 'lunch_crossing'

export type ConstraintViolationSeverity = 'error' | 'warning'

export interface ViolationResponse {
  constraint_type: ConstraintViolationType
  severity: ConstraintViolationSeverity
  affected_session_ids: string[]
  affected_room_id: string | null
  affected_lecturer_id: string | null
  affected_student_ids: string[]
  message: string
}

export interface ValidationSummary {
  total: number
  errors: number
  warnings: number
}

export interface ConstraintValidationResponse {
  violations: ViolationResponse[]
  summary: ValidationSummary
}

export async function validateTimetable(): Promise<ConstraintValidationResponse> {
  return apiRequest<ConstraintValidationResponse>('/constraints/validate')
}
