import { describe, expect, it } from 'vitest'
import {
  EXTENDED_MIN_COL_PX,
  GRID_TIME_COL_PX,
  extendedGridMinWidth,
} from './gridView'

// Unit 108: the extended layout was halved (~2× narrower) so it is less
// aggressive while still overflowing the container for horizontal scroll.
describe('extendedGridMinWidth (Unit 108 halved extended width)', () => {
  it('uses the halved per-column minimum width', () => {
    expect(EXTENDED_MIN_COL_PX).toBe(46)
  })

  it('is the time column plus one min-width column per visible day × room', () => {
    // 5 days × 8 rooms at the halved 46px, plus the fixed time column.
    expect(extendedGridMinWidth(5, 8)).toBe(GRID_TIME_COL_PX + 5 * 8 * 46)
  })

  it('still widens past a typical container (dense timetable overflows)', () => {
    // A dense many-room timetable is still wider than a common ~1024px viewport,
    // so the grid container remains horizontally scrollable.
    expect(extendedGridMinWidth(5, 8)).toBeGreaterThan(1024)
  })
})
