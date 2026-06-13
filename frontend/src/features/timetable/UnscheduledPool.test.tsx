import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { MemoryRouter } from 'react-router-dom'
import { UnscheduledPool } from './UnscheduledPool'
import { makeSchedulableSession } from '@/test/fixtures'

function renderPool(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <DndContext>{ui}</DndContext>
    </MemoryRouter>
  )
}

describe('UnscheduledPool — unscheduled pool rendering', () => {
  it('renders the empty state when there are no schedulable sessions', () => {
    renderPool(<UnscheduledPool sessions={[]} />)
    expect(screen.getByText('No schedulable sessions yet')).toBeInTheDocument()
  })

  it('renders a loading state', () => {
    renderPool(<UnscheduledPool isLoading />)
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument()
  })

  it('renders an error state with the error message', () => {
    renderPool(
      <UnscheduledPool isError error={new Error('Failed to load schedulable sessions.')} />
    )
    expect(screen.getByText('Failed to load schedulable sessions.')).toBeInTheDocument()
  })

  it('renders session cards grouped by unit', () => {
    const sessions = [
      makeSchedulableSession({ session_id: 'a', unit_id: 'unit-1', unit_code: 'HIS101', unit_name: 'Ancient History' }),
      makeSchedulableSession({ session_id: 'b', unit_id: 'unit-2', unit_code: 'MAT200', unit_name: 'Calculus' }),
    ]
    renderPool(<UnscheduledPool sessions={sessions} />)
    // Each unit's code/name appears in both the group header and its card.
    expect(screen.getAllByText('HIS101').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ancient History').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MAT200').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Calculus').length).toBeGreaterThan(0)
  })
})
