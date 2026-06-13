import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { MemoryRouter } from 'react-router-dom'
import { TimetableGrid } from './TimetableGrid'
import { makeAssignment } from '@/test/fixtures'

function renderGrid(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <DndContext>{ui}</DndContext>
    </MemoryRouter>
  )
}

describe('TimetableGrid — room-created grid rendering', () => {
  const rooms = [
    { id: 'room-1', name: 'Room A' },
    { id: 'room-2', name: 'Room B' },
  ]

  it('renders no grid content when there are no rooms', () => {
    renderGrid(<TimetableGrid rooms={[]} />)
    // TimetableGrid returns null for an empty room list — no day headers render.
    expect(screen.queryByText('Monday')).not.toBeInTheDocument()
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument()
  })

  it('renders the weekday headers, room columns, and lunch divider', () => {
    renderGrid(<TimetableGrid rooms={rooms} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    // Each room column header repeats per weekday (5 days).
    expect(screen.getAllByText('Room A')).toHaveLength(5)
    expect(screen.getByText('Lunch')).toBeInTheDocument()
  })

  it('renders a scheduled session card from assignment data', () => {
    const assignments = [
      makeAssignment({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        day: 'Monday',
        start_slot: 's1',
        room_id: 'room-1',
      }),
    ]
    renderGrid(<TimetableGrid rooms={rooms} assignments={assignments} />)
    // The scheduled card shows the unit code.
    expect(screen.getByText('HIS101')).toBeInTheDocument()
  })

  it('flags a scheduled card with a warning indicator when its session has a warning', () => {
    const assignments = [
      makeAssignment({ session_id: 'sess-1', day: 'Monday', start_slot: 's1', room_id: 'room-1' }),
    ]
    renderGrid(
      <TimetableGrid
        rooms={rooms}
        assignments={assignments}
        warningSessionIds={new Set(['sess-1'])}
      />
    )
    // Non-color-only warning indicator (accessible label on the icon).
    expect(screen.getByLabelText('Scheduling warning')).toBeInTheDocument()
  })
})
