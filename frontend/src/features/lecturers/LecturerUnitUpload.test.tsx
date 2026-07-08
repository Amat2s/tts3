import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// The Supabase client is built at import time from env vars; stub it so the API
// client layer never reaches a real network/env dependency.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('@/lib/api/lecturers', () => ({
  uploadLecturerCsv: vi.fn(),
}))

import { LecturerUnitUpload } from './LecturerUnitUpload'
import { uploadLecturerCsv } from '@/lib/api/lecturers'
import type { LecturerImportResult } from '@/lib/api/lecturers'

const mockUploadLecturerCsv = vi.mocked(uploadLecturerCsv)

const EMPTY_IMPORT_RESULT: LecturerImportResult = {
  created_lecturers: 0,
  created_units: 0,
  added_team_memberships: 0,
  skipped_invalid_rows: 0,
  deduped_rows: 0,
}

function renderUpload() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <LecturerUnitUpload />
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

function csvFile(name = 'lecturers.csv') {
  return new File(['TITLE,LAST NAME'], name, { type: 'text/csv' })
}

async function openUploadDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: /Upload lecturers & units/ })
  )
  return screen.findByRole('dialog')
}

beforeEach(() => {
  mockUploadLecturerCsv.mockResolvedValue(EMPTY_IMPORT_RESULT)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LecturerUnitUpload (Unit 105)', () => {
  it('opens the dialog and explains the expected columns and file types', async () => {
    const user = userEvent.setup()
    renderUpload()
    const dialog = await openUploadDialog(user)

    expect(
      within(dialog).getByText(
        /TITLE, LAST NAME, FIRST NAME, AVAILABILITY, UNIT CODE, UNIT NAME/
      )
    ).toBeInTheDocument()
    // AVAILABILITY is documented as accepted-but-not-imported.
    expect(within(dialog).getByText(/accepted but not\s+imported yet/)).toBeInTheDocument()
    // The native file input accepts both CSV and Excel.
    const input = within(dialog).getByLabelText('CSV or Excel file')
    expect(input).toHaveAttribute('accept', '.csv,.xlsx')
  })

  it('disables upload until a file is selected', async () => {
    const user = userEvent.setup()
    renderUpload()
    const dialog = await openUploadDialog(user)

    const uploadBtn = within(dialog).getByRole('button', { name: 'Upload' })
    expect(uploadBtn).toBeDisabled()

    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), csvFile())
    expect(uploadBtn).toBeEnabled()
  })

  it('sends the selected file as multipart through the API client', async () => {
    const user = userEvent.setup()
    renderUpload()
    const dialog = await openUploadDialog(user)

    const file = csvFile()
    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), file)
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    await waitFor(() => expect(mockUploadLecturerCsv).toHaveBeenCalledTimes(1))
    expect(mockUploadLecturerCsv).toHaveBeenCalledWith(file)
  })

  it('shows the aggregate summary of returned counts on success', async () => {
    const user = userEvent.setup()
    mockUploadLecturerCsv.mockResolvedValue({
      created_lecturers: 3,
      created_units: 2,
      added_team_memberships: 4,
      skipped_invalid_rows: 0,
      deduped_rows: 0,
    })
    renderUpload()
    const dialog = await openUploadDialog(user)

    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(await within(dialog).findByText('Import complete')).toBeInTheDocument()
    expect(within(dialog).getByText('Created lecturers')).toBeInTheDocument()
    expect(within(dialog).getByText('Created units')).toBeInTheDocument()
    expect(within(dialog).getByText('Added team memberships')).toBeInTheDocument()
    // Zero invalid/deduped rows are not surfaced.
    expect(within(dialog).queryByText('Skipped invalid rows')).toBeNull()
    expect(within(dialog).queryByText('Deduped rows')).toBeNull()
  })

  it('surfaces skipped-invalid and deduped counts only when nonzero', async () => {
    const user = userEvent.setup()
    mockUploadLecturerCsv.mockResolvedValue({
      created_lecturers: 1,
      created_units: 1,
      added_team_memberships: 1,
      skipped_invalid_rows: 2,
      deduped_rows: 3,
    })
    renderUpload()
    const dialog = await openUploadDialog(user)

    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(await within(dialog).findByText('Import complete')).toBeInTheDocument()
    expect(within(dialog).getByText('Skipped invalid rows')).toBeInTheDocument()
    expect(within(dialog).getByText('Deduped rows')).toBeInTheDocument()
  })

  it('surfaces a structured backend error clearly', async () => {
    const user = userEvent.setup()
    mockUploadLecturerCsv.mockRejectedValue(
      new Error(
        'CSV header must contain exactly these columns (case- and spacing-tolerant): title, last name, first name, availability, unit code, unit name.'
      )
    )
    renderUpload()
    const dialog = await openUploadDialog(user)

    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    expect(
      await within(dialog).findByText(/CSV header must contain exactly these columns/)
    ).toBeInTheDocument()
  })

  it('invalidates the lecturer and unit caches after a successful upload', async () => {
    const user = userEvent.setup()
    const { queryClient } = renderUpload()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const dialog = await openUploadDialog(user)
    await user.upload(within(dialog).getByLabelText('CSV or Excel file'), csvFile())
    await user.click(within(dialog).getByRole('button', { name: 'Upload' }))

    await waitFor(() => expect(mockUploadLecturerCsv).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lecturers'] })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['units'] })
  })
})
