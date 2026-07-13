import { DndContext } from '@dnd-kit/core'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { makeSchedulableSession, makeStudent, makeUnit } from '@/test/fixtures'
import { UnscheduledPool } from './UnscheduledPool'
import {
  buildUnitBuckets,
  filterUnscheduledSessions,
} from './unscheduledPoolView'
import { buildStudentSearchIndex } from './sessionFilter'

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
    ['grace hopper', 'math-tutorial'],
  ])('searches unit code, name, and teaching-team lecturer for "%s"', (search, id) => {
    const result = filterUnscheduledSessions(sessions, {
      search,
      yearLevel: 'all',
    })

    expect(result.map((session) => session.session_id)).toEqual([id])
  })

  it('does not match session type text', () => {
    const result = filterUnscheduledSessions(sessions, {
      search: 'tutorial',
      yearLevel: 'all',
    })
    expect(result).toHaveLength(0)
  })

  it('matches a teaching-team member not assigned as session lecturer', () => {
    const teamSessions = [
      makeSchedulableSession({
        session_id: 'his-lec',
        unit_id: 'unit-his',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        lecturer_display_name: 'Dr Ada Lovelace',
      }),
    ]
    const teamMap = new Map([['unit-his', ['Dr Ada Lovelace', 'Prof Grace Hopper']]])

    const result = filterUnscheduledSessions(
      teamSessions,
      { search: 'grace hopper', yearLevel: 'all' },
      teamMap
    )

    expect(result.map((s) => s.session_id)).toEqual(['his-lec'])
  })

  it('matches an allocated student by name and number (Unit 108)', () => {
    const studentIndex = buildStudentSearchIndex([
      makeStudent({
        id: 'stu-1',
        first_name: 'Sam',
        last_name: 'Carter',
        student_number: '20257777',
      }),
    ])
    const studentSessions = [
      makeSchedulableSession({
        session_id: 'has-student',
        unit_id: 'unit-1',
        allocated_student_ids: ['stu-1'],
      }),
      makeSchedulableSession({
        session_id: 'no-student',
        unit_id: 'unit-2',
        unit_code: 'PHI201',
        unit_name: 'Philosophy',
        allocated_student_ids: [],
      }),
    ]

    expect(
      filterUnscheduledSessions(
        studentSessions,
        { search: 'carter', yearLevel: 'all' },
        undefined,
        studentIndex
      ).map((s) => s.session_id)
    ).toEqual(['has-student'])

    expect(
      filterUnscheduledSessions(
        studentSessions,
        { search: '20257777', yearLevel: 'all' },
        undefined,
        studentIndex
      ).map((s) => s.session_id)
    ).toEqual(['has-student'])
  })

  it('does not mutate the input sessions (view-only filtering)', () => {
    const input = [
      makeSchedulableSession({ session_id: 'a', unit_code: 'HIS101' }),
      makeSchedulableSession({ session_id: 'b', unit_code: 'PHI201' }),
    ]
    const snapshot = input.map((s) => s.session_id)
    filterUnscheduledSessions(input, { search: 'his101', yearLevel: 'all' })
    expect(input.map((s) => s.session_id)).toEqual(snapshot)
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

  it('orders sessions lecture -> tutorial -> seminar within a unit (Unit 116)', () => {
    const result = buildUnitBuckets([
      makeSchedulableSession({
        session_id: 'seminar',
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        session_type: 'seminar',
        lecturer_display_name: 'A',
      }),
      makeSchedulableSession({
        session_id: 'tutorial',
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        session_type: 'tutorial',
        lecturer_display_name: 'A',
      }),
      makeSchedulableSession({
        session_id: 'lecture',
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        session_type: 'lecture',
        lecturer_display_name: 'A',
      }),
    ])

    expect(result[0].sessions.map((session) => session.session_id)).toEqual([
      'lecture',
      'tutorial',
      'seminar',
    ])
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

  it('renders the seminar type label (Unit 116)', () => {
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession({ session_type: 'seminar' })]}
        totalSchedulableCount={1}
      />
    )

    expect(screen.getByText('Seminar')).toBeInTheDocument()
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

  it('renders unit boxes with equal-width w-full class inside a grid container', () => {
    const sessions = [
      makeSchedulableSession({
        session_id: 's1',
        unit_id: 'unit-a',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
      makeSchedulableSession({
        session_id: 's2',
        unit_id: 'unit-b',
        unit_code: 'PHI201',
        unit_name: 'Philosophy',
        lecturer_display_name: 'Dr Grace Hopper',
      }),
    ]

    renderPool(
      <UnscheduledPool sessions={sessions} totalSchedulableCount={2} />
    )

    const boxes = screen.getAllByRole('region')
    expect(boxes.length).toBeGreaterThanOrEqual(2)
    for (const box of boxes) {
      expect(box.className).toContain('w-full')
    }
  })

  it('does not render unit boxes with zero sessions', () => {
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession()]}
        totalSchedulableCount={1}
      />
    )

    const boxes = screen.getAllByRole('region')
    for (const box of boxes) {
      expect(box).not.toBeEmptyDOMElement()
    }
  })

  it('searches teaching-team lecturer via units prop', async () => {
    const user = userEvent.setup()
    const units = [
      makeUnit({
        id: 'unit-1',
        code: 'HIS101',
        lecturers: [
          { id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' },
          { id: 'lec-2', title: 'Prof.', first_name: 'Grace', last_name: 'Hopper' },
        ],
      }),
    ]
    const sessions = [
      makeSchedulableSession({
        unit_id: 'unit-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        lecturer_display_name: 'Dr Ada Lovelace',
      }),
    ]

    renderPool(
      <UnscheduledPool
        sessions={sessions}
        units={units}
        totalSchedulableCount={1}
      />
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'Search unscheduled sessions' }),
      'Grace Hopper'
    )

    expect(screen.getByText('HIS101')).toBeInTheDocument()
  })

  it('does not match session type in pool search', async () => {
    const user = userEvent.setup()
    renderPool(
      <UnscheduledPool
        sessions={[makeSchedulableSession({ session_type: 'tutorial' })]}
        totalSchedulableCount={1}
      />
    )

    await user.type(
      screen.getByRole('searchbox', { name: 'Search unscheduled sessions' }),
      'tutorial'
    )

    expect(
      screen.getByText('No unscheduled sessions match your filters.')
    ).toBeInTheDocument()
  })

  it('hides non-matching pool sessions for the grid search and restores them when cleared', () => {
    const sessions = [
      makeSchedulableSession({
        session_id: 'his',
        unit_id: 'unit-his',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
      makeSchedulableSession({
        session_id: 'phi',
        unit_id: 'unit-phi',
        unit_code: 'PHI201',
        unit_name: 'Philosophy',
      }),
    ]

    const { rerender } = renderPool(
      <UnscheduledPool
        sessions={sessions}
        totalSchedulableCount={2}
        externalSearch="his101"
      />
    )

    // Only the matching unit remains visible while the grid search is active.
    expect(screen.getByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('PHI201')).not.toBeInTheDocument()

    // Clearing the grid search restores every session in the pool.
    rerender(
      <MemoryRouter>
        <DndContext>
          <UnscheduledPool
            sessions={sessions}
            totalSchedulableCount={2}
            externalSearch=""
          />
        </DndContext>
      </MemoryRouter>
    )
    expect(screen.getByText('HIS101')).toBeInTheDocument()
    expect(screen.getByText('PHI201')).toBeInTheDocument()
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
