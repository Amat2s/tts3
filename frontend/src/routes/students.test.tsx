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
  deleteAllStudents: vi.fn(),
  uploadStudentCsv: vi.fn(),
}))
vi.mock('@/lib/api/units', () => ({
  listUnits: vi.fn(),
  updateUnit: vi.fn(),
}))

import StudentsPage from './students'
import {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  uploadStudentCsv,
} from '@/lib/api/students'
import type { StudentImportResult } from '@/lib/api/students'
import { listUnits, updateUnit } from '@/lib/api/units'
import type { StudentSummary } from '@/lib/api/units'
import { ApiRequestError } from '@/lib/api/client'
import { makeStudent, makeUnit } from '@/test/fixtures'

const mockListStudents = vi.mocked(listStudents)
const mockCreateStudent = vi.mocked(createStudent)
const mockUpdateStudent = vi.mocked(updateStudent)
const mockDeleteStudent = vi.mocked(deleteStudent)
const mockDeleteAllStudents = vi.mocked(deleteAllStudents)
const mockUploadStudentCsv = vi.mocked(uploadStudentCsv)
const mockListUnits = vi.mocked(listUnits)
const mockUpdateUnit = vi.mocked(updateUnit)

const EMPTY_IMPORT_RESULT: StudentImportResult = {
  created_students: 0,
  updated_students: 0,
  added_enrolments: 0,
  skipped_unknown_unit_rows: 0,
  skipped_invalid_rows: 0,
  skipped_past_census_rows: 0,
  deduped_rows: 0,
}

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
      student_number: data.student_number,
      first_name: data.first_name,
      last_name: data.last_name,
      year_level: data.year_level as 1 | 2 | 3,
    })
  )
  mockUpdateStudent.mockImplementation(async (id) => makeStudent({ id }))
  mockUpdateUnit.mockImplementation(async (id) => makeUnit({ id }))
  mockUploadStudentCsv.mockResolvedValue(EMPTY_IMPORT_RESULT)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('StudentsPage — title removal (Unit 72/73/75)', () => {
  it('student create form has no title field', async () => {
    const user = userEvent.setup()
    renderStudents()
    await user.click(await screen.findByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')
    // No element labelled "title" should exist in the form.
    expect(within(dialog).queryByText(/^Title$/i)).toBeNull()
  })

  it('student table has no title column header', async () => {
    mockListStudents.mockResolvedValue([makeStudent({ id: 's1', first_name: 'Alice' })])
    renderStudents()
    await screen.findByText('Alice')
    const headers = screen.getAllByRole('columnheader')
    expect(headers.every((h) => !/^title$/i.test(h.textContent?.trim() ?? ''))).toBe(true)
  })
})

describe('StudentsPage — subject filter', () => {
  it('subject filter options are derived from valid unit codes only', async () => {
    const user = userEvent.setup()
    // HIS101 is valid (History); ENG102 has an unsupported prefix.
    mockListStudents.mockResolvedValue([
      makeStudent({
        id: 's1',
        first_name: 'Alice',
        units: [{ id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 }],
        unit_count: 1,
      }),
    ])
    mockListUnits.mockResolvedValue([
      makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 }),
      makeUnit({ id: 'u2', code: 'ENG102', name: 'Unsupported', year_level: 1 }),
    ])

    renderStudents()
    await screen.findByText('Alice')

    // Open the subject filter select.
    await user.click(screen.getByLabelText('Filter by subject'))
    // History (HIS) should appear; ENG is invalid and must not appear.
    expect(await screen.findByRole('option', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /ENG/ })).toBeNull()
  })
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

// --- Unit 91: student number field + CSV upload ---------------------------

async function selectYear(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  year: number
) {
  await user.click(within(dialog).getByText('Select a year level'))
  await user.click(await screen.findByRole('option', { name: `Year ${year}` }))
}

describe('StudentsPage — student number field (Unit 91)', () => {
  it('shows the student number field in the create form', async () => {
    const user = userEvent.setup()
    renderStudents()
    await user.click(await screen.findByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Student number')).toBeInTheDocument()
  })

  it('initializes the edit form from the existing student number', async () => {
    const user = userEvent.setup()
    mockListStudents.mockResolvedValue([
      makeStudent({ id: 'stu-1', first_name: 'Edith', student_number: '20240007' }),
    ])
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Student number')).toHaveValue('20240007')
  })

  it('disables create until the student number is exactly 8 digits', async () => {
    const user = userEvent.setup()
    renderStudents()
    await user.click(await screen.findByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('First name'), 'Alex')
    await user.type(within(dialog).getByLabelText('Last name'), 'Johnson')
    await selectYear(user, dialog, 1)

    // An invalid (too short) student number keeps the button disabled and shows
    // the inline format error.
    await user.type(within(dialog).getByLabelText('Student number'), '123')
    const submit = within(dialog).getByRole('button', { name: /Add student/ })
    expect(submit).toBeDisabled()
    expect(
      within(dialog).getByText('Student number must be exactly 8 digits.')
    ).toBeInTheDocument()

    // A valid 8-digit number enables submission.
    await user.clear(within(dialog).getByLabelText('Student number'))
    await user.type(within(dialog).getByLabelText('Student number'), '20251234')
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('submits a valid student number on create', async () => {
    const user = userEvent.setup()
    renderStudents()
    await user.click(await screen.findByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('Student number'), '20251234')
    await user.type(within(dialog).getByLabelText('First name'), 'Alex')
    await user.type(within(dialog).getByLabelText('Last name'), 'Johnson')
    await selectYear(user, dialog, 2)

    const submit = within(dialog).getByRole('button', { name: /Add student/ })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await waitFor(() => expect(mockCreateStudent).toHaveBeenCalledTimes(1))
    expect(mockCreateStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        student_number: '20251234',
        first_name: 'Alex',
        last_name: 'Johnson',
        year_level: 2,
      })
    )
  })

  it('keeps year level manually editable and never derives it from the number', async () => {
    const user = userEvent.setup()
    renderStudents()
    await user.click(await screen.findByRole('button', { name: /Add student/ }))
    const dialog = await screen.findByRole('dialog')

    // Typing a student number must not auto-fill the year level — the year
    // selector stays on its placeholder until the admin chooses a value.
    await user.type(within(dialog).getByLabelText('Student number'), '20251234')
    expect(within(dialog).getByText('Select a year level')).toBeInTheDocument()

    await selectYear(user, dialog, 3)
    expect(within(dialog).getByText('Year 3')).toBeInTheDocument()
  })

  it('edit form shows the stored year level, not one derived from the number', async () => {
    const user = userEvent.setup()
    // Number derives to a different (capped) year; the stored Year 1 must win.
    mockListStudents.mockResolvedValue([
      makeStudent({ id: 'stu-1', first_name: 'Edith', student_number: '20231234', year_level: 1 }),
    ])
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Year 1')).toBeInTheDocument()
  })

  it('shows the student number column in the table', async () => {
    mockListStudents.mockResolvedValue([
      makeStudent({ id: 's1', first_name: 'Alice', student_number: '20240001' }),
    ])
    renderStudents()
    await screen.findByText('Alice')
    expect(
      screen.getByRole('columnheader', { name: 'Student number' })
    ).toBeInTheDocument()
    expect(screen.getByText('20240001')).toBeInTheDocument()
  })

  it('search matches the student number', async () => {
    const user = userEvent.setup()
    mockListStudents.mockResolvedValue([
      makeStudent({ id: 's1', first_name: 'Alice', student_number: '20240001' }),
      makeStudent({ id: 's2', first_name: 'Bob', student_number: '20240002' }),
    ])
    renderStudents()
    await screen.findByText('Alice')

    await user.type(
      screen.getByLabelText('Search students by name or student number'),
      '20240002'
    )

    await waitFor(() => expect(screen.queryByText('Alice')).toBeNull())
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })
})

describe('StudentsPage — CSV upload (Unit 91)', () => {
  function csvFile(name = 'students.csv') {
    return new File(['Student number,first name'], name, { type: 'text/csv' })
  }

  async function openUploadDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole('button', { name: /Upload student information/ })
    )
    return screen.findByRole('dialog')
  }

  it('opens the upload dialog and explains the expected format', async () => {
    const user = userEvent.setup()
    renderStudents()
    const dialog = await openUploadDialog(user)

    expect(within(dialog).getByText(/Expected CSV columns/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        /Student number, first name, last name, scheduled unit code, dest census date/
      )
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/dd\/mm\/yyyy/)).toBeInTheDocument()
  })

  it('disables upload until a file is selected', async () => {
    const user = userEvent.setup()
    renderStudents()
    const dialog = await openUploadDialog(user)

    const uploadBtn = within(dialog).getByRole('button', { name: 'Upload' })
    expect(uploadBtn).toBeDisabled()

    await user.upload(within(dialog).getByLabelText('CSV file'), csvFile())
    expect(uploadBtn).toBeEnabled()
  })

  it('sends the selected file through the API client', async () => {
    const user = userEvent.setup()
    renderStudents()
    const dialog = await openUploadDialog(user)

    const file = csvFile()
    await user.upload(within(dialog).getByLabelText('CSV file'), file)
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    await waitFor(() => expect(mockUploadStudentCsv).toHaveBeenCalledTimes(1))
    expect(mockUploadStudentCsv).toHaveBeenCalledWith(file)
  })

  it('shows the aggregate summary on success without the past-census count', async () => {
    const user = userEvent.setup()
    mockUploadStudentCsv.mockResolvedValue({
      created_students: 2,
      updated_students: 1,
      added_enrolments: 3,
      skipped_unknown_unit_rows: 1,
      skipped_invalid_rows: 0,
      skipped_past_census_rows: 5,
      deduped_rows: 0,
    })
    renderStudents()
    const dialog = await openUploadDialog(user)

    await user.upload(within(dialog).getByLabelText('CSV file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(await within(dialog).findByText('Import complete')).toBeInTheDocument()
    expect(within(dialog).getByText('Created students')).toBeInTheDocument()
    expect(within(dialog).getByText('Updated students')).toBeInTheDocument()
    expect(within(dialog).getByText('Added enrolments')).toBeInTheDocument()
    expect(within(dialog).getByText('Skipped unknown-unit rows')).toBeInTheDocument()
    // Zero invalid rows are not surfaced, and the past-census count never is
    // (the "dest census date" header in the format help is unrelated copy).
    expect(within(dialog).queryByText('Skipped invalid rows')).toBeNull()
    expect(within(dialog).queryByText(/past[- ]census/i)).toBeNull()
    expect(within(dialog).queryByText('5')).toBeNull()
  })

  it('surfaces a structural backend error clearly', async () => {
    const user = userEvent.setup()
    mockUploadStudentCsv.mockRejectedValue(
      new Error(
        'CSV header must contain exactly these columns (case- and spacing-tolerant): Student number, first name, last name, scheduled unit code, dest census date.'
      )
    )
    renderStudents()
    const dialog = await openUploadDialog(user)

    await user.upload(within(dialog).getByLabelText('CSV file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(
      await within(dialog).findByText(/CSV header must contain exactly these columns/)
    ).toBeInTheDocument()
  })

  it('invalidates dependent queries after a successful upload', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderStudents()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const dialog = await openUploadDialog(user)
    await user.upload(within(dialog).getByLabelText('CSV file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    await waitFor(() => expect(mockUploadStudentCsv).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['students'] })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['units'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['schedulable-sessions'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assignments'] })
  })
})

// Unit 112: surfacing the Unit 111 structured delete-blocked reason.
describe('StudentsPage — delete-blocked error surfacing (Unit 112)', () => {
  it('shows the backend reason and keeps the row when the delete is blocked', async () => {
    const user = userEvent.setup()
    mockListStudents.mockResolvedValue([makeStudent({ id: 'stu-1', first_name: 'Edith' })])
    mockDeleteStudent.mockRejectedValue(
      new ApiRequestError({
        status: 409,
        message: "Can't delete this student yet — they're still referenced elsewhere.",
        detail: {
          error: {
            code: 'student_delete_blocked',
            message: "Can't delete this student yet — they're still referenced elsewhere.",
          },
        },
      })
    )
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete student/ }))

    expect(
      await screen.findByText("Can't delete this student yet — they're still referenced elsewhere.")
    ).toBeInTheDocument()
    // The row must stay present; a blocked delete never optimistically removes it.
    expect(screen.getByText('Edith')).toBeInTheDocument()
  })

  it('falls back to a generic reason when no structured message is present', async () => {
    const user = userEvent.setup()
    mockListStudents.mockResolvedValue([makeStudent({ id: 'stu-1', first_name: 'Edith' })])
    mockDeleteStudent.mockRejectedValue(new Error('boom'))
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete student/ }))

    expect(await screen.findByText("Couldn't delete — it's still in use.")).toBeInTheDocument()
    expect(screen.getByText('Edith')).toBeInTheDocument()
  })

  it('removes the row with no error on a successful delete', async () => {
    const user = userEvent.setup()
    mockDeleteStudent.mockResolvedValue(undefined)
    mockListStudents
      .mockResolvedValueOnce([makeStudent({ id: 'stu-1', first_name: 'Edith' })])
      .mockResolvedValueOnce([])
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete student/ }))

    await waitFor(() => expect(screen.queryByText('Edith')).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('StudentsPage — delete all students', () => {
  it('shows a Delete all button above the table and removes every row on confirm', async () => {
    const user = userEvent.setup()
    mockDeleteAllStudents.mockResolvedValue(undefined)
    mockListStudents
      .mockResolvedValueOnce([makeStudent({ id: 'stu-1', first_name: 'Edith' })])
      .mockResolvedValueOnce([])
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: 'Delete all' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Delete all students' }))

    expect(mockDeleteAllStudents).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('Edith')).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('surfaces the backend reason and keeps rows when delete all is blocked', async () => {
    const user = userEvent.setup()
    mockListStudents.mockResolvedValue([makeStudent({ id: 'stu-1', first_name: 'Edith' })])
    mockDeleteAllStudents.mockRejectedValue(
      new ApiRequestError({
        status: 409,
        message: "Can't delete all students yet — some are still referenced elsewhere.",
        detail: {
          error: {
            code: 'student_delete_blocked',
            message: "Can't delete all students yet — some are still referenced elsewhere.",
          },
        },
      })
    )
    renderStudents()
    await screen.findByText('Edith')

    await user.click(screen.getByRole('button', { name: 'Delete all' }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Delete all students' }))

    expect(
      await screen.findByText("Can't delete all students yet — some are still referenced elsewhere.")
    ).toBeInTheDocument()
    expect(screen.getByText('Edith')).toBeInTheDocument()
  })
})
