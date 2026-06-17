import type { Day } from '@/features/timetable/slots'
import type { SlotId, TimetableAssignment } from '@/features/timetable/assignment'
import type { Lecturer, AvailabilityDay } from '@/lib/api/lecturers'
import { slotLabel } from '@/lib/slot-label'
import { SLOT_INDEX, ALL_SLOTS, rangesOverlap } from './slot-helpers'

// Unit 67: `unit_session_overlap` was removed as an independent warning type.
// Shared allocated students now determine session-overlap conflicts, so two
// sessions of the same unit only conflict when their allocation sets intersect.
export type WarningIssueType =
  | 'lecturer_overlap'
  | 'student_overlap'
  | 'lecturer_unavailable'

export interface WarningIssue {
  type: WarningIssueType
  severity: 'warning'
  affected_session_ids: string[]
  affected_lecturer_id?: string
  affected_student_ids?: string[]
  affected_day?: Day
  affected_slot?: SlotId
  message: string
}

function occupiedSlotIds(startSlot: SlotId, duration: number): SlotId[] {
  const startIdx = SLOT_INDEX[startSlot]
  return ALL_SLOTS.slice(startIdx, startIdx + duration)
}

// Intersection of two allocated-student sets, without revealing which hidden
// allocation group the students belong to.
function sharedStudentIds(
  a: TimetableAssignment,
  b: TimetableAssignment
): string[] {
  const ids = a.allocated_student_ids
  const other = b.allocated_student_ids
  if (ids.length === 0 || other.length === 0) return []
  const otherSet = new Set(other)
  return ids.filter((id) => otherSet.has(id))
}

export function checkDraftForWarnings(
  draft: TimetableAssignment[],
  lecturers?: Lecturer[]
): WarningIssue[] {
  const issues: WarningIssue[] = []

  const lecturerById = new Map<string, Lecturer>()
  if (lecturers) {
    for (const l of lecturers) {
      lecturerById.set(l.id, l)
    }
  }

  // Pairwise overlap checks
  for (let i = 0; i < draft.length; i++) {
    for (let j = i + 1; j < draft.length; j++) {
      const a = draft[i]
      const b = draft[j]

      if (a.day !== b.day) continue
      if (!rangesOverlap(a.start_slot, a.duration, b.start_slot, b.duration)) continue

      // Lecturer overlap is keyed on the session-level lecturer id, not the
      // display name — two sessions belonging to units with the same teaching
      // team must NOT conflict unless the same lecturer actually teaches both.
      if (a.lecturer_id && b.lecturer_id && a.lecturer_id === b.lecturer_id) {
        issues.push({
          type: 'lecturer_overlap',
          severity: 'warning',
          affected_session_ids: [a.session_id, b.session_id],
          affected_lecturer_id: a.lecturer_id,
          affected_day: a.day,
          message: `${a.lecturer_display_name} is teaching two sessions at the same time on ${a.day}.`,
        })
      }

      // Student overlap is the intersection of the two sessions' allocated
      // students. This subsumes the old unit/session overlap: a lecture and a
      // tutorial of the same unit conflict only through shared students, and two
      // tutorials of the same unit can overlap when their groups are disjoint.
      const shared = sharedStudentIds(a, b)
      if (shared.length > 0) {
        issues.push({
          type: 'student_overlap',
          severity: 'warning',
          affected_session_ids: [a.session_id, b.session_id],
          affected_student_ids: shared,
          affected_day: a.day,
          message: `${a.unit_code} and ${b.unit_code} share ${
            shared.length === 1 ? 'a student' : 'students'
          } scheduled at the same time on ${a.day}.`,
        })
      }
    }
  }

  // Lecturer availability checks — find the lecturer by session-level id.
  for (const a of draft) {
    if (!a.lecturer_id) continue
    const lecturer = lecturerById.get(a.lecturer_id)
    if (!lecturer) continue

    const occupied = occupiedSlotIds(a.start_slot, a.duration)
    for (const slot of occupied) {
      if (
        lecturer.unavailable_slots.some(
          (e) => e.day === (a.day as AvailabilityDay) && e.slot === slot
        )
      ) {
        issues.push({
          type: 'lecturer_unavailable',
          severity: 'warning',
          affected_session_ids: [a.session_id],
          affected_lecturer_id: a.lecturer_id,
          affected_day: a.day,
          affected_slot: slot,
          message: `${a.lecturer_display_name} is marked unavailable on ${a.day} at ${slotLabel(slot)}.`,
        })
        break
      }
    }
  }

  return issues
}

export function getWarningSessionIds(
  draft: TimetableAssignment[],
  lecturers?: Lecturer[]
): Set<string> {
  const issues = checkDraftForWarnings(draft, lecturers)
  const ids = new Set<string>()
  for (const issue of issues) {
    for (const id of issue.affected_session_ids) {
      ids.add(id)
    }
  }
  return ids
}
