import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DragPreviewCard } from './DragPreviewCard'
import { makeSchedulableSession } from '@/test/fixtures'
import { GRID_ROW_HEIGHT_PX } from './hoverHighlight'

const SESSION = makeSchedulableSession({
  session_id: 'sess-1',
  unit_code: 'HIS101',
  session_type: 'lecture',
  duration: 1,
  lecturer_display_name: 'Dr. Ada Lovelace',
  student_count: 15,
})

const SESSION_TUT = makeSchedulableSession({
  session_id: 'sess-2',
  unit_code: 'PHI201',
  session_type: 'tutorial',
  duration: 2,
  student_count: 8,
  lecturer_display_name: 'Prof. Turing',
})

const SESSION_SEM = makeSchedulableSession({
  session_id: 'sess-3',
  unit_code: 'THE202',
  session_type: 'seminar',
  duration: 1,
  student_count: 6,
  lecturer_display_name: 'Fr. Alan Turing',
})

describe('DragPreviewCard — scheduled-card shape, not unscheduled shape', () => {
  it('renders the unit code in compact form', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    expect(screen.getByText('HIS101')).toBeInTheDocument()
  })

  it('renders session type as short label ("Lec") not long form ("Lecture")', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    expect(screen.getByText('Lec')).toBeInTheDocument()
    expect(screen.queryByText('Lecture')).not.toBeInTheDocument()
  })

  it('renders tutorial type as "Tut" not "Tutorial"', () => {
    render(<DragPreviewCard session={SESSION_TUT} metrics={null} />)
    expect(screen.getByText('Tut')).toBeInTheDocument()
    expect(screen.queryByText('Tutorial')).not.toBeInTheDocument()
  })

  it('renders seminar type as "Sem" not "Seminar"', () => {
    render(<DragPreviewCard session={SESSION_SEM} metrics={null} />)
    expect(screen.getByText('Sem')).toBeInTheDocument()
    expect(screen.queryByText('Seminar')).not.toBeInTheDocument()
  })

  it('renders lecturer display name', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    expect(screen.getByText('Dr. Ada Lovelace')).toBeInTheDocument()
  })

  it('uses fallback width when metrics are null', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    const card = screen.getByTestId('drag-preview-card')
    expect(card).toHaveStyle({ width: '200px' })
  })

  it('uses measured cell width from metrics', () => {
    render(<DragPreviewCard session={SESSION} metrics={{ cellWidth: 140, rowHeight: 56 }} />)
    const card = screen.getByTestId('drag-preview-card')
    expect(card).toHaveStyle({ width: '140px' })
  })

  it('height is rowHeight × 1 for a 1-slot session', () => {
    render(<DragPreviewCard session={SESSION} metrics={{ cellWidth: 140, rowHeight: GRID_ROW_HEIGHT_PX }} />)
    const card = screen.getByTestId('drag-preview-card')
    expect(card).toHaveStyle({ height: `${GRID_ROW_HEIGHT_PX}px` })
  })

  it('height is rowHeight × duration for a multi-slot session', () => {
    const rowH = 56
    render(<DragPreviewCard session={SESSION_TUT} metrics={{ cellWidth: 140, rowHeight: rowH }} />)
    const card = screen.getByTestId('drag-preview-card')
    expect(card).toHaveStyle({ height: `${rowH * 2}px` })
  })

  it('shows student count for sessions with duration > 1', () => {
    render(<DragPreviewCard session={SESSION_TUT} metrics={null} />)
    expect(screen.getByText(/8 student/)).toBeInTheDocument()
  })

  it('does not show student count for duration-1 sessions', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    expect(screen.queryByText(/student/)).not.toBeInTheDocument()
  })

  it('does not render clock icon or "hours" text (unscheduled-card content)', () => {
    render(<DragPreviewCard session={SESSION} metrics={null} />)
    expect(screen.queryByText(/hour/)).not.toBeInTheDocument()
  })
})
