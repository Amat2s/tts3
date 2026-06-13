import { describe, expect, it } from 'vitest'
import {
  checkProposedPlacement,
  checkDraftForBlockingViolations,
  getBlockingViolatorIds,
} from './blocking'
import { makeAssignment, makeRoom } from '@/test/fixtures'

// Blocking rules (code-standards): room double-booking, room capacity too small,
// session crossing lunch, session running off the timetable. These placements
// must be rejected before entering the draft.

const rooms = [makeRoom({ id: 'room-1', capacity: 30 })]

describe('checkProposedPlacement — blocking rules reject impossible placements', () => {
  it('accepts a valid placement (no issues)', () => {
    const proposed = makeAssignment({ start_slot: 's1', duration: 1, student_count: 10 })
    expect(checkProposedPlacement(proposed, [], rooms)).toEqual([])
  })

  it('rejects room double-booking', () => {
    const existing = makeAssignment({
      session_id: 'sess-existing',
      start_slot: 's1',
      duration: 1,
      room_id: 'room-1',
      day: 'Monday',
    })
    const proposed = makeAssignment({
      session_id: 'sess-new',
      start_slot: 's1',
      duration: 1,
      room_id: 'room-1',
      day: 'Monday',
    })
    const issues = checkProposedPlacement(proposed, [existing], rooms)
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('room_double_booking')
    expect(issues[0].severity).toBe('blocking')
    expect(issues[0].affected_session_ids).toContain('sess-new')
    expect(issues[0].affected_session_ids).toContain('sess-existing')
  })

  it('detects double-booking across multi-slot overlap (not just same start slot)', () => {
    const existing = makeAssignment({
      session_id: 'sess-existing',
      start_slot: 's1',
      duration: 2, // occupies s1, s2
      room_id: 'room-1',
    })
    const proposed = makeAssignment({
      session_id: 'sess-new',
      start_slot: 's2', // overlaps existing's second slot
      duration: 1,
      room_id: 'room-1',
    })
    const issues = checkProposedPlacement(proposed, [existing], rooms)
    expect(issues.map((i) => i.type)).toContain('room_double_booking')
  })

  it('does not flag double-booking in a different room', () => {
    const existing = makeAssignment({
      session_id: 'sess-existing',
      start_slot: 's1',
      duration: 1,
      room_id: 'room-1',
    })
    const proposed = makeAssignment({
      session_id: 'sess-new',
      start_slot: 's1',
      duration: 1,
      room_id: 'room-2',
    })
    const twoRooms = [makeRoom({ id: 'room-1' }), makeRoom({ id: 'room-2' })]
    expect(checkProposedPlacement(proposed, [existing], twoRooms)).toEqual([])
  })

  it('rejects room too small (student count exceeds capacity)', () => {
    const proposed = makeAssignment({ student_count: 40, room_id: 'room-1' })
    const issues = checkProposedPlacement(proposed, [], rooms)
    expect(issues).toHaveLength(1)
    expect(issues[0].type).toBe('room_capacity_too_small')
    expect(issues[0].affected_room_id).toBe('room-1')
  })

  it('rejects a session crossing the lunch break', () => {
    // s3 (last AM) + duration 2 → spans into s4 (first PM)
    const proposed = makeAssignment({ start_slot: 's3', duration: 2 })
    const issues = checkProposedPlacement(proposed, [], rooms)
    expect(issues.map((i) => i.type)).toContain('session_crossing_lunch')
  })

  it('rejects a session running off the timetable', () => {
    // s7 (index 6) + duration 2 → past the 7-slot grid
    const proposed = makeAssignment({ start_slot: 's7', duration: 2 })
    const issues = checkProposedPlacement(proposed, [], rooms)
    expect(issues.map((i) => i.type)).toContain('session_off_timetable')
  })

  it('allows a move onto the session\'s own current position (excludes self)', () => {
    const current = makeAssignment({ session_id: 'sess-1', start_slot: 's1', duration: 1 })
    const proposed = makeAssignment({ session_id: 'sess-1', start_slot: 's1', duration: 1 })
    // Moving sess-1 to the same cell should not double-book against itself.
    expect(checkProposedPlacement(proposed, [current], rooms)).toEqual([])
  })
})

describe('checkDraftForBlockingViolations / getBlockingViolatorIds — automatic unscheduling source', () => {
  it('returns no violators for a clean draft', () => {
    const draft = [makeAssignment({ session_id: 'sess-1', start_slot: 's1', student_count: 10 })]
    expect(checkDraftForBlockingViolations(draft, rooms)).toEqual([])
    expect(getBlockingViolatorIds(draft, rooms).size).toBe(0)
  })

  it('flags a draft assignment that now exceeds room capacity (data change)', () => {
    // Simulates a session whose student count grew beyond the room capacity.
    const draft = [makeAssignment({ session_id: 'sess-1', student_count: 50, room_id: 'room-1' })]
    const violators = getBlockingViolatorIds(draft, rooms)
    expect(violators.has('sess-1')).toBe(true)
  })

  it('flags both sessions involved in a room double-booking', () => {
    const draft = [
      makeAssignment({ session_id: 'sess-1', start_slot: 's1', duration: 1, room_id: 'room-1' }),
      makeAssignment({ session_id: 'sess-2', start_slot: 's1', duration: 1, room_id: 'room-1' }),
    ]
    const violators = getBlockingViolatorIds(draft, rooms)
    expect(violators.has('sess-1')).toBe(true)
    expect(violators.has('sess-2')).toBe(true)
  })
})
