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
