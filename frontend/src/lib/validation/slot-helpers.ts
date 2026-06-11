import type { SlotId } from '@/features/timetable/assignment'

export const SLOT_INDEX: Record<SlotId, number> = {
  s1: 0,
  s2: 1,
  s3: 2,
  s4: 3,
  s5: 4,
  s6: 5,
  s7: 6,
}

export const ALL_SLOTS: SlotId[] = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']

export function rangesOverlap(
  startA: SlotId,
  durA: number,
  startB: SlotId,
  durB: number
): boolean {
  const idxA = SLOT_INDEX[startA]
  const idxB = SLOT_INDEX[startB]
  return idxA < idxB + durB && idxB < idxA + durA
}
