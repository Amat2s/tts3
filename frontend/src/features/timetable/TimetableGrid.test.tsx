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
    expect(screen.queryByText('Lunch/Mass')).not.toBeInTheDocument()
  })

  it('renders the weekday headers, room columns, and Lunch/Mass divider', () => {
    renderGrid(<TimetableGrid rooms={rooms} />)
    expect(screen.getByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Friday')).toBeInTheDocument()
    // Each room column header repeats per weekday (5 days).
    expect(screen.getAllByText('Room A')).toHaveLength(5)
    expect(screen.getByText('Lunch/Mass')).toBeInTheDocument()
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

  it('uses a smaller room-header text size in the narrow (non-extended) layout and truncates', () => {
    renderGrid(<TimetableGrid rooms={rooms} extended={false} />)
    const header = screen.getAllByText('Room A')[0]
    // The size class sits on the header cell; the label keeps truncation.
    expect(header.closest('div')?.className).toContain('text-[0.4rem]')
    expect(header.className).toContain('truncate')
  })

  it('keeps the larger room-header text size in the extended layout', () => {
    renderGrid(<TimetableGrid rooms={rooms} extended />)
    const header = screen.getAllByText('Room A')[0]
    expect(header.closest('div')?.className).toContain('text-[0.65rem]')
  })

  it('dims a non-matching scheduled card and leaves a matching one at full opacity', () => {
    const assignments = [
      makeAssignment({ session_id: 'sess-1', day: 'Monday', start_slot: 's1', room_id: 'room-1' }),
      makeAssignment({ session_id: 'sess-2', unit_code: 'PHI201', day: 'Monday', start_slot: 's2', room_id: 'room-1' }),
    ]
    renderGrid(
      <TimetableGrid
        rooms={rooms}
        assignments={assignments}
        dimmedSessionIds={new Set(['sess-2'])}
      />
    )
    expect(screen.getByText('HIS101').closest('div[style]')).toHaveStyle({
      opacity: '1',
    })
    expect(screen.getByText('PHI201').closest('div[style]')).toHaveStyle({
      opacity: '0.4',
    })
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
