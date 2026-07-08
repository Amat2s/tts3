import { describe, expect, it } from 'vitest'
import { pointerSlotCollision } from './dragCollision'

// Two vertically stacked grid cells (a tall multi-slot drag overlaps both).
const cellA = { top: 0, left: 0, right: 100, bottom: 56, width: 100, height: 56 }
const cellB = { top: 56, left: 0, right: 100, bottom: 112, width: 100, height: 56 }

const droppableRects = new Map<string, typeof cellA>([
  ['cellA', cellA],
  ['cellB', cellB],
])
const droppableContainers = [{ id: 'cellA' }, { id: 'cellB' }]

// The drag overlay overlaps cellA more than cellB, so area-based
// rectIntersection would resolve to cellA.
const collisionRect = { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }

type CollisionArgs = Parameters<typeof pointerSlotCollision>[0]

function makeArgs(pointerCoordinates: { x: number; y: number } | null): CollisionArgs {
  return {
    droppableRects,
    droppableContainers,
    collisionRect,
    pointerCoordinates,
    active: { id: 'sess-1', data: { current: undefined }, rect: { current: {} } },
  } as unknown as CollisionArgs
}

// ---------------------------------------------------------------------------
// Drop target resolves to the slot under the pointer, not the card body (Unit 107)
// ---------------------------------------------------------------------------
describe('pointerSlotCollision', () => {
  it('resolves to the cell under the pointer even when the overlay overlaps another cell more', () => {
    // Pointer sits inside cellB; the overlay overlaps cellA more by area.
    const result = pointerSlotCollision(makeArgs({ x: 50, y: 80 }))
    expect(result[0]?.id).toBe('cellB')
  })

  it('falls back to rect intersection when there are no pointer coordinates (keyboard drag)', () => {
    const result = pointerSlotCollision(makeArgs(null))
    // No pointer → area-based fallback picks the greatest-overlap cell (cellA).
    expect(result[0]?.id).toBe('cellA')
  })
})
