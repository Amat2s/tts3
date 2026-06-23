import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The API client reads the Supabase session for the auth header; stub it so the
// test never touches a real client/network.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

import { uploadStudentCsv } from './students'

const IMPORT_RESULT = {
  created_students: 0,
  updated_students: 0,
  added_enrolments: 0,
  skipped_unknown_unit_rows: 0,
  skipped_invalid_rows: 0,
  skipped_past_census_rows: 0,
  deduped_rows: 0,
}

describe('uploadStudentCsv (Unit 91)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(IMPORT_RESULT),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('posts multipart FormData and never forces a JSON content type', async () => {
    const file = new File(['Student number'], 'students.csv', { type: 'text/csv' })
    await uploadStudentCsv(file)

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/students/import-csv')
    expect(init?.method).toBe('POST')

    // The body must be the multipart form carrying the file.
    expect(init?.body).toBeInstanceOf(FormData)
    const body = init?.body as FormData
    expect((body.get('file') as File).name).toBe('students.csv')

    // The browser must set the multipart Content-Type (with boundary) itself, so
    // the client must NOT inject application/json for FormData uploads.
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('returns the parsed aggregate import result', async () => {
    const result = await uploadStudentCsv(
      new File(['x'], 'students.csv', { type: 'text/csv' })
    )
    expect(result).toEqual(IMPORT_RESULT)
  })
})
