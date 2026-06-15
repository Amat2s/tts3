import { DndContext } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { makeSchedulableSession } from '@/test/fixtures'
import { UnscheduledPool } from './UnscheduledPool'
import {
  buildUnitBuckets,
  filterUnscheduledSessions,
} from './unscheduledPoolView'

function renderPool(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <DndContext>{ui}</DndContext>
    </MemoryRouter>
  )
}

describe('unscheduled pool view model', () => {
  const sessions = [
    makeSchedulableSession({
      session_id: 'history-lecture',
      unit_id: 'unit-history',
      unit_code: 'HIS101',
      unit_name: 'Ancient History',
      session_type: 'lecture',
      lecturer_display_name: 'Dr. Ada Lovelace',
      unit_year_level: 1,
    }),
    makeSchedulableSession({
      session_id: 'math-tutorial',
      unit_id: 'unit-math',
      unit_code: 'MAT200',
      unit_name: 'Calculus',
      session_type: 'tutorial',
      lecturer_display_name: 'Prof. Grace Hopper',
      unit_year_level: 2,
    }),
  ]

  it.each([
    ['his101', 'history-lecture'],
    ['calculus', 'math-tutorial'],
    ['tutorial', 'math-tutorial'],
    ['grace hopper', 'math-tutorial'],
  ])('searches unit, session, and lecturer text for "%s"', (search, id) => {
    const result = filterUnscheduledSessions(sessions, {
      search,
      yearLevel: 'all',
    })

    expect(result.map((session) => session.session_id)).toEqual([id])
  })

  it('filters by year level', () => {
    const result = filterUnscheduledSessions(sessions, {
      search: '',
      yearLevel: '2',
    })

    expect(result.map((session) => session.session_id)).toEqual([
      'math-tutorial',
    ])
  })

  it('sorts unit buckets by year, code, and name and sessions by type and lecturer', () => {
    const result = buildUnitBuckets([
      makeSchedulableSession({
        session_id: 'tutorial',
        unit_id: 'unit-year-2',
        unit_code: 'MAT200',
        unit_name: 'Calculus',
        session_type: 'tutorial',
        lecturer_display_name: 'Dr. Ada Lovelace',
        unit_year_level: 2,
      }),
      makeSchedulableSession({
        session_id: 'lecture-z',
        unit_id: 'unit-year-2',
        unit_code: 'MAT200',
        unit_name: 'Calculus',
        session_type: 'lecture',
        lecturer_display_name: 'Prof. Zoe Smith',
        unit_year_level: 2,
      }),
      makeSchedulableSession({
        session_id: 'year-1',
        unit_id: 'unit-year-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        unit_year_level: 1,
      }),
      makeSchedulableSession({
        session_id: 'lecture-a',
        unit_id: 'unit-year-2',
        unit_code: 'MAT200',
        unit_name: 'Calculus',
        session_type: 'lecture',
        lecturer_display_name: 'Dr. Alan Turing',
        unit_year_level: 2,
      }),
    ])

    expect(result.map((bucket) => bucket.unitId)).toEqual([
      'unit-year-1',
      'unit-year-2',
    ])
    expect(
      result[1].sessions.map((session) => session.session_id)
    ).toEqual(['lecture-a', 'lecture-z', 'tutorial'])
  })
})

describe('UnscheduledPool rendering', () => {
  it('renders the existing no-schedulable-sessions state', () => {
    renderPool(<UnscheduledPool sessions={[]} totalSchedulableCount={0} />)

    expect(screen.getByText('No schedulable sessions yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to units' })).toHaveAttribute(
      'href',
      '/units'
    )
  })

  it('renders a completion state when every schedulable session is scheduled', () => {
    renderPool(<UnscheduledPool sessions={[]} totalSchedulableCount={3} />)

    expect(
      screen.getByText('All schedulable sessions are scheduled.')
    ).toBeInTheDocument()
  })

  it('renders a loading state', () => {
    renderPool(<UnscheduledPool isLoading />)

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument()
  })

  it('renders an error state with the error message', () => {
    renderPool(
      <UnscheduledPool
        isError
        error={new Error('Failed to load schedulable sessions.')}
      />
    )

    expect(
      screen.getByText('Failed to load schedulable sessions.')
    ).toBeInTheDocument()
  })

  it('renders unit identity once and stacks session metadata inside the box', () => {
    const sessions = [
      makeSchedulableSession({
        session_id: 'lecture',
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        session_type: 'lecture',
        duration: 2,
        student_count: 18,
      }),
      makeSchedulableSession({
        session_id: 'tutorial',
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        session_type: 'tutorial',
      }),
    ]

    renderPool(
      <UnscheduledPool sessions={sessions} totalSchedulableCount={2} />
    )

    expect(screen.getAllByText('HIS101')).toHaveLength(1)
    expect(screen.getAllByText('Ancient History')).toHaveLength(1)
    expect(screen.getByText('2 remaining')).toBeInTheDocument()
    expect(screen.getByText('Lecture')).toBeInTheDocument()
    expect(screen.getByText('Tutorial')).toBeInTheDocument()
    expect(screen.getByText('2 hours')).toBeInTheDocument()
    expect(screen.getByText('18 students')).toBeInTheDocument()
  })

  it('shows a filter-empty state and clears the filters', async () => {
    const user = userEvent.setup()
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession()]}
        totalSchedulableCount={1}
      />
    )

    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search unscheduled sessions',
      }),
      'no match'
    )

    expect(
      screen.getByText('No unscheduled sessions match your filters.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByText('HIS101')).toBeInTheDocument()
    expect(
      screen.queryByText('No unscheduled sessions match your filters.')
    ).not.toBeInTheDocument()
  })

  it('keeps click-based session selection available', () => {
    const onSelectSession = vi.fn()
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession()]}
        totalSchedulableCount={1}
        onSelectSession={onSelectSession}
      />
    )

    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))

    expect(onSelectSession).toHaveBeenCalledWith('sess-1')
  })

  it('clears a pending selection when filters hide that session', async () => {
    const user = userEvent.setup()
    const onSelectSession = vi.fn()
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession()]}
        totalSchedulableCount={1}
        pendingSessionId="sess-1"
        onSelectSession={onSelectSession}
      />
    )

    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search unscheduled sessions',
      }),
      'no match'
    )

    expect(onSelectSession).toHaveBeenCalledWith('sess-1')
  })
})
