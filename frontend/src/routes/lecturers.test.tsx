import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// --- Module mocks --------------------------------------------------------
// The Supabase client is built at import time from env vars; stub it so the API
// client layer never reaches a real network/env dependency.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('@/components/layout/AppFrame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api/lecturers', () => ({
  listLecturers: vi.fn(),
  createLecturer: vi.fn(),
  updateLecturer: vi.fn(),
  deleteLecturer: vi.fn(),
  setLecturerAvailability: vi.fn(),
}))
vi.mock('@/lib/api/units', () => ({
  listUnits: vi.fn(),
}))

import LecturersPage from './lecturers'
import { listLecturers, updateLecturer } from '@/lib/api/lecturers'
import { listUnits } from '@/lib/api/units'
import type { LecturerSummary } from '@/lib/api/units'
import { makeLecturer, makeUnit } from '@/test/fixtures'

const mockListLecturers = vi.mocked(listLecturers)
const mockUpdateLecturer = vi.mocked(updateLecturer)
const mockListUnits = vi.mocked(listUnits)

function renderLecturers() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LecturersPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

function lecturerSummary(lecturer = makeLecturer()): LecturerSummary {
  return {
    id: lecturer.id,
    title: lecturer.title,
    first_name: lecturer.first_name,
    last_name: lecturer.last_name,
  }
}

beforeEach(() => {
  mockListLecturers.mockResolvedValue([])
  mockListUnits.mockResolvedValue([])
  mockUpdateLecturer.mockImplementation(async (id) => makeLecturer({ id }))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LecturersPage — title selector (Unit 72/73/75)', () => {
  it('create form title selector offers exactly the final product title list', async () => {
    const user = userEvent.setup()
    mockListLecturers.mockResolvedValue([])
    renderLecturers()
    await user.click(await screen.findByRole('button', { name: /Add lecturer/ }))
    const dialog = await screen.findByRole('dialog')

    // Open the Title select.
    await user.click(within(dialog).getByText('Select a title'))

    const expected = ['Mr', 'Ms', 'Mrs', 'Dr', 'Fr', 'A/Prof.', 'Prof.']
    for (const title of expected) {
      expect(await screen.findByRole('option', { name: title })).toBeInTheDocument()
    }
    // Enforce that ONLY those titles exist — no extra/unexpected options.
    expect(screen.getAllByRole('option')).toHaveLength(expected.length)
  })
})

describe('LecturersPage — subject and year filters', () => {
  it('subject filter options are derived from valid unit codes only', async () => {
    const user = userEvent.setup()
    const teaching = makeLecturer({ id: 'lec-1' })
    mockListLecturers.mockResolvedValue([teaching])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', lecturers: [lecturerSummary(teaching)] }),
      // ENG is not a supported prefix.
      makeUnit({ id: 'u2', code: 'ENG102', name: 'Unsupported', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()
    // Wait for lecturer data to load (FilterBar renders after data arrives).
    await screen.findByText('Lovelace')

    // Open the subject filter.
    await user.click(screen.getByLabelText('Filter by subject'))
    await screen.findByRole('option', { name: 'History' })
    // Assert the complete option set rather than just the absence of an /ENG/
    // label — this catches an invalid ENG code surfacing under any label.
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All subjects',
      'History',
    ])
  })

  it('year filter select is rendered when lecturers are loaded', async () => {
    const teaching = makeLecturer({ id: 'lec-1' })
    mockListLecturers.mockResolvedValue([teaching])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()
    await screen.findByText('Lovelace')

    // The year filter select label should be present.
    expect(screen.getByLabelText('Filter by year')).toBeInTheDocument()
  })
})

describe('LecturersPage — taught units column', () => {
  it('shows taught units by code and a clear empty state', async () => {
    const teaching = makeLecturer({ id: 'lec-1', first_name: 'Ada', last_name: 'Lovelace' })
    const idle = makeLecturer({ id: 'lec-2', first_name: 'Grace', last_name: 'Hopper' })
    mockListLecturers.mockResolvedValue([teaching, idle])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', lecturers: [lecturerSummary(teaching)] }),
      makeUnit({ id: 'u2', code: 'ENG102', name: 'Literature', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()

    // The teaching lecturer shows each taught unit code.
    expect(await screen.findByText('HIS101')).toBeInTheDocument()
    expect(screen.getByText('ENG102')).toBeInTheDocument()
    // The lecturer who teaches nothing has a clear empty teaching state.
    expect(screen.getByText('No units assigned')).toBeInTheDocument()
  })

  it('collapses a long teaching list into a "+N more" chip', async () => {
    const teaching = makeLecturer({ id: 'lec-1' })
    mockListLecturers.mockResolvedValue([teaching])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'AAA101', name: 'A', lecturers: [lecturerSummary(teaching)] }),
      makeUnit({ id: 'u2', code: 'BBB101', name: 'B', lecturers: [lecturerSummary(teaching)] }),
      makeUnit({ id: 'u3', code: 'CCC101', name: 'C', lecturers: [lecturerSummary(teaching)] }),
      makeUnit({ id: 'u4', code: 'DDD101', name: 'D', lecturers: [lecturerSummary(teaching)] }),
      makeUnit({ id: 'u5', code: 'EEE101', name: 'E', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()

    // First three (sorted by code) shown inline; remaining two collapsed.
    expect(await screen.findByText('AAA101')).toBeInTheDocument()
    expect(screen.getByText('BBB101')).toBeInTheDocument()
    expect(screen.getByText('CCC101')).toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
    expect(screen.queryByText('DDD101')).not.toBeInTheDocument()
  })
})

describe('LecturersPage — edit modal is read-only for teaching', () => {
  it('shows a read-only taught-units summary with helper text and no edit controls', async () => {
    const user = userEvent.setup()
    const teaching = makeLecturer({ id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' })
    mockListLecturers.mockResolvedValue([teaching])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()
    await screen.findByText('Lovelace')

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const dialog = await screen.findByRole('dialog')

    // Read-only summary names the taught unit and the source-of-truth helper text.
    expect(within(dialog).getByText('HIS101 — Ancient History')).toBeInTheDocument()
    expect(
      within(dialog).getByText('Teaching assignments are managed from Units.')
    ).toBeInTheDocument()
    // No editable unit assignment controls exist on the lecturer modal.
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
  })

  it('does not send any unit IDs when saving a lecturer edit', async () => {
    const user = userEvent.setup()
    const teaching = makeLecturer({ id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' })
    mockListLecturers.mockResolvedValue([teaching])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', lecturers: [lecturerSummary(teaching)] }),
    ])

    renderLecturers()
    await screen.findByText('Lovelace')

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByRole('button', { name: /Save changes/ }))

    await waitFor(() => expect(mockUpdateLecturer).toHaveBeenCalledTimes(1))
    const [, payload] = mockUpdateLecturer.mock.calls[0]
    expect(payload).toEqual({ title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' })
    // Defensive: no unit-related key is ever submitted from the lecturer modal.
    expect(Object.keys(payload).some((k) => k.includes('unit'))).toBe(false)
  })
})
