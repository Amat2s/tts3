import type { BlockCellInput } from '@/lib/api/timetableBlocks'
import type { SlotId } from './assignment'
import type { BlockedCell } from './blocks'
import type { Day } from './slots'

/**
 * Block selection helpers (Unit 110).
 *
 * Cell selection for block-creation mode mirrors the `/preferences` grid's
 * cell-cycle interaction: clicking a cell toggles it in/out of the pending
 * selection individually (neutral -> selected -> neutral). The selection is an
 * arbitrary set of individually chosen cells — it does not have to be a
 * rectangle and cells do not need to be adjacent. Already-blocked cells can
 * never be selected. A selection spans a single day, matching the current
 * block model: toggling a cell on a different day than the current selection
 * starts a fresh single-cell selection on that day rather than mixing days.
 */

export interface SelectionCell {
  day: Day
  slot: SlotId
  roomId: string
}

export function selectionKey(day: string, roomId: string, slot: string): string {
  return `${day}:${roomId}:${slot}`
}

/**
 * Parse a selection key back into a persistable `{ day, slot, room_id }` cell.
 * The room id is a UUID with no colons, so a simple three-part split is safe.
 */
export function parseSelectionKey(key: string): BlockCellInput {
  const [day, roomId, slot] = key.split(':')
  return {
    day: day as BlockCellInput['day'],
    slot: slot as BlockCellInput['slot'],
    room_id: roomId,
  }
}

// The day the current selection belongs to, or null when the selection is
// empty. All keys in a selection always share the same day (see toggleCellSelection).
export function selectionDay(selected: Set<string>): Day | null {
  const first = selected.values().next().value as string | undefined
  if (!first) return null
  return first.split(':')[0] as Day
}

/**
 * Toggle a single cell's membership in the pending selection. Already-blocked
 * cells are refused (the selection is returned unchanged). Clicking a cell on
 * a different day than the current selection replaces the selection with just
 * that cell, keeping the selection confined to a single day.
 */
export function toggleCellSelection(
  selected: Set<string>,
  cell: SelectionCell,
  blockedCells: Map<string, BlockedCell>
): Set<string> {
  const key = selectionKey(cell.day, cell.roomId, cell.slot)
  if (blockedCells.has(key)) return selected

  const currentDay = selectionDay(selected)
  if (currentDay !== null && currentDay !== cell.day) {
    return new Set([key])
  }

  const next = new Set(selected)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}
