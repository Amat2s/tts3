import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockCellCard } from './BlockCellCard'
import { SLOT_HEIGHT_REM } from './slots'
import type { BlockedCell } from './blocks'

const BLOCK: BlockedCell = {
  blockId: 'blk-1',
  name: 'Chapel',
  colour: null,
  day: 'Monday',
  slot: 's1',
  room_id: 'room-1',
}

function renderBlock(props: { roomSpan?: number; slotSpan?: number }) {
  render(<BlockCellCard block={BLOCK} {...props} />)
  return screen.getByText('Chapel').closest('div[style]') as HTMLElement
}

// ---------------------------------------------------------------------------
// Block height: +1px per extra slot-ROW only; multi-room spans get no height
// change from this rule (Unit 107).
// ---------------------------------------------------------------------------
describe('BlockCellCard — vertical span height', () => {
  it('a 2-slot-row block is 2 × slotHeight + 1px, mirroring session cards', () => {
    const card = renderBlock({ slotSpan: 2 })
    expect(card).toHaveStyle({ height: `calc(2 * ${SLOT_HEIGHT_REM}rem + 1px)` })
  })

  it('a 3-slot-row block is 3 × slotHeight + 2px', () => {
    const card = renderBlock({ slotSpan: 3 })
    expect(card).toHaveStyle({ height: `calc(3 * ${SLOT_HEIGHT_REM}rem + 2px)` })
  })

  it('a multi-room, single-row block gets no explicit height (unchanged)', () => {
    const card = renderBlock({ roomSpan: 2, slotSpan: 1 })
    expect(card.style.height).toBe('')
  })

  it('a single-cell block gets no explicit height (unchanged)', () => {
    const card = renderBlock({})
    expect(card.style.height).toBe('')
  })
})
