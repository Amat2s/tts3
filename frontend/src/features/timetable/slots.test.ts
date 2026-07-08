import { describe, expect, it } from 'vitest'
import { SLOT_HEIGHT_REM, slotSpanHeight } from './slots'

// ---------------------------------------------------------------------------
// slotSpanHeight — +1px per extra slot beyond the first (Unit 107)
// ---------------------------------------------------------------------------
describe('slotSpanHeight', () => {
  it('is unchanged for a single slot (no pixel correction)', () => {
    expect(slotSpanHeight(1)).toBe(`calc(1 * ${SLOT_HEIGHT_REM}rem)`)
  })

  it('adds +1px for a 2-slot card', () => {
    expect(slotSpanHeight(2)).toBe(`calc(2 * ${SLOT_HEIGHT_REM}rem + 1px)`)
  })

  it('adds +2px for a 3-slot card', () => {
    expect(slotSpanHeight(3)).toBe(`calc(3 * ${SLOT_HEIGHT_REM}rem + 2px)`)
  })

  it('adds +(n-1)px for an n-slot card', () => {
    expect(slotSpanHeight(4)).toBe(`calc(4 * ${SLOT_HEIGHT_REM}rem + 3px)`)
  })
})
