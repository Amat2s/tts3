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

// Canonical slot ordering used for consecutive-slot detection.
const SLOT_INDEX: Record<string, number> = {
  s1: 0, s2: 1, s3: 2, s4: 3, s5: 4, s6: 5, s7: 6,
}
const SLOT_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']

/**
 * For each block group, compute the minimal set of visual "rectangles" (one
 * per distinct contiguous slot-run × contiguous room-run combination) and
 * identify which cell is the top-left anchor and how many columns/rows it
 * spans.
 *
 * Returns:
 * - `anchorMap`: keys are `day:room_id:slot` for the top-left cell of each
 *   rectangle; values are `{ roomSpan, slotSpan }` (both ≥ 1, but an entry
 *   is only present when roomSpan > 1 or slotSpan > 1 — i.e. actual merging
 *   is needed).
 * - `suppressSet`: keys are `day:room_id:slot` for all non-anchor cells
 *   covered by a merged rectangle; these cells render no `BlockCellCard`
 *   visually but remain functionally blocked.
 *
 * The algorithm handles gaps in slot or room sequences by treating each
 * contiguous run as an independent rectangle.
 */
export function buildBlockAnchorData(
  blockedCells: Map<string, BlockedCell>,
  rooms: { id: string }[]
): {
  anchorMap: Map<string, { roomSpan: number; slotSpan: number }>
  suppressSet: Set<string>
} {
  const roomIndexMap = new Map(rooms.map((r, i) => [r.id, i]))

  // Step 1: group cells by (blockId, day, room_id) → collect all slot ids.
  type RoomEntry = {
    blockId: string
    day: string
    room_id: string
    roomIdx: number
    slots: string[]
  }
  const byRoomDay = new Map<string, RoomEntry>()

  for (const cell of blockedCells.values()) {
    const roomIdx = roomIndexMap.get(cell.room_id)
    if (roomIdx === undefined) continue
    const key = `${cell.blockId}::${cell.day}::${cell.room_id}`
    const existing = byRoomDay.get(key)
    if (existing) {
      existing.slots.push(cell.slot)
    } else {
      byRoomDay.set(key, {
        blockId: cell.blockId,
        day: cell.day,
        room_id: cell.room_id,
        roomIdx,
        slots: [cell.slot],
      })
    }
  }

  // Step 2: for each (blockId, day, room_id) entry, find consecutive slot runs.
  type SlotRun = {
    blockId: string
    day: string
    room_id: string
    roomIdx: number
    startSlot: string
    startSlotIdx: number
    slotSpan: number
  }
  const allRuns: SlotRun[] = []

  for (const entry of byRoomDay.values()) {
    const sorted = [...entry.slots].sort(
      (a, b) => (SLOT_INDEX[a] ?? 99) - (SLOT_INDEX[b] ?? 99)
    )
    let runStart = 0
    for (let i = 1; i <= sorted.length; i++) {
      const isRunEnd =
        i === sorted.length ||
        (SLOT_INDEX[sorted[i]] ?? 99) !== (SLOT_INDEX[sorted[i - 1]] ?? 99) + 1
      if (isRunEnd) {
        const run = sorted.slice(runStart, i)
        allRuns.push({
          blockId: entry.blockId,
          day: entry.day,
          room_id: entry.room_id,
          roomIdx: entry.roomIdx,
          startSlot: run[0],
          startSlotIdx: SLOT_INDEX[run[0]] ?? 0,
          slotSpan: run.length,
        })
        runStart = i
      }
    }
  }

  // Step 3: group slot runs by (blockId, day, startSlotIdx, slotSpan) —
  // runs that share the same block/day/start/span form a horizontal merge group.
  const runGroups = new Map<string, SlotRun[]>()
  for (const run of allRuns) {
    const key = `${run.blockId}::${run.day}::${run.startSlotIdx}::${run.slotSpan}`
    const existing = runGroups.get(key)
    if (existing) {
      existing.push(run)
    } else {
      runGroups.set(key, [run])
    }
  }

  // Step 4: within each group, find consecutive room runs → one rectangle each.
  const anchorMap = new Map<string, { roomSpan: number; slotSpan: number }>()
  const suppressSet = new Set<string>()

  for (const runs of runGroups.values()) {
    runs.sort((a, b) => a.roomIdx - b.roomIdx)
    const { day, startSlot, startSlotIdx, slotSpan } = runs[0]

    let roomRunStart = 0
    for (let i = 1; i <= runs.length; i++) {
      const isRunEnd =
        i === runs.length || runs[i].roomIdx !== runs[i - 1].roomIdx + 1
      if (isRunEnd) {
        const roomRun = runs.slice(roomRunStart, i)
        const roomSpan = roomRun.length

        if (roomSpan > 1 || slotSpan > 1) {
          const anchorKey = `${day}:${roomRun[0].room_id}:${startSlot}`
          anchorMap.set(anchorKey, { roomSpan, slotSpan })

          // Suppress every cell in the rectangle except the anchor.
          for (const room of roomRun) {
            for (let si = 0; si < slotSpan; si++) {
              const slotId = SLOT_IDS[startSlotIdx + si]
              if (!slotId) continue
              const cellKey = `${day}:${room.room_id}:${slotId}`
              if (cellKey !== anchorKey) suppressSet.add(cellKey)
            }
          }
        }

        roomRunStart = i
      }
    }
  }

  return { anchorMap, suppressSet }
}
