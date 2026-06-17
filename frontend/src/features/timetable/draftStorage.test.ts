import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredDraft,
  computeSavedAssignmentFingerprint,
  loadStoredDraft,
  saveStoredDraft,
  type StoredTimetableDraft,
} from './draftStorage'
import type { TimetableAssignment } from './assignment'

const STORAGE_KEY = 'tts3.timetable.draft.v1'

function makeAssignment(
  overrides: Partial<TimetableAssignment> = {}
): TimetableAssignment {
  return {
    session_id: 'sess-1',
    unit_id: 'unit-1',
    unit_code: 'HIS101',
    unit_name: 'Ancient History',
    session_type: 'lecture',
    duration: 1,
    lecturer_display_name: 'Dr. Ada Lovelace',
    lecturer_id: 'lec-1',
    student_count: 10,
    allocated_student_ids: [],
    day: 'Monday',
    start_slot: 's1',
    room_id: 'room-1',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('computeSavedAssignmentFingerprint', () => {
  it('is order-independent for equivalent saved sets', () => {
    const a = makeAssignment({ session_id: 'sess-1' })
    const b = makeAssignment({ session_id: 'sess-2', start_slot: 's2' })
    expect(computeSavedAssignmentFingerprint([a, b])).toBe(
      computeSavedAssignmentFingerprint([b, a])
    )
  })

  it('changes when a placement changes', () => {
    const base = makeAssignment()
    const moved = makeAssignment({ start_slot: 's3' })
    expect(computeSavedAssignmentFingerprint([base])).not.toBe(
      computeSavedAssignmentFingerprint([moved])
    )
  })

  it('produces a stable empty fingerprint for an empty saved set', () => {
    expect(computeSavedAssignmentFingerprint([])).toBe('')
  })
})

describe('saveStoredDraft / loadStoredDraft', () => {
  it('writes a dirty draft to storage with the current schema version', () => {
    const draft = [makeAssignment()]
    const fingerprint = computeSavedAssignmentFingerprint([])
    saveStoredDraft(draft, fingerprint)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as StoredTimetableDraft
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.savedAssignmentFingerprint).toBe(fingerprint)
    expect(parsed.assignments).toHaveLength(1)
    expect(typeof parsed.updatedAt).toBe('string')
  })

  it('persists an empty dirty draft (Clear All before save)', () => {
    const fingerprint = computeSavedAssignmentFingerprint([makeAssignment()])
    saveStoredDraft([], fingerprint)

    const result = loadStoredDraft(fingerprint)
    expect(result.status).toBe('restored')
    if (result.status === 'restored') {
      expect(result.draft.assignments).toEqual([])
    }
  })

  it('restores a draft when the fingerprint matches', () => {
    const draft = [makeAssignment()]
    const fingerprint = 'fp-match'
    saveStoredDraft(draft, fingerprint)

    const result = loadStoredDraft(fingerprint)
    expect(result.status).toBe('restored')
    if (result.status === 'restored') {
      expect(result.draft.assignments[0].session_id).toBe('sess-1')
    }
  })

  it('returns none when no draft is stored', () => {
    expect(loadStoredDraft('anything')).toEqual({ status: 'none' })
  })
})

describe('loadStoredDraft — safe discard behavior', () => {
  it('discards and clears invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    const result = loadStoredDraft('fp')
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a structurally valid object missing required assignment fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAssignmentFingerprint: 'fp',
        updatedAt: 'now',
        assignments: [{ session_id: 'sess-1' }],
      })
    )
    const result = loadStoredDraft('fp')
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft with a mismatched schema version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        savedAssignmentFingerprint: 'fp',
        updatedAt: 'now',
        assignments: [],
      })
    )
    const result = loadStoredDraft('fp')
    expect(result).toEqual({ status: 'discarded', reason: 'schema-mismatch' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft whose fingerprint no longer matches saved state', () => {
    saveStoredDraft([makeAssignment()], 'old-fingerprint')
    const result = loadStoredDraft('new-fingerprint')
    expect(result).toEqual({
      status: 'discarded',
      reason: 'fingerprint-mismatch',
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('clearStoredDraft', () => {
  it('removes a stored draft', () => {
    saveStoredDraft([makeAssignment()], 'fp')
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    clearStoredDraft()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
