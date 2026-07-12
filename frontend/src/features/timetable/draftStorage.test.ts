import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredDraft,
  computeSavedAssignmentFingerprint,
  loadStoredDraft,
  saveStoredDraft,
  type StoredTimetableDraft,
} from './draftStorage'
import { computeSavedBlockFingerprint, type DraftBlock } from './draftBlocks'
import type { TimetableAssignment } from './assignment'

const STORAGE_KEY = 'tts3.timetable.draft.v2'
const LEGACY_STORAGE_KEY = 'tts3.timetable.draft.v1'

// Empty saved-block fingerprint, used by the assignment-focused cases.
const EMPTY_BLOCK_FP = computeSavedBlockFingerprint([])

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

function makeDraftBlock(overrides: Partial<DraftBlock> = {}): DraftBlock {
  return {
    id: 'new:abc',
    isNew: true,
    name: 'Chapel',
    colour: 'gold',
    cells: [{ day: 'Monday', slot: 's1', room_id: 'room-1' }],
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
  it('writes a dirty draft to storage with the current schema version and both layers', () => {
    const draft = [makeAssignment()]
    const blocks = [makeDraftBlock()]
    const fingerprint = computeSavedAssignmentFingerprint([])
    saveStoredDraft(draft, blocks, fingerprint, EMPTY_BLOCK_FP)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as StoredTimetableDraft
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.savedAssignmentFingerprint).toBe(fingerprint)
    expect(parsed.savedBlockFingerprint).toBe(EMPTY_BLOCK_FP)
    expect(parsed.assignments).toHaveLength(1)
    expect(parsed.blocks).toHaveLength(1)
    expect(typeof parsed.updatedAt).toBe('string')
  })

  it('round-trips pending block changes across a reload', () => {
    const blocks = [
      makeDraftBlock({ id: 'new:1', name: 'Chapel', colour: 'gold' }),
      makeDraftBlock({
        id: 'saved-1',
        isNew: false,
        name: null,
        colour: null,
        cells: [{ day: 'Tuesday', slot: 's4', room_id: 'room-2' }],
      }),
    ]
    saveStoredDraft([], blocks, '', EMPTY_BLOCK_FP)

    const result = loadStoredDraft('', EMPTY_BLOCK_FP)
    expect(result.status).toBe('restored')
    if (result.status === 'restored') {
      expect(result.draft.blocks).toEqual(blocks)
    }
  })

  it('persists an empty dirty draft (Clear All before save)', () => {
    const fingerprint = computeSavedAssignmentFingerprint([makeAssignment()])
    saveStoredDraft([], [], fingerprint, EMPTY_BLOCK_FP)

    const result = loadStoredDraft(fingerprint, EMPTY_BLOCK_FP)
    expect(result.status).toBe('restored')
    if (result.status === 'restored') {
      expect(result.draft.assignments).toEqual([])
      expect(result.draft.blocks).toEqual([])
    }
  })

  it('restores a draft when both fingerprints match', () => {
    const draft = [makeAssignment()]
    saveStoredDraft(draft, [], 'fp-match', 'block-fp')

    const result = loadStoredDraft('fp-match', 'block-fp')
    expect(result.status).toBe('restored')
    if (result.status === 'restored') {
      expect(result.draft.assignments[0].session_id).toBe('sess-1')
    }
  })

  it('returns none when no draft is stored', () => {
    expect(loadStoredDraft('anything', 'anything')).toEqual({ status: 'none' })
  })
})

describe('loadStoredDraft — safe discard behavior', () => {
  it('discards and clears invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    const result = loadStoredDraft('fp', EMPTY_BLOCK_FP)
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a structurally valid object missing required assignment fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        savedAssignmentFingerprint: 'fp',
        savedBlockFingerprint: EMPTY_BLOCK_FP,
        updatedAt: 'now',
        assignments: [{ session_id: 'sess-1' }],
        blocks: [],
      })
    )
    const result = loadStoredDraft('fp', EMPTY_BLOCK_FP)
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft with malformed block entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        savedAssignmentFingerprint: 'fp',
        savedBlockFingerprint: EMPTY_BLOCK_FP,
        updatedAt: 'now',
        assignments: [],
        blocks: [{ id: 'x', isNew: 'nope' }],
      })
    )
    const result = loadStoredDraft('fp', EMPTY_BLOCK_FP)
    expect(result).toEqual({ status: 'discarded', reason: 'invalid' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft with a mismatched (old v1) schema version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAssignmentFingerprint: 'fp',
        updatedAt: 'now',
        assignments: [],
      })
    )
    const result = loadStoredDraft('fp', EMPTY_BLOCK_FP)
    expect(result).toEqual({ status: 'discarded', reason: 'schema-mismatch' })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft whose assignment fingerprint no longer matches saved state', () => {
    saveStoredDraft([makeAssignment()], [], 'old-fingerprint', EMPTY_BLOCK_FP)
    const result = loadStoredDraft('new-fingerprint', EMPTY_BLOCK_FP)
    expect(result).toEqual({
      status: 'discarded',
      reason: 'fingerprint-mismatch',
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a draft whose block fingerprint no longer matches saved blocks', () => {
    saveStoredDraft([], [makeDraftBlock()], 'fp', 'old-block-fp')
    const result = loadStoredDraft('fp', 'new-block-fp')
    expect(result).toEqual({
      status: 'discarded',
      reason: 'fingerprint-mismatch',
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('legacy stored drafts', () => {
  it('sweeps away an old v1 draft key on load and never restores it', () => {
    localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        savedAssignmentFingerprint: '',
        updatedAt: 'now',
        assignments: [makeAssignment()],
      })
    )
    const result = loadStoredDraft('', EMPTY_BLOCK_FP)
    expect(result).toEqual({ status: 'none' })
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })
})

describe('clearStoredDraft', () => {
  it('removes a stored draft and any legacy key', () => {
    saveStoredDraft([makeAssignment()], [], 'fp', EMPTY_BLOCK_FP)
    localStorage.setItem(LEGACY_STORAGE_KEY, 'stale')
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    clearStoredDraft()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })
})
