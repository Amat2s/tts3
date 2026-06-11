import type { Day } from '@/features/timetable/slots'
import type { SlotId, TimetableAssignment } from '@/features/timetable/assignment'
import type { Lecturer, AvailabilityDay } from '@/lib/api/lecturers'
import { SLOT_INDEX, ALL_SLOTS, rangesOverlap } from './slot-helpers'

export type WarningIssueType =
  | 'lecturer_overlap'
  | 'unit_session_overlap'
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

export function checkDraftForWarnings(
  draft: TimetableAssignment[],
  lecturers?: Lecturer[]
): WarningIssue[] {
  const issues: WarningIssue[] = []

  const lecturerByDisplayName = new Map<string, Lecturer>()
  if (lecturers) {
    for (const l of lecturers) {
      lecturerByDisplayName.set(`${l.title} ${l.first_name} ${l.last_name}`, l)
    }
  }

  // Pairwise overlap checks
  for (let i = 0; i < draft.length; i++) {
    for (let j = i + 1; j < draft.length; j++) {
      const a = draft[i]
      const b = draft[j]

      if (a.day !== b.day) continue
      if (!rangesOverlap(a.start_slot, a.duration, b.start_slot, b.duration)) continue

      if (a.lecturer_display_name && a.lecturer_display_name === b.lecturer_display_name) {
        issues.push({
          type: 'lecturer_overlap',
          severity: 'warning',
          affected_session_ids: [a.session_id, b.session_id],
          affected_day: a.day,
          message: `${a.lecturer_display_name} is teaching two sessions at the same time on ${a.day}.`,
        })
      }

      if (a.unit_id === b.unit_id) {
        issues.push({
          type: 'unit_session_overlap',
          severity: 'warning',
          affected_session_ids: [a.session_id, b.session_id],
          affected_day: a.day,
          message: `Two sessions for ${a.unit_code} overlap on ${a.day} — enrolled students have a conflict.`,
        })
      }
    }
  }

  // Lecturer availability checks
  for (const a of draft) {
    const lecturer = lecturerByDisplayName.get(a.lecturer_display_name)
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
          affected_day: a.day,
          affected_slot: slot,
          message: `${a.lecturer_display_name} is marked unavailable on ${a.day} (slot ${slot}).`,
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
