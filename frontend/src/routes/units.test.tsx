import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('@/components/layout/AppFrame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api/units', () => ({
  listUnits: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
}))
vi.mock('@/lib/api/lecturers', () => ({
  listLecturers: vi.fn(),
  uploadLecturerCsv: vi.fn(),
}))
vi.mock('@/lib/api/students', () => ({
  listStudents: vi.fn(),
}))
vi.mock('@/lib/api/sessions', () => ({
  listUnitSessions: vi.fn(),
  createUnitSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
}))

import UnitsPage from './units'
import { listUnits, createUnit } from '@/lib/api/units'
import { listLecturers } from '@/lib/api/lecturers'
import { listStudents } from '@/lib/api/students'
import { listUnitSessions, createUnitSession } from '@/lib/api/sessions'
import { makeLecturer, makeStudent, makeUnit } from '@/test/fixtures'
import type { Session } from '@/lib/api/sessions'
import type { Unit } from '@/lib/api/units'

const mockListUnits = vi.mocked(listUnits)
const mockListLecturers = vi.mocked(listLecturers)
const mockListStudents = vi.mocked(listStudents)
const mockListUnitSessions = vi.mocked(listUnitSessions)

const lecturers = [
  makeLecturer({ id: 'lec-1', first_name: 'Ada', last_name: 'Lovelace' }),
  makeLecturer({ id: 'lec-2', first_name: 'Grace', last_name: 'Hopper' }),
  makeLecturer({ id: 'lec-3', first_name: 'Alan', last_name: 'Turing' }),
]

const students = [
  makeStudent({ id: 'stu-1', first_name: 'Alice', last_name: 'YearOne', year_level: 1 }),
  makeStudent({ id: 'stu-2', first_name: 'Bob', last_name: 'YearTwo', year_level: 2 }),
  makeStudent({ id: 'stu-3', first_name: 'Carol', last_name: 'AnotherOne', year_level: 1 }),
]

function renderUnits() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UnitsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

async function openCreateDialog() {
  const user = userEvent.setup()
  renderUnits()
  await user.click(await screen.findByRole('button', { name: /Create unit/ }))
  return { user, dialog: await screen.findByRole('dialog') }
}

// A unit taught by Ada (lec-1) and Grace (lec-2) — Alan Turing (lec-3) is not on
// the team, so session lecturer options should exclude him.
function makeEditableUnit(overrides: Partial<Unit> = {}): Unit {
  return makeUnit({
    id: 'unit-1',
    code: 'HIS101',
    name: 'Ancient History',
    lecturers: [
      { id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' },
      { id: 'lec-2', title: 'Dr', first_name: 'Grace', last_name: 'Hopper' },
    ],
    ...overrides,
  })
}

async function openEditDialog(unit: Unit = makeEditableUnit()) {
  const user = userEvent.setup()
  mockListUnits.mockResolvedValue([unit])
  renderUnits()
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  const dialog = await screen.findByRole('dialog')
  // Wait for the async session load to settle before interacting.
  await waitFor(() =>
    expect(within(dialog).queryByText('Loading sessions…')).not.toBeInTheDocument()
  )
  return { user, dialog }
}

beforeEach(() => {
  mockListUnits.mockResolvedValue([])
  mockListLecturers.mockResolvedValue(lecturers)
  mockListStudents.mockResolvedValue(students)
  mockListUnitSessions.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('UnitsPage post-v1 unit modal', () => {
  it('uses the wider layout and shows parser feedback under the unit-code field', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code')
    const createButton = within(dialog).getByRole('button', { name: 'Create unit' })

    expect(dialog).toHaveClass('sm:max-w-5xl')

    await user.type(codeInput, 'HIS401')
    expect(within(dialog).getByText(/Invalid unit code/)).toBeVisible()
    expect(createButton).toBeDisabled()

    await user.clear(codeInput)
    await user.type(codeInput, 'HIS101')
    expect(within(dialog).getByText('History · Orange · Year 1')).toBeVisible()
  })

  it('defaults matching-year students and supports student search and year filtering', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.type(within(dialog).getByLabelText('Unit code'), 'HIS101')

    const alice = within(dialog).getByRole('checkbox', { name: /Alice YearOne/ }) as HTMLInputElement
    const bob = within(dialog).getByRole('checkbox', { name: /Bob YearTwo/ }) as HTMLInputElement
    const carol = within(dialog).getByRole('checkbox', { name: /Carol AnotherOne/ }) as HTMLInputElement
    expect(alice.checked).toBe(true)
    expect(carol.checked).toBe(true)
    expect(bob.checked).toBe(false)

    const search = within(dialog).getByPlaceholderText('Search students')
    await user.type(search, 'Bob')
    expect(within(dialog).getByText(/Bob YearTwo/)).toBeVisible()
    expect(within(dialog).queryByText(/Alice YearOne/)).not.toBeInTheDocument()

    await user.clear(search)
    await user.click(within(dialog).getByText('All years'))
    await user.click(await screen.findByRole('option', { name: 'Year 2' }))
    expect(within(dialog).getByText(/Bob YearTwo/)).toBeVisible()
    expect(within(dialog).queryByText(/Alice YearOne/)).not.toBeInTheDocument()
  })

  it('restricts session lecturers to the selected teaching team', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.click(within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }))
    await user.click(within(dialog).getByRole('checkbox', { name: /Grace Hopper/ }))
    await user.click(within(dialog).getByRole('button', { name: /Add session/ }))
    await user.click(within(dialog).getByText('Select a lecturer'))

    expect(await screen.findByRole('option', { name: /Ada Lovelace/ })).toBeVisible()
    expect(screen.getByRole('option', { name: /Grace Hopper/ })).toBeVisible()
    expect(screen.queryByRole('option', { name: /Alan Turing/ })).not.toBeInTheDocument()
  })

  it('normalises unit code input to uppercase as the user types', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code') as HTMLInputElement

    await user.type(codeInput, 'his101')

    expect(codeInput.value).toBe('HIS101')
    expect(within(dialog).getByText('History · Orange · Year 1')).toBeVisible()
  })

  it('disables create when unit code has invalid structure', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code')

    await user.type(codeInput, 'HIS')
    expect(within(dialog).getByText(/Invalid unit code/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Create unit' })).toBeDisabled()
  })

  it('disables create when subject prefix is not supported', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code')

    await user.type(codeInput, 'ABC101')
    expect(within(dialog).getByText(/Invalid unit code/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Create unit' })).toBeDisabled()
  })

  it('disables create when year level is outside 1–3', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code')

    await user.type(codeInput, 'HIS401')
    expect(within(dialog).getByText(/Invalid unit code/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Create unit' })).toBeDisabled()
  })

  it('shows class, colour, and year for a valid parser result', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.type(within(dialog).getByLabelText('Unit code'), 'PHI201')
    expect(within(dialog).getByText('Philosophy · Blue · Year 2')).toBeVisible()

    await user.clear(within(dialog).getByLabelText('Unit code'))
    await user.type(within(dialog).getByLabelText('Unit code'), 'THE301')
    expect(within(dialog).getByText('Theology · Pink · Year 3')).toBeVisible()
  })

  it('offers only Lecture/Tutorial and clamps duration to 1-4 hours', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.click(within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }))
    await user.click(within(dialog).getByRole('button', { name: /Add session/ }))

    const decrease = within(dialog).getByRole('button', { name: 'Decrease duration' })
    const increase = within(dialog).getByRole('button', { name: 'Increase duration' })
    expect(decrease).toBeDisabled()
    expect(within(dialog).getByText('hour')).toBeVisible()

    await user.click(increase)
    await user.click(increase)
    await user.click(increase)
    await waitFor(() => expect(increase).toBeDisabled())
    expect(within(dialog).getByText('hours')).toBeVisible()
    expect(within(dialog).getByText('4')).toBeVisible()

    await user.click(within(dialog).getByText('Lecture'))
    expect(await screen.findByRole('option', { name: 'Lecture' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Tutorial' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Lab' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Workshop' })).not.toBeInTheDocument()
  })
})

function makeSessionDto(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    unit_id: 'unit-1',
    session_type: 'lecture',
    duration: 1,
    lecturer_id: 'lec-1',
    lecturer: { id: 'lec-1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' },
    created_at: '2026-06-13T00:00:00.000Z',
    updated_at: '2026-06-13T00:00:00.000Z',
    ...overrides,
  }
}

describe('Unit 82: unit modal two-column layout polish', () => {
  it('create modal renders two conceptual columns: identity/team/students and sessions', async () => {
    const { dialog } = await openCreateDialog()

    // Left column groups identity, teaching team, and students.
    expect(within(dialog).getByLabelText('Unit code')).toBeVisible()
    expect(within(dialog).getByLabelText('Unit name')).toBeVisible()
    expect(within(dialog).getByText('Teaching team')).toBeVisible()
    expect(within(dialog).getByText('Students')).toBeVisible()
    // Right column groups sessions.
    expect(within(dialog).getByText('Sessions')).toBeVisible()
  })

  it('create modal supports adding sessions on the sessions side', async () => {
    const { user, dialog } = await openCreateDialog()

    // Empty state until a session is added.
    expect(within(dialog).getByText(/No sessions yet\. Add a session/)).toBeVisible()
    const addSession = within(dialog).getByRole('button', { name: /Add session/ })
    expect(addSession).toBeVisible()

    await user.click(within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }))
    await user.click(addSession)

    // A live session box now renders and the empty state is gone.
    expect(within(dialog).getByText('Session type')).toBeVisible()
    expect(within(dialog).queryByText(/No sessions yet\. Add a session/)).not.toBeInTheDocument()
  })

  it('create save persists added sessions after creating the unit', async () => {
    vi.mocked(createUnit).mockResolvedValue(
      makeUnit({ id: 'unit-9', code: 'HIS101', name: 'Ancient History' })
    )
    vi.mocked(createUnitSession).mockResolvedValue(makeSessionDto())

    const { user, dialog } = await openCreateDialog()
    await user.type(within(dialog).getByLabelText('Unit code'), 'HIS101')
    await user.type(within(dialog).getByLabelText('Unit name'), 'Ancient History')
    // Single-lecturer team → the new session defaults to that lecturer (valid).
    await user.click(within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }))
    await user.click(within(dialog).getByRole('button', { name: /Add session/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Create unit' }))

    await waitFor(() => expect(createUnit).toHaveBeenCalled())
    await waitFor(() =>
      expect(createUnitSession).toHaveBeenCalledWith(
        'unit-9',
        expect.objectContaining({ session_type: 'lecture' })
      )
    )
  })

  it('edit modal renders live session management on the sessions side', async () => {
    mockListUnitSessions.mockResolvedValue([makeSessionDto()])
    const { dialog } = await openEditDialog()

    // Existing sessions render as live session boxes, not a no-sessions message.
    expect(within(dialog).getByText('Session type')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: /Add session/ })).toBeVisible()
    expect(
      within(dialog).queryByText(/Sessions can be added once this unit has been created/)
    ).not.toBeInTheDocument()
  })

  it('parser feedback remains visible under the unit-code field in both columns layout', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.type(within(dialog).getByLabelText('Unit code'), 'PHI201')
    expect(within(dialog).getByText('Philosophy · Blue · Year 2')).toBeVisible()
  })

  it('Clear All clears selected students only, leaving the teaching team untouched', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.click(within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }))
    await user.type(within(dialog).getByLabelText('Unit code'), 'HIS101')

    const alice = within(dialog).getByRole('checkbox', { name: /Alice YearOne/ }) as HTMLInputElement
    const ada = within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }) as HTMLInputElement
    expect(alice.checked).toBe(true)
    expect(ada.checked).toBe(true)

    await user.click(within(dialog).getByRole('button', { name: 'Clear All' }))

    expect(
      (within(dialog).getByRole('checkbox', { name: /Alice YearOne/ }) as HTMLInputElement).checked
    ).toBe(false)
    expect(
      (within(dialog).getByRole('checkbox', { name: /Carol AnotherOne/ }) as HTMLInputElement).checked
    ).toBe(false)
    // Teaching-team selection is preserved.
    expect(
      (within(dialog).getByRole('checkbox', { name: /Ada Lovelace/ }) as HTMLInputElement).checked
    ).toBe(true)
  })

  it('Select Year X Students re-selects students in the derived year', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.type(within(dialog).getByLabelText('Unit code'), 'HIS201')
    await user.click(within(dialog).getByRole('button', { name: 'Clear All' }))
    expect(
      (within(dialog).getByRole('checkbox', { name: /Bob YearTwo/ }) as HTMLInputElement).checked
    ).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Select Year 2 Students' }))
    expect(
      (within(dialog).getByRole('checkbox', { name: /Bob YearTwo/ }) as HTMLInputElement).checked
    ).toBe(true)
    expect(
      (within(dialog).getByRole('checkbox', { name: /Alice YearOne/ }) as HTMLInputElement).checked
    ).toBe(false)
  })

  it('disables the Select Year action when the unit code year is invalid', async () => {
    const { user, dialog } = await openCreateDialog()

    await user.type(within(dialog).getByLabelText('Unit code'), 'HIS')
    expect(within(dialog).getByRole('button', { name: /Select Year/ })).toBeDisabled()
    // Clear All stays available regardless of code validity.
    expect(within(dialog).getByRole('button', { name: 'Clear All' })).toBeEnabled()
  })

  it('remains usable with many students and lecturers', async () => {
    const manyStudents = Array.from({ length: 40 }, (_, i) =>
      makeStudent({ id: `stu-${i}`, first_name: `Student${i}`, last_name: 'Test', year_level: 1 })
    )
    const manyLecturers = Array.from({ length: 20 }, (_, i) =>
      makeLecturer({ id: `lec-${i}`, first_name: `Lec${i}`, last_name: 'Test' })
    )
    mockListStudents.mockResolvedValue(manyStudents)
    mockListLecturers.mockResolvedValue(manyLecturers)

    const { user, dialog } = await openCreateDialog()

    expect(within(dialog).getByText('Students')).toBeVisible()
    await user.type(within(dialog).getByPlaceholderText('Search students'), 'Student7')
    expect(within(dialog).getByRole('checkbox', { name: /Student7 Test/ })).toBeVisible()
    expect(
      within(dialog).queryByRole('checkbox', { name: /Student8 Test/ })
    ).not.toBeInTheDocument()
  })

  it('remains usable when the edit modal loads many sessions', async () => {
    const manySessions = Array.from({ length: 12 }, (_, i) =>
      makeSessionDto({ id: `sess-${i}`, session_type: i % 2 === 0 ? 'lecture' : 'tutorial' })
    )
    mockListUnitSessions.mockResolvedValue(manySessions)

    const { dialog } = await openEditDialog()

    expect(within(dialog).getAllByText('Session type')).toHaveLength(12)
  })
})

describe('UnitsPage — shared lecturer/unit upload trigger (Unit 105)', () => {
  it('shows the upload trigger and opens the shared dialog', async () => {
    const user = userEvent.setup()
    mockListUnits.mockResolvedValue([])
    mockListLecturers.mockResolvedValue([])
    mockListStudents.mockResolvedValue([])
    mockListUnitSessions.mockResolvedValue([])
    renderUnits()

    const trigger = await screen.findByRole('button', {
      name: /Upload lecturers & units/,
    })
    await user.click(trigger)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(
        /TITLE, LAST NAME, FIRST NAME, AVAILABILITY, UNIT CODE, UNIT NAME/,
      ),
    ).toBeInTheDocument()
  })
})
