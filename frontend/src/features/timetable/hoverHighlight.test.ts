import { describe, expect, it } from 'vitest'
import {
  computeHoverHighlightKeys,
  computePreviewHeight,
  GRID_ROW_HEIGHT_PX,
} from './hoverHighlight'
import { makeAssignment, makeRoom, makeSchedulableSession } from '@/test/fixtures'

// ---------------------------------------------------------------------------
// computePreviewHeight
// ---------------------------------------------------------------------------
describe('computePreviewHeight', () => {
  it('returns rowHeight for a 1-slot session', () => {
    expect(computePreviewHeight(1, GRID_ROW_HEIGHT_PX)).toBe(GRID_ROW_HEIGHT_PX)
  })

  it('multiplies rowHeight by duration for multi-slot sessions', () => {
    expect(computePreviewHeight(2, 56)).toBe(112)
    expect(computePreviewHeight(3, 56)).toBe(168)
    expect(computePreviewHeight(4, 56)).toBe(224)
  })

  it('uses the supplied rowHeightPx, not the constant', () => {
    expect(computePreviewHeight(2, 40)).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// computeHoverHighlightKeys
// ---------------------------------------------------------------------------
const ROOM = makeRoom({ id: 'room-1', capacity: 30 })
const SESSION = makeSchedulableSession({
  session_id: 'sess-1',
  duration: 1,
  student_count: 10,
})
const SESSION_2H = makeSchedulableSession({
  session_id: 'sess-2h',
  duration: 2,
  student_count: 10,
})

describe('computeHoverHighlightKeys — returns empty for missing/invalid inputs', () => {
  it('returns empty when hoverKey is null', () => {
    expect(
      computeHoverHighlightKeys(null, 'sess-1', [SESSION], [], [ROOM])
    ).toEqual(new Set())
  })

  it('returns empty when draggingSessionId is null', () => {
    expect(
      computeHoverHighlightKeys('Monday:room-1:s1', null, [SESSION], [], [ROOM])
    ).toEqual(new Set())
  })

  it('returns empty when the session is not in schedulableSessions', () => {
    expect(
      computeHoverHighlightKeys('Monday:room-1:s1', 'sess-unknown', [SESSION], [], [ROOM])
    ).toEqual(new Set())
  })

  it('returns empty when the hoverKey cannot be parsed', () => {
    expect(
      computeHoverHighlightKeys('bad-key', 'sess-1', [SESSION], [], [ROOM])
    ).toEqual(new Set())
  })
})

describe('computeHoverHighlightKeys — valid hover highlights covered slots', () => {
  it('returns a single-element set for a 1-slot session', () => {
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s1',
      'sess-1',
      [SESSION],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set(['Monday:room-1:s1']))
  })

  it('returns all covered slots for a 2-slot session starting at s1', () => {
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s1',
      'sess-2h',
      [SESSION_2H],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set(['Monday:room-1:s1', 'Monday:room-1:s2']))
  })

  it('returns all covered slots for a 2-slot session starting at s2', () => {
    const result = computeHoverHighlightKeys(
      'Tuesday:room-1:s2',
      'sess-2h',
      [SESSION_2H],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set(['Tuesday:room-1:s2', 'Tuesday:room-1:s3']))
  })
})

describe('computeHoverHighlightKeys — invalid proposals return empty', () => {
  it('returns empty when proposed placement exceeds room capacity', () => {
    const bigSession = makeSchedulableSession({
      session_id: 'sess-big',
      duration: 1,
      student_count: 100, // exceeds ROOM capacity of 30
    })
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s1',
      'sess-big',
      [bigSession],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set())
  })

  it('returns empty when another session already occupies the slot (double-booking)', () => {
    const occupyingAssignment = makeAssignment({
      session_id: 'other-sess',
      day: 'Monday',
      start_slot: 's1',
      room_id: 'room-1',
      duration: 1,
    })
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s1',
      'sess-1',
      [SESSION],
      [occupyingAssignment],
      [ROOM]
    )
    expect(result).toEqual(new Set())
  })

  it('returns empty when placement would cross the lunch break (s3 + 2 slots)', () => {
    // s3 + 2-slot duration would span s3→s4 crossing lunch
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s3',
      'sess-2h',
      [SESSION_2H],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set())
  })

  it('returns empty when placement extends past the last timetable slot', () => {
    // s7 is the last slot; a 2-slot session at s7 would go off-timetable
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s7',
      'sess-2h',
      [SESSION_2H],
      [],
      [ROOM]
    )
    expect(result).toEqual(new Set())
  })
})

describe('computeHoverHighlightKeys — moving a scheduled session', () => {
  it('does not conflict with the session being moved at its current position', () => {
    // sess-1 is already placed at Monday:room-1:s1 in the draft.
    // Dragging it back over its own slot should be valid (it's excluded from the
    // double-booking check in checkProposedPlacement).
    const selfAssignment = makeAssignment({
      session_id: 'sess-1',
      day: 'Monday',
      start_slot: 's1',
      room_id: 'room-1',
      duration: 1,
    })
    const result = computeHoverHighlightKeys(
      'Monday:room-1:s1',
      'sess-1',
      [SESSION],
      [selfAssignment],
      [ROOM]
    )
    expect(result).toEqual(new Set(['Monday:room-1:s1']))
  })
})
