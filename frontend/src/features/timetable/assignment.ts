import type { Day } from './slots'
import type { SessionType } from '@/lib/api/sessions'
import type { YearLevel } from '@/lib/api/students'

export type SlotId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'

// Frontend rendering model for a scheduled session.
// Non-overlapping placement is assumed — each (day, room, start_slot) is unique.
// Aligns with the backend assignment DTO.
export interface TimetableAssignment {
  assignment_id?: string
  session_id: string
  unit_id: string
  unit_code: string
  unit_name: string
  session_type: SessionType
  duration: number
  // Session-level lecturer display (Unit 59), used for conflict messages.
  lecturer_display_name: string
  // Session-level lecturer id (Unit 67) — drives lecturer overlap and
  // availability warnings. Optional because the saved assignment DTO does not
  // carry it; present when the placement is sourced from a schedulable session.
  lecturer_id?: string
  // Allocation-derived student count (Unit 60). Used for room-capacity blocking.
  student_count: number
  // Hidden session-student allocation (Unit 60). Internal validation payload —
  // never displayed; drives student-overlap warnings via set intersection.
  allocated_student_ids: string[]
  // Derived from the parent unit's year level. Optional — not surfaced by every
  // source DTO; reserved for later filters.
  unit_year_level?: YearLevel
  day: Day
  start_slot: SlotId
  room_id: string
}
