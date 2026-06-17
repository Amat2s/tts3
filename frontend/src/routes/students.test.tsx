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

vi.mock('@/lib/api/students', () => ({
  listStudents: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  deleteStudent: vi.fn(),
}))
vi.mock('@/lib/api/units', () => ({
  listUnits: vi.fn(),
  updateUnit: vi.fn(),
}))

import StudentsPage from './students'
import { listStudents, createStudent, updateStudent } from '@/lib/api/students'
import { listUnits, updateUnit } from '@/lib/api/units'
import type { StudentSummary } from '@/lib/api/units'
import { makeStudent, makeUnit } from '@/test/fixtures'

const mockListStudents = vi.mocked(listStudents)
const mockCreateStudent = vi.mocked(createStudent)
const mockUpdateStudent = vi.mocked(updateStudent)
const mockListUnits = vi.mocked(listUnits)
const mockUpdateUnit = vi.mocked(updateUnit)

function renderStudents() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StudentsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

function studentSummary(student = makeStudent()): StudentSummary {
  return {
    id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    year_level: student.year_level,
  }
}

beforeEach(() => {
  mockListStudents.mockResolvedValue([])
  mockListUnits.mockResolvedValue([])
  mockCreateStudent.mockImplementation(async (data) =>
    makeStudent({
      id: 'new-student',
      first_name: data.first_name,
      last_name: data.last_name,
      year_level: data.year_level as 1 | 2 | 3,
    })
  )
  mockUpdateStudent.mockImplementation(async (id) => makeStudent({ id }))
  mockUpdateUnit.mockImplementation(async (id) => makeUnit({ id }))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('StudentsPage — enrolled unit count column', () => {
  it('renders the enrolled-unit count for each student', async () => {
    mockListStudents.mockResolvedValue([
      makeStudent({ id: 's-0', first_name: 'Zero', unit_count: 0 }),
      makeStudent({ id: 's-1', first_name: 'One', unit_count: 1 }),
      makeStudent({ id: 's-3', first_name: 'Three', unit_count: 3 }),
    ])

    renderStudents()

    expect(await screen.findByText('0 units')).toBeInTheDocument()
    expect(screen.getByText('1 unit')).toBeInTheDocument()
    expect(screen.getByText('3 units')).toBeInTheDocument()
  })
})

describe('StudentsPage — create defaults to matching-year units', () => {
  it('default-selects all units whose year matches the chosen year level', async () => {
    const user = userEvent.setup()
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 }),
      makeUnit({ id: 'u2', code: 'ENG102', name: 'Literature', year_level: 1 }),
      makeUnit({ id: 'u3', code: 'BIO201', name: 'Genetics', year_level: 2 }),
    ])

    renderStudents()
    await screen.findByRole('button', { name: /Add student/ })

    await user.click(screen.getByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')

    // Pick the year level; defaults should select both Year 1 units only.
    await user.click(within(dialog).getByText('Select a year level'))
    await user.click(await screen.findByRole('option', { name: 'Year 1' }))

    await waitFor(() =>
      expect(within(dialog).getByText('2 selected')).toBeInTheDocument()
    )

    const his = within(dialog).getByRole('checkbox', { name: /HIS101/ }) as HTMLInputElement
    const eng = within(dialog).getByRole('checkbox', { name: /ENG102/ }) as HTMLInputElement
    const bio = within(dialog).getByRole('checkbox', { name: /BIO201/ }) as HTMLInputElement
    expect(his.checked).toBe(true)
    expect(eng.checked).toBe(true)
    expect(bio.checked).toBe(false)
  })
})

describe('StudentsPage — edit persists enrolment via the shared unit relationship', () => {
  it('loads current units and writes add/remove changes to the units endpoint', async () => {
    const user = userEvent.setup()
    const enrolled = makeStudent({
      id: 'stu-1',
      first_name: 'Edith',
      year_level: 1,
      units: [{ id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 }],
      unit_count: 1,
    })
    mockListStudents.mockResolvedValue([enrolled])
    mockListUnits.mockResolvedValue([
      makeUnit({
        id: 'u1',
        code: 'HIS101',
        name: 'Ancient History',
        year_level: 1,
        students: [studentSummary(enrolled)],
      }),
      makeUnit({ id: 'u2', code: 'ENG102', name: 'Literature', year_level: 1, students: [] }),
    ])

    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const dialog = await screen.findByRole('dialog')

    // Current enrolment is loaded: HIS101 checked, ENG102 not.
    const his = within(dialog).getByRole('checkbox', { name: /HIS101/ }) as HTMLInputElement
    const eng = within(dialog).getByRole('checkbox', { name: /ENG102/ }) as HTMLInputElement
    expect(his.checked).toBe(true)
    expect(eng.checked).toBe(false)

    // Add ENG102, remove HIS101.
    await user.click(eng)
    await user.click(his)

    await user.click(within(dialog).getByRole('button', { name: /Save changes/ }))

    await waitFor(() => expect(mockUpdateStudent).toHaveBeenCalledTimes(1))
    expect(mockUpdateStudent).toHaveBeenCalledWith(
      'stu-1',
      expect.objectContaining({ first_name: 'Edith', year_level: 1 })
    )

    await waitFor(() => expect(mockUpdateUnit).toHaveBeenCalledTimes(2))
    // ENG102 gains the student; HIS101 loses them — the same unit-student
    // relationship the /units page edits.
    expect(mockUpdateUnit).toHaveBeenCalledWith('u2', { student_ids: ['stu-1'] })
    expect(mockUpdateUnit).toHaveBeenCalledWith('u1', { student_ids: [] })
  })
})
