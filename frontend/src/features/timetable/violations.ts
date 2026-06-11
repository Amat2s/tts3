export type ViolationSeverity = 'error' | 'warning'

export type ViolationType =
  | 'lecturer_conflict'
  | 'student_conflict'
  | 'room_conflict'
  | 'room_capacity'
  | 'lecturer_availability'
  | 'duration_boundary'
  | 'lunch_crossing'

export interface ConstraintViolation {
  constraint_type: ViolationType
  severity: ViolationSeverity
  affected_session_ids: string[]
  affected_room_id: string | null
  affected_lecturer_id: string | null
  affected_student_ids: string[]
  message: string
}
