import type { SchedulableSession } from '@/lib/api/sessions'
import type { Room } from '@/lib/api/rooms'
import { checkProposedPlacement } from '@/lib/validation/blocking'
import { ALL_SLOTS, SLOT_INDEX } from '@/lib/validation/slot-helpers'
import type { SlotId, TimetableAssignment } from './assignment'
import type { BlockedCell } from './blocks'

export type TimetableGridMetrics = {
  cellWidth: number
  rowHeight: number
}

// Fixed row height matching the h-14 class used in GridCell (3.5rem × 16px = 56px).
export const GRID_ROW_HEIGHT_PX = 56

/**
 * Computes the preview card height in pixels for the given session duration.
 * @param duration - number of time slots the session occupies
 * @param rowHeightPx - measured row height in pixels (falls back to GRID_ROW_HEIGHT_PX)
 */
export function computePreviewHeight(duration: number, rowHeightPx: number): number {
  return duration * rowHeightPx
}

/**
 * Computes the set of droppable keys ("day:roomId:slotId") that should be
 * highlighted while a session is hovered over a target cell.
 *
 * Returns an empty set when:
 * - any input is missing / unparseable
 * - the proposed placement is invalid (blocking violation, incl. a blocked cell)
 * - the slot range would extend past available slots
 */
export function computeHoverHighlightKeys(
  hoverKey: string | null,
  draggingSessionId: string | null,
  schedulableSessions: SchedulableSession[],
  draft: TimetableAssignment[],
  rooms: Room[],
  blockedCells?: Map<string, BlockedCell>
): Set<string> {
  if (!hoverKey || !draggingSessionId) return new Set()

  const parts = hoverKey.split(':')
  if (parts.length < 3) return new Set()
  const [day, roomId, slotId] = parts

  const session = schedulableSessions.find((s) => s.session_id === draggingSessionId)
  if (!session) return new Set()

  const proposed: TimetableAssignment = {
    session_id: session.session_id,
    unit_id: session.unit_id,
    unit_code: session.unit_code,
    unit_name: session.unit_name,
    session_type: session.session_type,
    duration: session.duration,
    lecturer_id: session.lecturer_id,
    lecturer_display_name: session.lecturer_display_name,
    student_count: session.student_count,
    allocated_student_ids: session.allocated_student_ids,
    unit_year_level: session.unit_year_level,
    day: day as TimetableAssignment['day'],
    start_slot: slotId as SlotId,
    room_id: roomId,
  }

  const issues = checkProposedPlacement(proposed, draft, rooms, blockedCells)
  if (issues.length > 0) return new Set()

  const startIdx = SLOT_INDEX[slotId as SlotId]
  if (startIdx === undefined) return new Set()

  const keys = new Set<string>()
  for (let i = 0; i < session.duration; i++) {
    const s = ALL_SLOTS[startIdx + i]
    if (s) keys.add(`${day}:${roomId}:${s}`)
  }
  return keys
}
