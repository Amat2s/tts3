import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'

/**
 * Resolve the drop target to the grid cell directly under the pointer.
 *
 * dnd-kit's default `rectIntersection` picks the droppable with the greatest
 * area overlap with the drag overlay. For a tall multi-slot card that anchors
 * the target to wherever the card body overlaps most, not the cursor, so the
 * session dropped into a slot offset from the pointer. `pointerWithin` instead
 * returns the droppable whose rectangle contains the pointer coordinates, so the
 * target/hovered slot always sits under the mouse.
 *
 * Keyboard dragging has no pointer coordinates, so `pointerWithin` yields no
 * collisions; we fall back to `rectIntersection` to keep keyboard drag working.
 */
export const pointerSlotCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
}
