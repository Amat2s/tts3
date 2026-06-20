import type { BlockCellInput } from '@/lib/api/timetableBlocks'
import { ALL_SLOTS, SLOT_INDEX } from '@/lib/validation/slot-helpers'
import type { SlotId } from './assignment'
import type { BlockedCell } from './blocks'
import type { Day } from './slots'

/**
 * Block selection helpers (Unit 86).
 *
 * Cell selection for block-creation mode is room-specific and confined to a
 * single day. The first click sets an anchor; a second click extends the
 * selection into a rectangular range across slot rows and the visible room
 * columns. Already-blocked cells can never be selected. Selection keys use the
 * same `day:roomId:slot` shape as the grid's blocked-cell map and droppable IDs.
 */

export interface SelectionCell {
  day: Day
  slot: SlotId
  roomId: string
}

// A minimal room-column shape: only the id ordering matters for the rectangle.
export interface SelectionRoom {
  id: string
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

/**
 * Compute the rectangular selection between an anchor and a target cell on the
 * same day. The rectangle spans every slot row and every room column between the
 * two corners (inclusive). Already-blocked cells are excluded — they can never
 * be part of a new block. When the two cells are on different days, only the
 * target cell is selected (the caller treats this as a fresh anchor).
 */
export function computeRectangleSelection(
  anchor: SelectionCell,
  target: SelectionCell,
  rooms: SelectionRoom[],
  blockedCells: Map<string, BlockedCell>
): Set<string> {
  if (anchor.day !== target.day) {
    return singleCellSelection(target, blockedCells)
  }

  const anchorSlot = SLOT_INDEX[anchor.slot]
  const targetSlot = SLOT_INDEX[target.slot]
  const anchorRoom = rooms.findIndex((r) => r.id === anchor.roomId)
  const targetRoom = rooms.findIndex((r) => r.id === target.roomId)
  if (
    anchorSlot === undefined ||
    targetSlot === undefined ||
    anchorRoom < 0 ||
    targetRoom < 0
  ) {
    return singleCellSelection(target, blockedCells)
  }

  const slotLo = Math.min(anchorSlot, targetSlot)
  const slotHi = Math.max(anchorSlot, targetSlot)
  const roomLo = Math.min(anchorRoom, targetRoom)
  const roomHi = Math.max(anchorRoom, targetRoom)

  const keys = new Set<string>()
  for (let s = slotLo; s <= slotHi; s++) {
    const slot = ALL_SLOTS[s]
    if (!slot) continue
    for (let r = roomLo; r <= roomHi; r++) {
      const room = rooms[r]
      if (!room) continue
      const key = selectionKey(anchor.day, room.id, slot)
      if (!blockedCells.has(key)) keys.add(key)
    }
  }
  return keys
}

// A single-cell selection, excluding the cell when it is already blocked.
export function singleCellSelection(
  cell: SelectionCell,
  blockedCells: Map<string, BlockedCell>
): Set<string> {
  const key = selectionKey(cell.day, cell.roomId, cell.slot)
  if (blockedCells.has(key)) return new Set()
  return new Set([key])
}
