import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// The Supabase client is built at import time from env vars; stub it so the API
// client layer never reaches a real network/env dependency.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('@/components/layout/AppFrame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api/rooms', () => ({
  listRooms: vi.fn(),
}))
vi.mock('@/lib/api/lecturers', () => ({
  listLecturers: vi.fn(),
}))
vi.mock('@/lib/api/lecturerPreferences', () => ({
  listLecturerPreferences: vi.fn(),
  upsertLecturerPreference: vi.fn(),
  deleteLecturerPreference: vi.fn(),
}))

import PreferencesPage from './preferences'
import { listRooms } from '@/lib/api/rooms'
import { listLecturers } from '@/lib/api/lecturers'
import {
  listLecturerPreferences,
  upsertLecturerPreference,
  deleteLecturerPreference,
  type LecturerPreference,
} from '@/lib/api/lecturerPreferences'
import { makeLecturer, makeRoom } from '@/test/fixtures'

const mockListRooms = vi.mocked(listRooms)
const mockListLecturers = vi.mocked(listLecturers)
const mockListPreferences = vi.mocked(listLecturerPreferences)
const mockUpsert = vi.mocked(upsertLecturerPreference)
const mockDelete = vi.mocked(deleteLecturerPreference)

function renderPreferences() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PreferencesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

// A small in-test fake of the backend's preference store so that the
// invalidate-on-settle refetch reflects real persisted state.
let server: LecturerPreference[] = []

function pref(over: Partial<LecturerPreference>): LecturerPreference {
  return {
    id: `p-${Math.random()}`,
    lecturer_id: 'lec-1',
    day: 'Monday',
    slot: 's1',
    room_id: 'room-1',
    level: 'preferred',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

function wireFakeServer() {
  mockListPreferences.mockImplementation(async (lecturerId: string) =>
    server.filter((p) => p.lecturer_id === lecturerId).map((p) => ({ ...p }))
  )
  mockUpsert.mockImplementation(async (cell) => {
    server = server.filter(
      (p) =>
        !(
          p.lecturer_id === cell.lecturer_id &&
          p.day === cell.day &&
          p.slot === cell.slot &&
          p.room_id === cell.room_id
        )
    )
    const row = pref(cell)
    server.push(row)
    return row
  })
  mockDelete.mockImplementation(async (cell) => {
    server = server.filter(
      (p) =>
        !(
          p.lecturer_id === cell.lecturer_id &&
          p.day === cell.day &&
          p.slot === cell.slot &&
          p.room_id === cell.room_id
        )
    )
  })
}

async function selectLecturer(user: ReturnType<typeof userEvent.setup>, name: string) {
  // Click the trigger element itself (its label changes to the selected name
  // after the first pick, so we can't rely on the placeholder text).
  const trigger = document.querySelector<HTMLElement>(
    '[data-slot="select-trigger"]'
  )
  if (!trigger) throw new Error('lecturer select trigger not found')
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name }))
}

function cellEl(day: string, roomId: string, slotId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(
    `[data-preference-cell="true"][data-day="${day}"][data-room="${roomId}"][data-slot="${slotId}"]`
  )
  if (!el) throw new Error(`cell ${day}/${roomId}/${slotId} not found`)
  return el
}

beforeEach(() => {
  server = []
  mockListRooms.mockResolvedValue([])
  mockListLecturers.mockResolvedValue([])
  wireFakeServer()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('PreferencesPage — grid shell (Unit 99)', () => {
  it('renders the same day/room/slot structure as the timetable, with no sessions', async () => {
    mockListRooms.mockResolvedValue([
      makeRoom({ id: 'room-1', name: 'Room A' }),
      makeRoom({ id: 'room-2', name: 'Room B' }),
    ])
    renderPreferences()

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(await screen.findByText(day)).toBeInTheDocument()
    }
    expect(screen.getAllByText('Room A')).toHaveLength(5)
    expect(screen.getAllByText('Room B')).toHaveLength(5)
    expect(screen.getByText('9:00-9:50')).toBeInTheDocument()
    expect(screen.getByText('4:30-5:20')).toBeInTheDocument()
    expect(screen.getByText('Lunch/Mass')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-preference-cell="true"]').length)
      .toBeGreaterThan(0)
  })

  it('shows the shared empty-state pattern when no rooms exist', async () => {
    mockListRooms.mockResolvedValue([])
    renderPreferences()

    expect(await screen.findByText('No rooms available')).toBeInTheDocument()
    expect(screen.getByText(/requires at least one room/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create rooms' })).toHaveAttribute(
      'href',
      '/rooms'
    )
    expect(document.querySelector('[data-preference-cell="true"]')).toBeNull()
  })

  it('lists lecturers and does not load preferences until one is selected', async () => {
    const user = userEvent.setup()
    mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1' })])
    mockListLecturers.mockResolvedValue([
      makeLecturer({ id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' }),
    ])
    renderPreferences()

    await screen.findByText('Monday')
    // No lecturer selected yet: no Unit 98 preference call.
    expect(mockListPreferences).not.toHaveBeenCalled()

    await selectLecturer(user, 'Dr Ada Lovelace')
    await waitFor(() =>
      expect(mockListPreferences).toHaveBeenCalledWith('lec-1')
    )
  })
})

describe('PreferencesPage — preference API integration (Unit 100)', () => {
  beforeEach(() => {
    mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1', name: 'Room A' })])
    mockListLecturers.mockResolvedValue([
      makeLecturer({ id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' }),
      makeLecturer({ id: 'lec-2', title: 'Prof.', first_name: 'Grace', last_name: 'Hopper' }),
    ])
  })

  it('renders a selected lecturer’s saved preference cells', async () => {
    server = [pref({ lecturer_id: 'lec-1', day: 'Monday', slot: 's1', room_id: 'room-1', level: 'avoid' })]
    const user = userEvent.setup()
    renderPreferences()
    await screen.findByText('Monday')

    await selectLecturer(user, 'Dr Ada Lovelace')
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'avoid')
    )
    expect(cellEl('Monday', 'room-1', 's1')).toHaveTextContent('Avoid')
  })

  it('cycles a cell neutral -> preferred -> avoid -> neutral, persisting each click', async () => {
    const user = userEvent.setup()
    renderPreferences()
    await screen.findByText('Monday')
    await selectLecturer(user, 'Dr Ada Lovelace')
    await waitFor(() => expect(mockListPreferences).toHaveBeenCalledWith('lec-1'))

    // neutral -> preferred (upsert)
    await user.click(cellEl('Monday', 'room-1', 's1'))
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'preferred')
    )
    expect(mockUpsert).toHaveBeenLastCalledWith({
      lecturer_id: 'lec-1', day: 'Monday', slot: 's1', room_id: 'room-1', level: 'preferred',
    })

    // preferred -> avoid (upsert)
    await user.click(cellEl('Monday', 'room-1', 's1'))
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'avoid')
    )
    expect(mockUpsert).toHaveBeenLastCalledWith({
      lecturer_id: 'lec-1', day: 'Monday', slot: 's1', room_id: 'room-1', level: 'avoid',
    })

    // avoid -> neutral (delete)
    await user.click(cellEl('Monday', 'room-1', 's1'))
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'neutral')
    )
    expect(mockDelete).toHaveBeenLastCalledWith({
      lecturer_id: 'lec-1', day: 'Monday', slot: 's1', room_id: 'room-1',
    })
  })

  it('does not persist clicks until a lecturer is selected', async () => {
    const user = userEvent.setup()
    renderPreferences()
    await screen.findByText('Monday')

    await user.click(cellEl('Monday', 'room-1', 's1'))
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('switches lecturers with no cross-lecturer cell bleed', async () => {
    server = [
      pref({ lecturer_id: 'lec-1', day: 'Monday', slot: 's1', room_id: 'room-1', level: 'preferred' }),
      pref({ lecturer_id: 'lec-2', day: 'Monday', slot: 's1', room_id: 'room-1', level: 'avoid' }),
    ]
    const user = userEvent.setup()
    renderPreferences()
    await screen.findByText('Monday')

    await selectLecturer(user, 'Dr Ada Lovelace')
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'preferred')
    )

    await selectLecturer(user, 'Prof. Grace Hopper')
    await waitFor(() =>
      expect(cellEl('Monday', 'room-1', 's1')).toHaveAttribute('data-level', 'avoid')
    )
  })

  it('surfaces a preference load error near the grid', async () => {
    mockListPreferences.mockRejectedValue(new Error('Failed to load preferences.'))
    const user = userEvent.setup()
    renderPreferences()
    await screen.findByText('Monday')

    await selectLecturer(user, 'Dr Ada Lovelace')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to load preferences.')
  })
})
