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
import { listUnits } from '@/lib/api/units'
import { listLecturers } from '@/lib/api/lecturers'
import { listStudents } from '@/lib/api/students'
import { listUnitSessions } from '@/lib/api/sessions'
import { makeLecturer, makeStudent } from '@/test/fixtures'

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
  it('uses the wider layout and shows derived-year or invalid-code feedback', async () => {
    const { user, dialog } = await openCreateDialog()
    const codeInput = within(dialog).getByLabelText('Unit code')
    const createButton = within(dialog).getByRole('button', { name: 'Create unit' })

    expect(dialog).toHaveClass('sm:max-w-4xl')

    await user.type(codeInput, 'HIS401')
    expect(within(dialog).getByText(/first digit must be 1, 2, or 3/)).toBeVisible()
    expect(createButton).toBeDisabled()

    await user.clear(codeInput)
    await user.type(codeInput, 'HIS101')
    expect(within(dialog).getByText(/Derived year level:/)).toHaveTextContent('Year 1')
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
