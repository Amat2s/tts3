import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
}))
vi.mock('@/lib/api/lecturers', () => ({ listLecturers: vi.fn() }))
vi.mock('@/lib/api/solver', () => ({
  startSolverRun: vi.fn(),
  getSolverRunStatus: vi.fn(),
}))

import TimetablePage from './timetable'
import { ApiRequestError } from '@/lib/api/client'
import { listRooms } from '@/lib/api/rooms'
import { listSchedulableSessions } from '@/lib/api/sessions'
import { listAssignments, saveAssignments } from '@/lib/api/assignments'
import { listLecturers } from '@/lib/api/lecturers'
import { startSolverRun, getSolverRunStatus } from '@/lib/api/solver'
import {
  makeAssignmentResponse,
  makeLecturer,
  makeRoom,
  makeSchedulableSession,
  makeSolverStatus,
} from '@/test/fixtures'

const mockListRooms = vi.mocked(listRooms)
const mockListSchedulable = vi.mocked(listSchedulableSessions)
const mockListAssignments = vi.mocked(listAssignments)
const mockSaveAssignments = vi.mocked(saveAssignments)
const mockListLecturers = vi.mocked(listLecturers)
const mockStartSolverRun = vi.mocked(startSolverRun)
const mockGetSolverRunStatus = vi.mocked(getSolverRunStatus)

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
  return screen.getByRole('button', { name: /Save Timetable/ })
}

function runSolverButton(): HTMLElement {
  return screen.getByRole('button', { name: /Run Solver/ })
}

beforeEach(() => {
  mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1', capacity: 30 })])
  mockListSchedulable.mockResolvedValue([])
  mockListAssignments.mockResolvedValue([])
  mockListLecturers.mockResolvedValue([])
  mockSaveAssignments.mockResolvedValue([])
  mockStartSolverRun.mockResolvedValue(makeSolverStatus({ status: 'running' }))
  mockGetSolverRunStatus.mockResolvedValue(makeSolverStatus({ status: 'running' }))
})

afterEach(() => {
  vi.clearAllMocks()
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
    expect(screen.getByText('Lunch')).toBeInTheDocument()
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

describe('TimetablePage — manual scheduling updates draft state only', () => {
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
    // Two saved sessions sharing an allocated student at the same time → warning.
    // (The saved assignment DTO carries allocated_student_ids, not lecturer_id.)
    mockListAssignments.mockResolvedValue([
      makeAssignmentResponse({ assignment_id: 'asg-1', session_id: 'sess-1', unit_id: 'unit-1', unit_code: 'HIS101', room_id: 'room-1', day: 'Monday', start_slot: 's1', allocated_student_ids: ['stu-1', 'stu-2'] }),
      makeAssignmentResponse({ assignment_id: 'asg-2', session_id: 'sess-2', unit_id: 'unit-2', unit_code: 'MAT200', room_id: 'room-2', day: 'Monday', start_slot: 's1', allocated_student_ids: ['stu-2'] }),
    ])
    mockListLecturers.mockResolvedValue([makeLecturer()])

    renderTimetable()

    // The disabled reason names the warning once the draft has loaded.
    expect(await screen.findByText(/scheduling warning/)).toBeInTheDocument()
    expect(runSolverButton()).toBeDisabled()
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
