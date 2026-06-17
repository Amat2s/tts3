import { describe, expect, it } from 'vitest'
import { checkDraftForWarnings, getWarningSessionIds } from './warning'
import { makeAssignment, makeLecturer } from '@/test/fixtures'

// Warning rules (Unit 67): lecturer overlap (same session-level lecturer id),
// student overlap (intersecting allocated-student sets), and lecturer
// availability conflict. The independent unit/session overlap warning was
// removed — shared allocated students now determine session overlap. Warning
// placements are allowed to remain in the draft but must surface feedback and
// block the solver.

describe('checkDraftForWarnings — warning rules allow placement but flag it', () => {
  it('returns no warnings for a clean, non-overlapping draft', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', lecturer_id: 'lec-2', start_slot: 's2', day: 'Monday' }),
    ]
    expect(checkDraftForWarnings(draft, [])).toEqual([])
  })

  it('flags a lecturer conflict (same lecturer id, overlapping time, same day)', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
    ]
    const issues = checkDraftForWarnings(draft, [])
    const lecturerIssue = issues.find((i) => i.type === 'lecturer_overlap')
    expect(lecturerIssue).toBeDefined()
    expect(lecturerIssue!.severity).toBe('warning')
    expect(lecturerIssue!.affected_session_ids).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('does not flag a lecturer conflict for sessions taught by different lecturers (same team)', () => {
    // Two sessions whose units share a teaching team but whose session-level
    // lecturers differ must NOT raise a lecturer overlap.
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', lecturer_id: 'lec-2', start_slot: 's1', day: 'Monday' }),
    ]
    expect(
      checkDraftForWarnings(draft, []).some((i) => i.type === 'lecturer_overlap')
    ).toBe(false)
  })

  it('flags a student conflict when allocated-student sets intersect (lecture + tutorial of the same unit)', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', unit_code: 'HIS101', session_type: 'lecture', allocated_student_ids: ['s1', 's2', 's3'], start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', unit_code: 'HIS101', session_type: 'tutorial', lecturer_id: 'lec-2', allocated_student_ids: ['s2'], start_slot: 's1', day: 'Monday' }),
    ]
    const issues = checkDraftForWarnings(draft, [])
    const studentIssue = issues.find((i) => i.type === 'student_overlap')
    expect(studentIssue).toBeDefined()
    expect(studentIssue!.severity).toBe('warning')
    expect(studentIssue!.affected_session_ids).toEqual(expect.arrayContaining(['a', 'b']))
    expect(studentIssue!.affected_student_ids).toEqual(['s2'])
    // The message must not reveal hidden tutorial allocation groups.
    expect(studentIssue!.message).not.toMatch(/tutorial group/i)
  })

  it('does not flag a student conflict for two tutorials of the same unit with disjoint allocation sets', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', unit_code: 'HIS101', session_type: 'tutorial', lecturer_id: 'lec-1', allocated_student_ids: ['s1', 's2'], start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', unit_code: 'HIS101', session_type: 'tutorial', lecturer_id: 'lec-2', allocated_student_ids: ['s3', 's4'], start_slot: 's1', day: 'Monday' }),
    ]
    expect(
      checkDraftForWarnings(draft, []).some((i) => i.type === 'student_overlap')
    ).toBe(false)
  })

  it('no longer produces an independent unit/session overlap warning', () => {
    // Same unit, overlapping time, but no shared allocated students → clean.
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', unit_code: 'HIS101', lecturer_id: 'lec-1', allocated_student_ids: ['s1'], start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', unit_code: 'HIS101', lecturer_id: 'lec-2', allocated_student_ids: ['s2'], start_slot: 's1', day: 'Monday' }),
    ]
    expect(checkDraftForWarnings(draft, [])).toEqual([])
  })

  it('does not flag overlap on different days', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', lecturer_id: 'lec-1', allocated_student_ids: ['s1'], start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', lecturer_id: 'lec-1', allocated_student_ids: ['s1'], start_slot: 's1', day: 'Tuesday' }),
    ]
    expect(checkDraftForWarnings(draft, [])).toEqual([])
  })

  it('flags a lecturer availability conflict using the session-level lecturer id', () => {
    const lecturer = makeLecturer({
      id: 'lec-1',
      title: 'Dr',
      first_name: 'Ada',
      last_name: 'Lovelace',
      unavailable_slots: [{ day: 'Monday', slot: 's1' }],
    })
    const draft = [
      makeAssignment({ session_id: 'a', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    const issues = checkDraftForWarnings(draft, [lecturer])
    const availIssue = issues.find((i) => i.type === 'lecturer_unavailable')
    expect(availIssue).toBeDefined()
    expect(availIssue!.affected_slot).toBe('s1')
    expect(availIssue!.affected_day).toBe('Monday')
    expect(availIssue!.affected_lecturer_id).toBe('lec-1')
  })

  it('does not flag availability when the lecturer is free at that slot', () => {
    const lecturer = makeLecturer({
      id: 'lec-1',
      unavailable_slots: [{ day: 'Tuesday', slot: 's4' }],
    })
    const draft = [
      makeAssignment({ session_id: 'a', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
    ]
    expect(
      checkDraftForWarnings(draft, [lecturer]).some((i) => i.type === 'lecturer_unavailable')
    ).toBe(false)
  })

  it('does not flag availability for assignments without a session-level lecturer id', () => {
    const lecturer = makeLecturer({
      id: 'lec-1',
      unavailable_slots: [{ day: 'Monday', slot: 's1' }],
    })
    const draft = [
      makeAssignment({ session_id: 'a', lecturer_id: undefined, start_slot: 's1', day: 'Monday' }),
    ]
    expect(
      checkDraftForWarnings(draft, [lecturer]).some((i) => i.type === 'lecturer_unavailable')
    ).toBe(false)
  })

  it('getWarningSessionIds collects every flagged session id', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', lecturer_id: 'lec-1', start_slot: 's1', day: 'Monday' }),
    ]
    const ids = getWarningSessionIds(draft, [])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
  })
})
