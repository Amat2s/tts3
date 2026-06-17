/**
 * Slot label utility (Unit 73).
 *
 * Centralizes conversion of raw timetable slot IDs (e.g. `s4`) into the human
 * time range shown to users (e.g. `1:30-2:20`). The timetable slot definitions
 * in `features/timetable/slots.ts` are the single source of truth — validation
 * and details display must use these helpers rather than duplicating hardcoded
 * slot labels or surfacing raw slot IDs.
 */
import { TIME_SLOTS } from '@/features/timetable/slots'
import type { SlotId } from '@/features/timetable/assignment'

const LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  TIME_SLOTS.map((s) => [s.id, s.label])
)

/**
 * Human time range for a slot ID (e.g. `s4` -> `1:30-2:20`). Falls back to the
 * raw ID for unknown values so callers never crash on unexpected data.
 */
export function slotLabel(slotId: SlotId | string): string {
  return LABEL_BY_ID[slotId] ?? slotId
}

/** Human time ranges for a list of slot IDs, preserving order. */
export function slotLabels(slotIds: (SlotId | string)[]): string[] {
  return slotIds.map(slotLabel)
}

/**
 * Format affected slots for a validation message, e.g.
 *   ['s4']             -> "1:30-2:20"
 *   ['s4', 's5']       -> "1:30-2:20 and 2:30-3:20"
 *   ['s4', 's5', 's6'] -> "1:30-2:20, 2:30-3:20, and 3:30-4:20"
 */
export function formatAffectedSlots(slotIds: (SlotId | string)[]): string {
  const labels = slotLabels(slotIds)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}
