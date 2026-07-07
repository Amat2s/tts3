import { afterEach, describe, expect, it, vi } from 'vitest'

// The API client reads the Supabase session for the auth header; stub it so the
// test never touches a real client/network.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  },
}))

import { ApiRequestError } from './client'
import {
  deleteLecturerPreference,
  listLecturerPreferences,
  upsertLecturerPreference,
  type LecturerPreference,
} from './lecturerPreferences'

const CELL: LecturerPreference = {
  id: 'pref-1',
  lecturer_id: 'lec-1',
  day: 'Monday',
  slot: 's1',
  room_id: 'room-1',
  level: 'preferred',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function mockFetch(response: {
  ok: boolean
  status: number
  body: unknown
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      text: async () =>
        response.body === undefined ? '' : JSON.stringify(response.body),
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('lecturerPreferences API client (Unit 100)', () => {
  it('listLecturerPreferences GETs the lecturer preferences path', async () => {
    mockFetch({ ok: true, status: 200, body: [CELL] })
    const result = await listLecturerPreferences('lec-1')

    const fetchMock = vi.mocked(fetch)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/lecturers/lec-1/preferences')
    expect(init?.method ?? 'GET').toBe('GET')
    expect(result).toEqual([CELL])
  })

  it('upsertLecturerPreference PUTs /lecturer-preferences with the cell + level', async () => {
    mockFetch({ ok: true, status: 200, body: CELL })
    await upsertLecturerPreference({
      lecturer_id: 'lec-1',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
      level: 'avoid',
    })

    const fetchMock = vi.mocked(fetch)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/lecturer-preferences')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({
      lecturer_id: 'lec-1',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
      level: 'avoid',
    })
  })

  it('deleteLecturerPreference DELETEs /lecturer-preferences with the cell key', async () => {
    mockFetch({ ok: true, status: 204, body: undefined })
    await deleteLecturerPreference({
      lecturer_id: 'lec-1',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
    })

    const fetchMock = vi.mocked(fetch)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/lecturer-preferences')
    expect(init?.method).toBe('DELETE')
    expect(JSON.parse(init?.body as string)).toEqual({
      lecturer_id: 'lec-1',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
    })
  })

  it('surfaces a structured backend error as a readable message', async () => {
    mockFetch({
      ok: false,
      status: 422,
      body: { error: { code: 'invalid_preference_level', message: 'Preference level must be one of: preferred, avoid.' } },
    })
    const promise = upsertLecturerPreference({
      lecturer_id: 'lec-1',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
      level: 'avoid',
    })
    await expect(promise).rejects.toBeInstanceOf(ApiRequestError)
    await expect(promise).rejects.toMatchObject({
      status: 422,
      message: 'Preference level must be one of: preferred, avoid.',
    })
  })
})
