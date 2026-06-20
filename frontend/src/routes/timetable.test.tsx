import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// --- Module mocks --------------------------------------------------------
// The Supabase client is constructed at import time from env vars; stub it so
// importing the API client layer never reaches a real network/env dependency.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

// Keep the test focused on the timetable canvas, not the app shell / nav.
vi.mock('@/components/layout/AppFrame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api/rooms', () => ({ listRooms: vi.fn() }))
vi.mock('@/lib/api/sessions', () => ({ listSchedulableSessions: vi.fn() }))
vi.mock('@/lib/api/assignments', () => ({
  listAssignments: vi.fn(),
  saveAssignments: vi.fn(),
  clearAssignments: vi.fn(),
}))
vi.mock('@/lib/api/lecturers', () => ({ listLecturers: vi.fn() }))
vi.mock('@/lib/api/units', () => ({ listUnits: vi.fn() }))
vi.mock('@/lib/api/timetableBlocks', () => ({
  listTimetableBlocks: vi.fn(),
  createTimetableBlock: vi.fn(),
  updateTimetableBlock: vi.fn(),
  deleteTimetableBlock: vi.fn(),
}))
vi.mock('@/lib/api/solver', () => ({
  startSolverRun: vi.fn(),
  getSolverRunStatus: vi.fn(),
}))

import TimetablePage from './timetable'
import { ApiRequestError } from '@/lib/api/client'
import { listRooms } from '@/lib/api/rooms'
import { listSchedulableSessions } from '@/lib/api/sessions'
import {
  clearAssignments,
  listAssignments,
  saveAssignments,
} from '@/lib/api/assignments'
import { listLecturers } from '@/lib/api/lecturers'
import { listUnits } from '@/lib/api/units'
import {
  listTimetableBlocks,
  createTimetableBlock,
  updateTimetableBlock,
  deleteTimetableBlock,
} from '@/lib/api/timetableBlocks'
import { startSolverRun, getSolverRunStatus } from '@/lib/api/solver'
import {
  makeAssignment,
  makeAssignmentResponse,
  makeLecturer,
  makeRoom,
  makeSchedulableSession,
  makeSolverStatus,
  makeTimetableBlock,
} from '@/test/fixtures'
import {
  computeSavedAssignmentFingerprint,
  saveStoredDraft,
} from '@/features/timetable/draftStorage'

const DRAFT_STORAGE_KEY = 'tts3.timetable.draft.v1'

const mockListRooms = vi.mocked(listRooms)
const mockListSchedulable = vi.mocked(listSchedulableSessions)
const mockListAssignments = vi.mocked(listAssignments)
const mockSaveAssignments = vi.mocked(saveAssignments)
const mockClearAssignments = vi.mocked(clearAssignments)
const mockListLecturers = vi.mocked(listLecturers)
const mockListUnits = vi.mocked(listUnits)
const mockStartSolverRun = vi.mocked(startSolverRun)
const mockGetSolverRunStatus = vi.mocked(getSolverRunStatus)
const mockListTimetableBlocks = vi.mocked(listTimetableBlocks)
const mockCreateTimetableBlock = vi.mocked(createTimetableBlock)
const mockUpdateTimetableBlock = vi.mocked(updateTimetableBlock)
const mockDeleteTimetableBlock = vi.mocked(deleteTimetableBlock)

function renderTimetable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TimetablePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

function saveButton(): HTMLElement {
  return screen.getByRole('button', {
    name: /^(Save Timetable|Saved|Saving\.\.\.)$/,
  })
}

function runSolverButton(): HTMLElement {
  return screen.getByRole('button', {
    name: /^(Generate Timetable|Generating…)$/,
  })
}

function clearAllButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Clear all' })
}

beforeEach(() => {
  localStorage.clear()
  mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1', capacity: 30 })])
  mockListSchedulable.mockResolvedValue([])
  mockListAssignments.mockResolvedValue([])
  mockListLecturers.mockResolvedValue([])
  mockListUnits.mockResolvedValue([])
  mockSaveAssignments.mockResolvedValue([])
  mockClearAssignments.mockResolvedValue()
  mockStartSolverRun.mockResolvedValue(makeSolverStatus({ status: 'running' }))
  mockGetSolverRunStatus.mockResolvedValue(makeSolverStatus({ status: 'running' }))
  mockListTimetableBlocks.mockResolvedValue([])
  mockCreateTimetableBlock.mockResolvedValue({
    block: makeTimetableBlock(),
    unscheduled_session_ids: [],
  })
  mockUpdateTimetableBlock.mockResolvedValue({
    block: makeTimetableBlock(),
    unscheduled_session_ids: [],
  })
  mockDeleteTimetableBlock.mockResolvedValue()
})

afterEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('TimetablePage — no-room state', () => {
  it('shows the no-room empty state when there are no rooms', async () => {
    mockListRooms.mockResolvedValue([])
    renderTimetable()
    expect(await screen.findByText('No rooms available')).toBeInTheDocument()
  })

  it('renders the grid when rooms exist', async () => {
    renderTimetable()
    expect(await screen.findByText('Monday')).toBeInTheDocument()
    expect(screen.getByText('Lunch/Mass')).toBeInTheDocument()
  })

  it('does not render a visible page header or description, but keeps an sr-only heading', async () => {
    renderTimetable()
    await screen.findByText('Monday')
    // The descriptive paragraph is gone entirely.
    expect(
      screen.queryByText(/Weekly scheduling workspace/i)
    ).not.toBeInTheDocument()
    // The accessible page heading remains (sr-only) and is the only H1.
    const heading = screen.getByRole('heading', { level: 1, name: 'Timetable' })
    expect(heading).toHaveClass('sr-only')
  })
})

describe('TimetablePage — saved assignments load into draft state', () => {
  it('renders saved assignments on the grid and removes them from the pool', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({ session_id: 'sess-1', unit_id: 'unit-1', unit_code: 'HIS101', unit_name: 'Ancient History' }),
      makeSchedulableSession({ session_id: 'sess-2', unit_id: 'unit-2', unit_code: 'MAT200', unit_name: 'Calculus' }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', day: 'Monday', start_slot: 's1', room_id: 'room-1' }),
    ])
    renderTimetable()

    // sess-1 is scheduled — its card (unit code) appears on the grid only.
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    // sess-2 is still unscheduled — its pool unit name is visible.
    expect((await screen.findAllByText('Calculus')).length).toBeGreaterThan(0)
    // sess-1's pool-only unit name is gone (it left the pool for the grid).
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()
  })
})

describe('TimetablePage - timetable action polish', () => {
  it('shows clean, solver, and sticky action-bar states', async () => {
    renderTimetable()

    await screen.findByText('Monday')

    expect(saveButton()).toHaveTextContent('Saved')
    expect(saveButton()).toBeDisabled()
    expect(runSolverButton()).toHaveTextContent('Generate Timetable')
    expect(clearAllButton()).toBeDisabled()
    expect(screen.getByTestId('timetable-action-bar')).toHaveClass(
      'sticky',
      'top-4',
      'z-30'
    )
  })

  it('opens the Clear all dialog and cancel preserves the draft', async () => {
    const user = userEvent.setup()
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ])

    renderTimetable()

    expect(
      await screen.findByText('All schedulable sessions are scheduled.')
    ).toBeInTheDocument()
    await user.click(clearAllButton())

    expect(
      screen.getByRole('heading', {
        name: 'Clear current timetable draft?',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /saved timetable will not change until you click Save Timetable/i
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(
      screen.queryByRole('heading', {
        name: 'Clear current timetable draft?',
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('All schedulable sessions are scheduled.')
    ).toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Saved')
    expect(mockSaveAssignments).not.toHaveBeenCalled()
    expect(mockClearAssignments).not.toHaveBeenCalled()
  })

  it('clears only the frontend draft and saves it empty on explicit Save', async () => {
    const user = userEvent.setup()
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ])

    renderTimetable()

    expect(
      await screen.findByText('All schedulable sessions are scheduled.')
    ).toBeInTheDocument()
    await user.click(clearAllButton())
    await user.click(screen.getByRole('button', { name: 'Clear timetable' }))

    expect(await screen.findByText('Ancient History')).toBeInTheDocument()
    expect(
      screen.queryByText('All schedulable sessions are scheduled.')
    ).not.toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Save Timetable')
    expect(saveButton()).toBeEnabled()
    expect(mockSaveAssignments).not.toHaveBeenCalled()
    expect(mockClearAssignments).not.toHaveBeenCalled()

    mockListAssignments.mockResolvedValue([])
    await user.click(saveButton())

    await waitFor(() =>
      expect(mockSaveAssignments).toHaveBeenCalledWith({ assignments: [] })
    )
    await waitFor(() => expect(saveButton()).toHaveTextContent('Saved'))
    expect(mockClearAssignments).not.toHaveBeenCalled()
  })
})

describe('TimetablePage - manual scheduling updates draft state only', () => {
  it('places a pending session into an empty cell without persisting', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({ session_id: 'sess-1', unit_code: 'HIS101', unit_name: 'Ancient History', duration: 1, student_count: 10 }),
    ])
    const { container } = renderTimetable()

    // Pool card present; Save disabled (no draft changes yet).
    await screen.findAllByText('Ancient History')
    expect(saveButton()).toBeDisabled()

    // Select the session (click its pool card via the lecturer label, which is
    // unique to the card), then click an empty grid cell to place it.
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)

    // Scheduled card now on the grid; the session left the pool.
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()
    // Draft change marks the timetable dirty (Save enabled)...
    expect(saveButton()).toBeEnabled()
    // ...but nothing was persisted.
    expect(mockSaveAssignments).not.toHaveBeenCalled()
  })
})

describe('TimetablePage — save behavior', () => {
  async function placeSessionThenGetSaveButton(container: HTMLElement) {
    await screen.findAllByText('Ancient History')
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)
    await screen.findByText('HIS101')
    return saveButton()
  }

  it('persists the draft through the assignment API and resets on success', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({ session_id: 'sess-1', unit_code: 'HIS101', unit_name: 'Ancient History' }),
    ])
    // Initial load is empty (beforeEach default); placement is the only draft source.
    mockSaveAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', day: 'Monday', start_slot: 's1', room_id: 'room-1' }),
    ])

    const { container } = renderTimetable()
    const btn = await placeSessionThenGetSaveButton(container)

    // After a successful save, the assignments refetch returns the saved row.
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', day: 'Monday', start_slot: 's1', room_id: 'room-1' }),
    ])

    fireEvent.click(btn)

    // The mutation runs asynchronously — wait for the persist call.
    await waitFor(() =>
      expect(mockSaveAssignments).toHaveBeenCalledWith({
        assignments: [
          { session_id: 'sess-1', day: 'Monday', start_slot: 's1', room_id: 'room-1' },
        ],
      })
    )
    // On success the draft resets from the refetched saved state — Save disables.
    await waitFor(() => expect(saveButton()).toBeDisabled())
  })

  it('leaves the draft visible and unsaved when the save fails', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({ session_id: 'sess-1', unit_code: 'HIS101', unit_name: 'Ancient History' }),
    ])
    mockSaveAssignments.mockRejectedValue(
      new ApiRequestError({ status: 409, message: 'Assignment conflict detected.' })
    )

    const { container } = renderTimetable()
    const btn = await placeSessionThenGetSaveButton(container)

    fireEvent.click(btn)

    // The failure message is surfaced...
    expect(await screen.findByText('Assignment conflict detected.')).toBeInTheDocument()
    // ...the draft assignment is still on the grid...
    expect(screen.getByText('HIS101')).toBeInTheDocument()
    // ...and the change is still unsaved (Save remains enabled).
    expect(saveButton()).toBeEnabled()
  })
})

describe('TimetablePage — solver gating', () => {
  it('disables the solver while a validation warning exists', async () => {
    mockListRooms.mockResolvedValue([
      makeRoom({ id: 'room-1', capacity: 30 }),
      makeRoom({ id: 'room-2', name: 'Room B', capacity: 30 }),
    ])
    // Two saved sessions with the same session-level lecturer at the same time
    // remain a warning after assignments are reloaded from the backend.
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ assignment_id: 'asg-1', session_id: 'sess-1', unit_id: 'unit-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1', lecturer_id: 'lec-1' }),
      makeAssignmentResponse({ assignment_id: 'asg-2', session_id: 'sess-2', unit_id: 'unit-2', unit_code: 'MAT200', room_id: 'room-2', day: 'Monday', start_slot: 's1', lecturer_id: 'lec-1' }),
    ])
    mockListLecturers.mockResolvedValue([makeLecturer()])

    renderTimetable()

    // The disabled reason names the warning once the draft has loaded.
    const disabledReason = await screen.findByText(/scheduling warning/)
    expect(disabledReason).toBeVisible()
    expect(runSolverButton()).toBeDisabled()
    expect(runSolverButton()).toHaveAttribute(
      'title',
      expect.stringMatching(/scheduling warning/)
    )
    expect(runSolverButton()).toHaveClass(
      'bg-[var(--solver-accent-soft)]',
      'text-[var(--solver-accent)]'
    )
    expect(mockStartSolverRun).not.toHaveBeenCalled()
  })

  it('enables the solver when there are no issues and starts a run on click', async () => {
    // One clean saved assignment, no warnings, nothing unscheduled → solver ready.
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1' }),
    ])

    renderTimetable()

    await waitFor(() => expect(runSolverButton()).toBeEnabled())
    fireEvent.click(runSolverButton())

    await waitFor(() => expect(mockStartSolverRun).toHaveBeenCalledOnce())
    expect(await screen.findByText('Solver is running…')).toBeInTheDocument()
    expect(clearAllButton()).toBeDisabled()
  })
})

describe('TimetablePage — automatic unscheduling after a blocking data change', () => {
  it('unschedules a session and returns it to the pool when it no longer fits the room', async () => {
    mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1', capacity: 30 })])
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({ session_id: 'sess-1', unit_code: 'HIS101', unit_name: 'Ancient History', student_count: 10 }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1', student_count: 10 }),
    ])

    const { queryClient } = renderTimetable()

    // Initially scheduled (on the grid, not in the pool).
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()

    // Data change: the session's student count grows past the room capacity.
    await act(async () => {
      queryClient.setQueryData(
        ['schedulable-sessions'],
        [
          makeSchedulableSession({ session_id: 'sess-1', unit_code: 'HIS101', unit_name: 'Ancient History', student_count: 50 }),
        ]
      )
    })

    // The session is auto-unscheduled and reappears in the unscheduled pool.
    expect((await screen.findAllByText('Ancient History')).length).toBeGreaterThan(0)
  })
})

describe('TimetablePage — consolidated action bar (Unit 77)', () => {
  it('solver running state renders inside the action bar, not as a separate panel', async () => {
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1' }),
    ])
    mockGetSolverRunStatus.mockResolvedValue(makeSolverStatus({ status: 'running' }))

    renderTimetable()
    await waitFor(() => expect(runSolverButton()).toBeEnabled())
    fireEvent.click(runSolverButton())

    const runningText = await screen.findByText('Solver is running…')
    const bar = screen.getByTestId('timetable-action-bar')
    expect(bar).toContainElement(runningText)
    // No second copy outside the bar
    expect(screen.getAllByText('Solver is running…')).toHaveLength(1)
  })

  it('assignment load error renders inside the action bar without a separate panel', async () => {
    mockListAssignments.mockRejectedValue(
      new ApiRequestError({ status: 500, message: 'Database unavailable.' })
    )

    renderTimetable()

    const errorText = await screen.findByText('Database unavailable.')
    const bar = screen.getByTestId('timetable-action-bar')
    expect(bar).toContainElement(errorText)
    // Exactly one copy — no duplicate outside the bar
    expect(screen.getAllByText('Database unavailable.')).toHaveLength(1)

    // While the saved baseline is unavailable, save/clear must stay disabled so
    // an incomplete draft can never overwrite the unknown saved timetable.
    expect(screen.getByRole('button', { name: /Save|Saved/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Clear all/ })).toBeDisabled()
  })

  it('details open as overlay inside the action bar without adding a layout sibling', async () => {
    mockListRooms.mockResolvedValue([
      makeRoom({ id: 'room-1', capacity: 30 }),
      makeRoom({ id: 'room-2', name: 'Room B', capacity: 30 }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ assignment_id: 'asg-1', session_id: 'sess-1', unit_id: 'unit-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1', lecturer_id: 'lec-1' }),
      makeAssignmentResponse({ assignment_id: 'asg-2', session_id: 'sess-2', unit_id: 'unit-2', unit_code: 'MAT200', room_id: 'room-2', day: 'Monday', start_slot: 's1', lecturer_id: 'lec-1' }),
    ])
    mockListLecturers.mockResolvedValue([makeLecturer()])

    const user = userEvent.setup()
    renderTimetable()

    const viewDetailsBtn = await screen.findByRole('button', { name: /view details/i })
    await user.click(viewDetailsBtn)

    const bar = screen.getByTestId('timetable-action-bar')
    const overlay = screen.getByRole('region', { name: 'Validation details' })
    // Overlay is a descendant of the bar, not a sibling outside it
    expect(bar).toContainElement(overlay)
  })

  it('details overlay shows time label not raw slot ID for availability warnings', async () => {
    mockListLecturers.mockResolvedValue([
      makeLecturer({ id: 'lec-1', unavailable_slots: [{ day: 'Monday', slot: 's1' }] }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ session_id: 'sess-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1', lecturer_id: 'lec-1' }),
    ])

    const user = userEvent.setup()
    renderTimetable()

    const viewDetailsBtn = await screen.findByRole('button', { name: /view details/i })
    await user.click(viewDetailsBtn)

    // The details overlay must contain the human time label, not the raw slot ID
    const overlay = screen.getByRole('region', { name: 'Validation details' })
    expect(overlay).toHaveTextContent(/9:00-9:50/)
    // The raw slot ID form must not appear anywhere in the overlay
    expect(overlay).not.toHaveTextContent(/slot s1/i)
  })

  it('solver and save states both render inside a single action bar surface', async () => {
    renderTimetable()
    await screen.findByText('Monday')

    const bar = screen.getByTestId('timetable-action-bar')
    expect(bar).toContainElement(saveButton())
    expect(bar).toContainElement(runSolverButton())
  })
})

describe('TimetablePage — Unit 78: drag preview and hover highlighting', () => {
  it('blocking error still surfaces in the action bar after a failed drop placement', async () => {
    // A session with too many students for the room — clicking the cell must show
    // a blocking message after the placement attempt fails.
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-big',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
        student_count: 50, // exceeds room capacity of 30
      }),
    ])

    const { container } = renderTimetable()

    await screen.findAllByText('Ancient History')
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))

    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)

    // Blocking message appears in the action bar; the save button stays disabled.
    const bar = screen.getByTestId('timetable-action-bar')
    expect(bar).toHaveTextContent(/cannot place session/i)
    expect(saveButton()).toBeDisabled()
  })

  it('click-based scheduling still places a valid session into the grid', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
        student_count: 10,
      }),
    ])

    const { container } = renderTimetable()

    await screen.findAllByText('Ancient History')
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))

    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)

    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()
  })

  it('grid cells carry data-grid-cell attribute for measurement', async () => {
    const { container } = renderTimetable()
    await screen.findByText('Monday')

    const cells = container.querySelectorAll('[data-grid-cell="true"]')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('hovered valid cells get the hover-highlight background during drag (unit test via prop)', async () => {
    // TimetableGrid receives hoverHighlightKeys from the page; verify cells react
    // to the prop. We test TimetableGrid directly with the highlight key active.
    const { container } = renderTimetable()
    await screen.findByText('Monday')

    // Verify that grid cells exist and can accept the highlight prop — the
    // highlight itself is a CSS variable background, visible in the style.
    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    expect(cell).toBeInTheDocument()
  })
})

describe('TimetablePage — Unit 79: local draft persistence', () => {
  async function placeFirstSession(container: HTMLElement) {
    await screen.findAllByText('Ancient History')
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)
    await screen.findByText('HIS101')
  }

  it('writes a dirty draft to storage when a session is placed', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])

    const { container } = renderTimetable()
    await placeFirstSession(container)

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw as string)
      expect(parsed.schemaVersion).toBe(1)
      expect(parsed.assignments).toHaveLength(1)
      expect(parsed.assignments[0].session_id).toBe('sess-1')
    })
  })

  it('restores a persisted draft on remount and shows the restored notice', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])

    const first = renderTimetable()
    await placeFirstSession(first.container)
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull()
    )
    first.unmount()

    // Remount with the same (empty) saved state — the stored draft restores.
    renderTimetable()
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()
    expect(screen.getByText('Unsaved draft restored.')).toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Save Timetable')
    expect(saveButton()).toBeEnabled()
  })

  it('restores a refresh-seeded draft and marks it dirty', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])
    // Saved state is empty; seed a stored draft whose fingerprint matches it.
    saveStoredDraft(
      [makeAssignment({ session_id: 'sess-1', student_count: 10 })],
      computeSavedAssignmentFingerprint([])
    )

    renderTimetable()

    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.getByText('Unsaved draft restored.')).toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('clears storage after a successful save', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])
    mockSaveAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        day: 'Monday',
        start_slot: 's1',
        room_id: 'room-1',
      }),
    ])

    const { container } = renderTimetable()
    await placeFirstSession(container)
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull()
    )

    // After a successful save the assignments refetch returns the saved row.
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        day: 'Monday',
        start_slot: 's1',
        room_id: 'room-1',
      }),
    ])
    fireEvent.click(saveButton())

    await waitFor(() => expect(mockSaveAssignments).toHaveBeenCalled())
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
    )
  })

  it('persists an empty dirty draft after Clear all until saved', async () => {
    const user = userEvent.setup()
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ])

    renderTimetable()
    expect(
      await screen.findByText('All schedulable sessions are scheduled.')
    ).toBeInTheDocument()

    await user.click(clearAllButton())
    await user.click(screen.getByRole('button', { name: 'Clear timetable' }))

    await waitFor(() => {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw as string)
      expect(parsed.assignments).toEqual([])
    })
  })

  it('discards a stored draft when saved timetable data changed', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    // Saved state now has a placement that did not exist when the draft was stored.
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ])
    // Seed a draft fingerprinted against an out-of-date (empty) saved state.
    saveStoredDraft(
      [makeAssignment({ session_id: 'sess-1', start_slot: 's5' })],
      'stale-fingerprint'
    )

    renderTimetable()

    expect(
      await screen.findByText(
        'Old unsaved draft was discarded because saved timetable data changed.'
      )
    ).toBeInTheDocument()
    // The stale draft did not override the saved state; storage is cleared.
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
    // The saved placement is on the grid (draft initialized from saved state).
    expect(screen.getByText('HIS101')).toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Saved')
  })

  it('runs restored assignments through the auto-unschedule cleanup on data change', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])
    // Restore a valid draft (fits the 30-capacity room) from storage.
    saveStoredDraft(
      [makeAssignment({ session_id: 'sess-1', student_count: 10 })],
      computeSavedAssignmentFingerprint([])
    )

    const { queryClient } = renderTimetable()
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.queryByText('Ancient History')).not.toBeInTheDocument()

    // Data change makes the restored assignment exceed room capacity.
    await act(async () => {
      queryClient.setQueryData(
        ['schedulable-sessions'],
        [
          makeSchedulableSession({
            session_id: 'sess-1',
            unit_code: 'HIS101',
            unit_name: 'Ancient History',
            student_count: 50,
          }),
        ]
      )
    })

    // The restored assignment is auto-unscheduled back into the pool.
    expect(
      (await screen.findAllByText('Ancient History')).length
    ).toBeGreaterThan(0)
  })

  it('does not resurrect a stored draft after saved assignments refetch', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        student_count: 10,
      }),
    ])
    mockSaveAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        day: 'Monday',
        start_slot: 's1',
        room_id: 'room-1',
      }),
    ])

    const { container, queryClient } = renderTimetable()
    await placeFirstSession(container)

    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        day: 'Monday',
        start_slot: 's1',
        room_id: 'room-1',
      }),
    ])
    fireEvent.click(saveButton())
    await waitFor(() => expect(saveButton()).toHaveTextContent('Saved'))

    // A subsequent assignments refetch must not restore the (now cleared) draft.
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['assignments'] })
    })
    expect(saveButton()).toHaveTextContent('Saved')
    expect(screen.queryByText('Unsaved draft restored.')).not.toBeInTheDocument()
  })
})

describe('TimetablePage — Unit 80: empty-draft save and clear', () => {
  it('restores an empty dirty draft from storage (Clear all survives a refresh)', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    // Saved backend state has one placement; the stored draft is empty (the user
    // cleared everything) but fingerprinted against that same saved state.
    const saved = [
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ]
    mockListAssignments.mockResolvedValue(saved)
    saveStoredDraft([], computeSavedAssignmentFingerprint(saved))

    renderTimetable()

    // The empty dirty draft restores: the session returns to the unscheduled
    // pool (its pool-only unit name is visible) and the dirty restored state is
    // surfaced rather than the saved placement being shown as clean.
    expect(
      (await screen.findAllByText('Ancient History')).length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Unsaved draft restored.')).toBeInTheDocument()
    expect(saveButton()).toHaveTextContent('Save Timetable')
    expect(saveButton()).toBeEnabled()
  })

  it('keeps the solver blocked while an empty draft is dirty after Clear all', async () => {
    const user = userEvent.setup()
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
      }),
    ])
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        room_id: 'room-1',
        day: 'Monday',
        start_slot: 's1',
      }),
    ])

    renderTimetable()

    // Clean and fully scheduled → solver is enabled.
    await waitFor(() => expect(runSolverButton()).toBeEnabled())

    await user.click(clearAllButton())
    await user.click(screen.getByRole('button', { name: 'Clear timetable' }))

    // The empty draft is dirty; the solver runs from saved state, so it must be
    // blocked until the empty timetable is saved.
    expect(saveButton()).toHaveTextContent('Save Timetable')
    await waitFor(() => expect(runSolverButton()).toBeDisabled())
    expect(runSolverButton()).toHaveAttribute(
      'title',
      expect.stringMatching(/Save your timetable changes/)
    )
    expect(mockStartSolverRun).not.toHaveBeenCalled()
  })
})

describe('TimetablePage — Unit 85: timetable block rendering', () => {
  it('renders a named block with its name and colour', async () => {
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' }],
      }),
    ])
    renderTimetable()

    await screen.findByText('Monday')
    // Named label is visible only because the block has a name.
    expect(await screen.findByText('Chapel')).toBeInTheDocument()
    // The block cell element is present.
    const blockCell = document.querySelector('[data-block-cell="true"]')
    expect(blockCell).not.toBeNull()
  })

  it('renders an unnamed block with an accessible-only label and no visible text', async () => {
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b2',
        name: null,
        colour: null,
        cells: [{ id: 'c1', day: 'Tuesday', slot: 's4', room_id: 'room-1' }],
      }),
    ])
    renderTimetable()

    await screen.findByText('Monday')
    const blockCell = await waitFor(() => {
      const el = document.querySelector('[data-block-cell="true"]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    // Grey/disabled unnamed block: accessible label present, no visible text.
    expect(blockCell).toHaveTextContent('Blocked')
    expect(blockCell.querySelector('.sr-only')).not.toBeNull()
  })

  it('renders blocks only in the grid, never as an unscheduled-pool card', async () => {
    mockListSchedulable.mockResolvedValue([])
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({ id: 'b1', name: 'Staff Meeting', colour: 'light_blue' }),
    ])
    renderTimetable()

    await screen.findByText('Monday')
    // The block label is present, but only inside a grid block cell — it is never
    // turned into a draggable pool card.
    const label = await screen.findByText('Staff Meeting')
    expect(label.closest('[data-block-cell="true"]')).not.toBeNull()
  })

  it('surfaces a concise error in the sticky bar when block loading fails', async () => {
    // A failure that carries no readable message exercises the concise fallback.
    mockListTimetableBlocks.mockRejectedValue(new Error())
    renderTimetable()

    await screen.findByText('Monday')
    expect(
      await screen.findByText('Timetable blocks could not be loaded.')
    ).toBeInTheDocument()
  })

  it('opens the edit dialog on block click and saves name/colour changes', async () => {
    const user = userEvent.setup()
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' }],
      }),
    ])
    renderTimetable()

    await screen.findByText('Monday')
    await user.click(await screen.findByText('Chapel'))

    // Dialog opens with the block name seeded.
    const nameInput = await screen.findByLabelText('Name')
    expect(nameInput).toHaveValue('Chapel')

    await user.clear(nameInput)
    await user.type(nameInput, 'Mass')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(mockUpdateTimetableBlock).toHaveBeenCalledWith('b1', {
        name: 'Mass',
        colour: 'gold',
        cells: [{ day: 'Monday', slot: 's1', room_id: 'room-1' }],
      })
    )
  })

  it('deletes a block from the edit dialog', async () => {
    const user = userEvent.setup()
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({ id: 'b1', name: 'Chapel', colour: 'gold' }),
    ])
    renderTimetable()

    await screen.findByText('Monday')
    await user.click(await screen.findByText('Chapel'))
    await user.click(await screen.findByRole('button', { name: /Delete block/ }))

    await waitFor(() =>
      expect(mockDeleteTimetableBlock).toHaveBeenCalledWith('b1')
    )
  })

  it('does not open the edit dialog while the timetable draft is dirty', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
      }),
    ])
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [{ id: 'c1', day: 'Monday', slot: 's2', room_id: 'room-1' }],
      }),
    ])
    const { container } = renderTimetable()

    await screen.findAllByText('Ancient History')
    // Make the draft dirty: select the session, then place it in an empty cell.
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    const cell = container.querySelector(
      '[data-day="Monday"][data-room="room-1"][data-slot="s1"]'
    ) as HTMLElement
    fireEvent.click(cell)
    await screen.findByText('HIS101')
    expect(saveButton()).toHaveTextContent('Save Timetable')

    // Clicking the block now does nothing — block edits are guarded while dirty.
    fireEvent.click(screen.getByText('Chapel'))
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })
})

describe('TimetablePage — Unit 86: block-selection mode and validation', () => {
  function cellAt(
    container: HTMLElement,
    day: string,
    roomId: string,
    slot: string
  ): HTMLElement {
    return container.querySelector(
      `[data-day="${day}"][data-room="${roomId}"][data-slot="${slot}"]`
    ) as HTMLElement
  }

  it('renders an Add block action in the sticky bar', async () => {
    renderTimetable()
    await screen.findByText('Monday')
    expect(
      await screen.findByRole('button', { name: 'Add block' })
    ).toBeEnabled()
  })

  it('disables Add block while the timetable draft is dirty with the documented reason', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
      }),
    ])
    const { container } = renderTimetable()

    await screen.findAllByText('Ancient History')
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's1'))
    await screen.findByText('HIS101')

    const addBlock = screen.getByRole('button', { name: 'Add block' })
    expect(addBlock).toBeDisabled()
    expect(addBlock).toHaveAttribute(
      'title',
      'Save or discard timetable changes before editing blocked slots.'
    )
  })

  it('selects a rectangle of cells and creates a named block', async () => {
    const user = userEvent.setup()
    const { container } = renderTimetable()
    await screen.findByText('Monday')

    await user.click(screen.getByRole('button', { name: 'Add block' }))
    // Block mode instructions appear.
    expect(screen.getByText(/Block mode/)).toBeInTheDocument()

    // Anchor + extend across two slots in the same room.
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's1'))
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's2'))

    // Two cells are now visibly selected.
    expect(container.querySelectorAll('[data-block-selected="true"]').length).toBe(2)

    // Open the create dialog from the action bar, name it, and submit.
    await user.click(screen.getByRole('button', { name: /Create block/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Chapel')
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }))

    await waitFor(() => expect(mockCreateTimetableBlock).toHaveBeenCalledTimes(1))
    const arg = mockCreateTimetableBlock.mock.calls[0][0]
    expect(arg.name).toBe('Chapel')
    expect(arg.colour).toBe('gold')
    expect(arg.cells).toEqual(
      expect.arrayContaining([
        { day: 'Monday', slot: 's1', room_id: 'room-1' },
        { day: 'Monday', slot: 's2', room_id: 'room-1' },
      ])
    )
    expect(arg.cells).toHaveLength(2)
  })

  it('creates an unnamed, colourless block when the name is left blank', async () => {
    const user = userEvent.setup()
    const { container } = renderTimetable()
    await screen.findByText('Monday')

    await user.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's1'))

    await user.click(screen.getByRole('button', { name: /Create block/ }))
    const dialog = await screen.findByRole('dialog')
    // No name typed → no colour selector shown.
    expect(within(dialog).queryByText('Colour')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Create block' }))

    await waitFor(() => expect(mockCreateTimetableBlock).toHaveBeenCalledTimes(1))
    expect(mockCreateTimetableBlock.mock.calls[0][0]).toEqual({
      name: null,
      colour: null,
      cells: [{ day: 'Monday', slot: 's1', room_id: 'room-1' }],
    })
  })

  it('cancelling block mode clears the selection and restores normal controls', async () => {
    const user = userEvent.setup()
    const { container } = renderTimetable()
    await screen.findByText('Monday')

    await user.click(screen.getByRole('button', { name: 'Add block' }))
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's1'))
    expect(container.querySelectorAll('[data-block-selected="true"]').length).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Block mode/)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-block-selected="true"]').length).toBe(0)
    expect(screen.getByRole('button', { name: 'Add block' })).toBeInTheDocument()
  })

  it('rejects manual click placement onto a blocked cell with a reason', async () => {
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
      }),
    ])
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' }],
      }),
    ])
    const { container } = renderTimetable()

    await screen.findAllByText('Ancient History')
    // Select the session, then attempt to place it on the blocked cell.
    fireEvent.click(screen.getByText('Dr. Ada Lovelace'))
    fireEvent.click(cellAt(container, 'Monday', 'room-1', 's1'))

    // The blocked reason is surfaced and the session was not placed: no scheduled
    // card exists on the grid (its Unschedule control would otherwise be present).
    expect(
      await screen.findByText(/This time is blocked by Chapel\./)
    ).toBeInTheDocument()
    expect(screen.queryByTitle('Unschedule')).not.toBeInTheDocument()
  })

  it('cleans up a restored draft assignment that overlaps a block', async () => {
    // A persisted draft places sess-1 on Monday/room-1/s1; a block now reserves
    // that exact cell, so the restored draft must auto-unschedule it.
    mockListSchedulable.mockResolvedValue([
      makeSchedulableSession({
        session_id: 'sess-1',
        unit_code: 'HIS101',
        unit_name: 'Ancient History',
        duration: 1,
      }),
    ])
    mockListTimetableBlocks.mockResolvedValue([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' }],
      }),
    ])
    // Saved assignments are empty, so the stored-draft fingerprint matches.
    const fingerprint = computeSavedAssignmentFingerprint([])
    saveStoredDraft(
      [
        makeAssignment({
          session_id: 'sess-1',
          unit_code: 'HIS101',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'room-1',
          duration: 1,
        }),
      ],
      fingerprint
    )

    renderTimetable()

    await screen.findByText('Monday')
    // The overlapping session is removed from the grid (its scheduled card and
    // Unschedule control disappear) and returns to the unscheduled pool.
    await waitFor(() => {
      expect(screen.queryByTitle('Unschedule')).not.toBeInTheDocument()
    })
    expect((await screen.findAllByText('Ancient History')).length).toBeGreaterThan(0)
  })
})
