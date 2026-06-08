import type { Day } from './slots'
import type { SessionType } from '@/lib/api/sessions'

export type SlotId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'

// Frontend rendering model for a scheduled session.
// Non-overlapping placement is assumed — each (day, room, start_slot) is unique.
// Aligns with the future backend assignment DTO (Unit 32).
export interface TimetableAssignment {
  assignment_id?: string
  session_id: string
  unit_id: string
  unit_code: string
  unit_name: string
  session_type: SessionType
  duration: number
  lecturer_display_name: string
  student_count: number
  day: Day
  start_slot: SlotId
  room_id: string
}
