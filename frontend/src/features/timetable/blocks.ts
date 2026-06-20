import type { AvailabilityDay, AvailabilitySlot } from '@/lib/api/lecturers'
import type { TimetableBlock, TimetableBlockColour } from '@/lib/api/timetableBlocks'

// A single blocked cell, flattened out of its block group and carrying the
// group's display attributes so the grid can render it directly.
export interface BlockedCell {
  blockId: string
  name: string | null
  colour: TimetableBlockColour | null
  day: AvailabilityDay
  slot: AvailabilitySlot
  room_id: string
}

/**
 * Flatten block groups into a cell lookup keyed by `day:room_id:slot` — the same
 * key shape the timetable grid uses for assignments. Because the backend enforces
 * a unique `(day, slot, room_id)`, at most one block can own any given cell.
 */
export function buildBlockedCellMap(
  blocks: TimetableBlock[]
): Map<string, BlockedCell> {
  const map = new Map<string, BlockedCell>()
  for (const block of blocks) {
    for (const cell of block.cells) {
      map.set(`${cell.day}:${cell.room_id}:${cell.slot}`, {
        blockId: block.id,
        name: block.name,
        colour: block.colour,
        day: cell.day,
        slot: cell.slot,
        room_id: cell.room_id,
      })
    }
  }
  return map
}

export interface BlockColorTokens {
  background: string
  border: string
  text: string
}

// Grey/disabled set used for unnamed blocks and any missing/unknown colour.
const BLOCK_EMPTY_TOKENS: BlockColorTokens = {
  background: 'var(--block-empty-bg)',
  border: 'var(--block-empty-border)',
  text: 'var(--block-empty-text)',
}

const BLOCK_COLOUR_TOKENS: Record<TimetableBlockColour, BlockColorTokens> = {
  gold: {
    background: 'var(--block-gold-bg)',
    border: 'var(--block-gold-border)',
    text: 'var(--block-gold-text)',
  },
  light_blue: {
    background: 'var(--block-blue-bg)',
    border: 'var(--block-blue-border)',
    text: 'var(--block-blue-text)',
  },
  light_pink: {
    background: 'var(--block-pink-bg)',
    border: 'var(--block-pink-border)',
    text: 'var(--block-pink-text)',
  },
}

/**
 * Resolve the colour tokens for a block. Unnamed blocks (no colour) and any
 * missing/unknown colour fall back to the grey `--block-empty-*` set.
 */
export function getBlockColorTokens(
  colour: TimetableBlockColour | null | undefined
): BlockColorTokens {
  if (!colour) return BLOCK_EMPTY_TOKENS
  return BLOCK_COLOUR_TOKENS[colour] ?? BLOCK_EMPTY_TOKENS
}

/**
 * For each block group + slot combination that spans multiple adjacent room
 * columns, compute which cell is the visual "anchor" (leftmost room) and how
 * many columns it should span, and which cells should be visually suppressed
 * (covered by the anchor's merged card).
 *
 * Returns:
 * - `anchorSpanMap`: keys are `day:room_id:slot`; values are the room-column
 *   span count (≥ 2 — only entries that actually span multiple rooms are
 *   included; single-room cells are left out).
 * - `suppressSet`: keys are `day:room_id:slot` for non-anchor blocked cells
 *   that are visually covered by an anchor's merged card and should not render
 *   their own `BlockCellCard`.
 *
 * Non-consecutive room groups (a gap in the room index) produce independent
 * runs and are each handled separately.  In practice block selection always
 * produces a contiguous rectangle, but the function is robust to gaps.
 */
export function buildBlockAnchorData(
  blockedCells: Map<string, BlockedCell>,
  rooms: { id: string }[]
): { anchorSpanMap: Map<string, number>; suppressSet: Set<string> } {
  const roomIndexMap = new Map(rooms.map((r, i) => [r.id, i]))

  // Group cells by (blockId, day, slot) — each entry is the list of rooms that
  // share this block group at this specific slot row.
  type Entry = {
    roomIdx: number
    room_id: string
    day: string
    slot: string
  }
  const groups = new Map<string, Entry[]>()

  for (const cell of blockedCells.values()) {
    const rIdx = roomIndexMap.get(cell.room_id)
    if (rIdx === undefined) continue
    const gk = `${cell.blockId}::${cell.day}::${cell.slot}`
    const list = groups.get(gk)
    const entry: Entry = {
      roomIdx: rIdx,
      room_id: cell.room_id,
      day: cell.day,
      slot: cell.slot,
    }
    if (list) {
      list.push(entry)
    } else {
      groups.set(gk, [entry])
    }
  }

  const anchorSpanMap = new Map<string, number>()
  const suppressSet = new Set<string>()

  for (const roomList of groups.values()) {
    if (roomList.length <= 1) continue
    roomList.sort((a, b) => a.roomIdx - b.roomIdx)

    // Walk consecutive runs and record anchor + suppressed cells for each run.
    let runStart = 0
    for (let i = 1; i <= roomList.length; i++) {
      const isRunEnd =
        i === roomList.length ||
        roomList[i].roomIdx !== roomList[i - 1].roomIdx + 1
      if (isRunEnd) {
        const run = roomList.slice(runStart, i)
        if (run.length > 1) {
          const { day, slot } = run[0]
          anchorSpanMap.set(`${day}:${run[0].room_id}:${slot}`, run.length)
          for (let j = 1; j < run.length; j++) {
            suppressSet.add(`${day}:${run[j].room_id}:${slot}`)
          }
        }
        runStart = i
      }
    }
  }

  return { anchorSpanMap, suppressSet }
}
