import type { Day } from '@/features/timetable/slots'
import type { SlotId, TimetableAssignment } from '@/features/timetable/assignment'
import type { Room } from '@/lib/api/rooms'
import { SLOT_INDEX, ALL_SLOTS, rangesOverlap } from './slot-helpers'

export type BlockingIssueType =
  | 'room_double_booking'
  | 'room_capacity_too_small'
  | 'session_crossing_lunch'
  | 'session_off_timetable'

export interface BlockingIssue {
  type: BlockingIssueType
  severity: 'blocking'
  affected_session_ids: string[]
  affected_room_id?: string
  affected_day?: Day
  affected_slot?: SlotId
  message: string
}

// s1–s3 are AM (indices 0–2), s4–s7 are PM (indices 3–6)
const LAST_AM_INDEX = 2
const FIRST_PM_INDEX = 3

function isOffTimetable(startSlot: SlotId, duration: number): boolean {
  return SLOT_INDEX[startSlot] + duration > ALL_SLOTS.length
}

function crossesLunch(startSlot: SlotId, duration: number): boolean {
  const start = SLOT_INDEX[startSlot]
  const end = start + duration - 1
  return start <= LAST_AM_INDEX && end >= FIRST_PM_INDEX
}

export function checkProposedPlacement(
  proposed: TimetableAssignment,
  existingDraft: TimetableAssignment[],
  rooms: Room[]
): BlockingIssue[] {
  const issues: BlockingIssue[] = []

  if (isOffTimetable(proposed.start_slot, proposed.duration)) {
    issues.push({
      type: 'session_off_timetable',
      severity: 'blocking',
      affected_session_ids: [proposed.session_id],
      affected_day: proposed.day,
      affected_slot: proposed.start_slot,
      message: 'Session runs past the end of the timetable.',
    })
  }

  if (crossesLunch(proposed.start_slot, proposed.duration)) {
    issues.push({
      type: 'session_crossing_lunch',
      severity: 'blocking',
      affected_session_ids: [proposed.session_id],
      affected_day: proposed.day,
      affected_slot: proposed.start_slot,
      message: 'Session spans the lunch break.',
    })
  }

  const room = rooms.find((r) => r.id === proposed.room_id)
  if (room && proposed.student_count > room.capacity) {
    issues.push({
      type: 'room_capacity_too_small',
      severity: 'blocking',
      affected_session_ids: [proposed.session_id],
      affected_room_id: proposed.room_id,
      message: `Room capacity (${room.capacity}) is too small for ${proposed.student_count} students.`,
    })
  }

  // Exclude the session being moved so a move doesn't conflict with its own old position
  const others = existingDraft.filter((a) => a.session_id !== proposed.session_id)
  for (const other of others) {
    if (
      other.day === proposed.day &&
      other.room_id === proposed.room_id &&
      rangesOverlap(proposed.start_slot, proposed.duration, other.start_slot, other.duration)
    ) {
      issues.push({
        type: 'room_double_booking',
        severity: 'blocking',
        affected_session_ids: [proposed.session_id, other.session_id],
        affected_room_id: proposed.room_id,
        affected_day: proposed.day,
        message: 'Room is already occupied by another session at that time.',
      })
      break
    }
  }

  return issues
}

export function checkDraftForBlockingViolations(
  draft: TimetableAssignment[],
  rooms: Room[]
): BlockingIssue[] {
  const issues: BlockingIssue[] = []
  const roomMap = new Map(rooms.map((r) => [r.id, r]))

  for (const a of draft) {
    if (isOffTimetable(a.start_slot, a.duration)) {
      issues.push({
        type: 'session_off_timetable',
        severity: 'blocking',
        affected_session_ids: [a.session_id],
        affected_day: a.day,
        affected_slot: a.start_slot,
        message: 'Session runs past the end of the timetable.',
      })
    }

    if (crossesLunch(a.start_slot, a.duration)) {
      issues.push({
        type: 'session_crossing_lunch',
        severity: 'blocking',
        affected_session_ids: [a.session_id],
        affected_day: a.day,
        affected_slot: a.start_slot,
        message: 'Session spans the lunch break.',
      })
    }

    const room = roomMap.get(a.room_id)
    if (room && a.student_count > room.capacity) {
      issues.push({
        type: 'room_capacity_too_small',
        severity: 'blocking',
        affected_session_ids: [a.session_id],
        affected_room_id: a.room_id,
        message: `Room capacity (${room.capacity}) is too small for ${a.student_count} students.`,
      })
    }
  }

  for (let i = 0; i < draft.length; i++) {
    for (let j = i + 1; j < draft.length; j++) {
      const a = draft[i]
      const b = draft[j]
      if (
        a.day === b.day &&
        a.room_id === b.room_id &&
        rangesOverlap(a.start_slot, a.duration, b.start_slot, b.duration)
      ) {
        issues.push({
          type: 'room_double_booking',
          severity: 'blocking',
          affected_session_ids: [a.session_id, b.session_id],
          affected_room_id: a.room_id,
          affected_day: a.day,
          message: 'Two sessions are assigned to the same room at the same time.',
        })
      }
    }
  }

  return issues
}

export function getBlockingViolatorIds(
  draft: TimetableAssignment[],
  rooms: Room[]
): Set<string> {
  const issues = checkDraftForBlockingViolations(draft, rooms)
  const ids = new Set<string>()
  for (const issue of issues) {
    for (const id of issue.affected_session_ids) {
      ids.add(id)
    }
  }
  return ids
}
