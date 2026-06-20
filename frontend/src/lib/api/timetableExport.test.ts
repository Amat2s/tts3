import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The API client reads the Supabase session for the auth header; stub it so the
// test never touches a real client/network.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

import { ApiRequestError } from './client'
import {
  exportSavedTimetableExcel,
  fallbackExportFilename,
  triggerBlobDownload,
} from './timetableExport'

interface MockResponseInit {
  ok?: boolean
  status?: number
  blob?: Blob
  text?: string
  headers?: Record<string, string>
}

function makeResponse(init: MockResponseInit) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (name: string) => init.headers?.[name] ?? null },
    blob: async () => init.blob ?? new Blob(['xlsx']),
    text: async () => init.text ?? '',
  }
}

describe('exportSavedTimetableExcel (Unit 94)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('GETs the export endpoint with the title query param and returns the blob + filename', async () => {
    const blob = new Blob(['workbook'])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({
          blob,
          headers: {
            'Content-Disposition': 'attachment; filename="semester-2026.xlsx"',
          },
        })
      )
    )

    const result = await exportSavedTimetableExcel({ title: 'Semester 2026' })

    expect(result.blob).toBe(blob)
    expect(result.filename).toBe('semester-2026.xlsx')

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/timetable/export.xlsx?title=Semester+2026')
    expect(init?.method).toBe('GET')
  })

  it('returns a null filename when no Content-Disposition header is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ blob: new Blob(['x']), headers: {} }))
    )

    const result = await exportSavedTimetableExcel({ title: 'x' })
    expect(result.filename).toBeNull()
  })

  it('surfaces a readable message from a structured backend error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({
          ok: false,
          status: 422,
          text: JSON.stringify({
            error: {
              code: 'export_room_not_in_template',
              message: 'A scheduled room is not part of the export template.',
            },
          }),
        })
      )
    )

    await expect(exportSavedTimetableExcel({ title: 'x' })).rejects.toMatchObject({
      message: 'A scheduled room is not part of the export template.',
      status: 422,
    })
    await expect(exportSavedTimetableExcel({ title: 'x' })).rejects.toBeInstanceOf(
      ApiRequestError
    )
  })
})

describe('fallbackExportFilename (Unit 94)', () => {
  it('formats a zero-padded local date slug', () => {
    expect(fallbackExportFilename(new Date(2026, 5, 7))).toBe(
      'campion-timetable-2026-06-07.xlsx'
    )
  })
})

describe('triggerBlobDownload (Unit 94)', () => {
  const createObjectURL = vi.fn(() => 'blob:fake-url')
  const revokeObjectURL = vi.fn()
  let clickSpy: ReturnType<typeof vi.spyOn>
  let appendSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    })
    // Stub click so jsdom never attempts navigation; capture the anchor through
    // the appendChild spy rather than aliasing `this`.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    appendSpy = vi.spyOn(document.body, 'appendChild')
  })

  afterEach(() => {
    clickSpy.mockRestore()
    appendSpy.mockRestore()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
  })

  it('creates an object URL, clicks an anchor with the filename, then revokes the URL', () => {
    const blob = new Blob(['data'])
    triggerBlobDownload(blob, 'my-file.xlsx')

    expect(createObjectURL).toHaveBeenCalledWith(blob)

    const appendedNodes = appendSpy.mock.calls as unknown as Node[][]
    const anchor = appendedNodes
      .map((call) => call[0])
      .find(
        (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
      )
    expect(anchor).toBeDefined()
    expect(anchor?.download).toBe('my-file.xlsx')
    expect(anchor?.getAttribute('href')).toBe('blob:fake-url')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    // The synthetic anchor is removed from the document after the click.
    expect(anchor?.isConnected).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
  })
})
