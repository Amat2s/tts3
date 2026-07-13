import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { ScheduledSessionCard } from './ScheduledSessionCard'
import { getSubjectTokens } from './unitColors'
import { SLOT_HEIGHT_REM } from './slots'
import { makeAssignment } from '@/test/fixtures'

const TOKENS = getSubjectTokens('HIS101')

function renderCard(duration: number) {
  render(
    <DndContext>
      <ScheduledSessionCard
        assignment={makeAssignment({ duration })}
        colorTokens={TOKENS}
      />
    </DndContext>
  )
  return screen.getByText('HIS101').closest('div[style]') as HTMLElement
}

// ---------------------------------------------------------------------------
// Card height: +1px per extra slot so a multi-slot card fills its rows (Unit 107)
// ---------------------------------------------------------------------------
describe('ScheduledSessionCard — multi-slot height', () => {
  it('a 1-slot card is unchanged (no pixel correction)', () => {
    const card = renderCard(1)
    expect(card).toHaveStyle({ height: `calc(1 * ${SLOT_HEIGHT_REM}rem)` })
  })

  it('a 2-slot card is 2 × slotHeight + 1px', () => {
    const card = renderCard(2)
    expect(card).toHaveStyle({ height: `calc(2 * ${SLOT_HEIGHT_REM}rem + 1px)` })
  })

  it('a 3-slot card is 3 × slotHeight + 2px', () => {
    const card = renderCard(3)
    expect(card).toHaveStyle({ height: `calc(3 * ${SLOT_HEIGHT_REM}rem + 2px)` })
  })
})

// ---------------------------------------------------------------------------
// Seminar labels (Unit 116)
// ---------------------------------------------------------------------------
describe('ScheduledSessionCard — stacked abbreviated label', () => {
  it('renders "SEM A" and "(initials)" on separate lines when an order letter is supplied', () => {
    render(
      <DndContext>
        <ScheduledSessionCard
          assignment={makeAssignment({
            session_type: 'seminar',
            lecturer_display_name: 'Dr. Ada Lovelace',
          })}
          colorTokens={TOKENS}
          orderLetter="A"
        />
      </DndContext>
    )
    expect(screen.getByText('SEM A')).toBeInTheDocument()
    expect(screen.getByText('(AL)')).toBeInTheDocument()
  })

  it('renders "SEM" with no letter when it is the only seminar in its unit', () => {
    render(
      <DndContext>
        <ScheduledSessionCard
          assignment={makeAssignment({
            session_type: 'seminar',
            lecturer_display_name: 'Dr. Ada Lovelace',
          })}
          colorTokens={TOKENS}
        />
      </DndContext>
    )
    expect(screen.getByText('SEM')).toBeInTheDocument()
    expect(screen.getByText('(AL)')).toBeInTheDocument()
  })
})
