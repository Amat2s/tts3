export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'

export const DAYS: Day[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
]

export type SlotBlock = 'am' | 'pm'

export interface TimeSlot {
  id: string
  label: string
  block: SlotBlock
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: 's1', label: '9:00-9:50', block: 'am' },
  { id: 's2', label: '10:00-10:50', block: 'am' },
  { id: 's3', label: '11:00-11:50', block: 'am' },
  { id: 's4', label: '1:30-2:20', block: 'pm' },
  { id: 's5', label: '2:30-3:20', block: 'pm' },
  { id: 's6', label: '3:30-4:20', block: 'pm' },
  { id: 's7', label: '4:30-5:20', block: 'pm' },
]

export const AM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'am')
export const PM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'pm')

export const LUNCH_LABEL = '12:00-1:30'

// Rendered height of a single grid slot row, in rem. Must match the h-14
// (3.5rem × 16px = 56px) used by GridCell.
export const SLOT_HEIGHT_REM = 3.5

/**
 * CSS height for a card spanning `slotSpan` consecutive slot rows.
 *
 * A multi-slot card gets +1px per extra slot beyond the first so it exactly
 * covers its rows: each row carries a 1px border, so an N-slot card sitting at
 * `N × slotHeight` otherwise falls (N − 1)px short of the rows it spans. Adding
 * `(N − 1)px` closes that gap. Single-slot cards are unchanged (no correction).
 *
 * This is the single source of truth for per-slot card height so scheduled
 * session cards and vertically-merged block cards stay consistent.
 */
export function slotSpanHeight(slotSpan: number): string {
  const base = `${slotSpan} * ${SLOT_HEIGHT_REM}rem`
  const extraPx = Math.max(0, slotSpan - 1)
  return extraPx > 0 ? `calc(${base} + ${extraPx}px)` : `calc(${base})`
}
