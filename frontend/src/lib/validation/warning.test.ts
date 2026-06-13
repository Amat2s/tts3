import { describe, expect, it } from 'vitest'
import { checkDraftForWarnings, getWarningSessionIds } from './warning'
import { makeAssignment, makeLecturer } from '@/test/fixtures'

// Warning rules (code-standards): lecturer overlap, student overlap, unit/session
// overlap where applicable, lecturer availability conflict. Warning placements are
// allowed to remain in the draft but must surface feedback and block the solver.
// Student conflict is represented through unit/session overlap (shared enrolment).

describe('checkDraftForWarnings — warning rules allow placement but flag it', () => {
  it('returns no warnings for a clean, non-overlapping draft', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', start_slot: 's2', day: 'Monday', lecturer_display_name: 'Prof. Grace Hopper' }),
    ]
    expect(checkDraftForWarnings(draft, [])).toEqual([])
  })

  it('flags a lecturer conflict (same lecturer, overlapping time, same day)', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-2', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    const issues = checkDraftForWarnings(draft, [])
    const lecturerIssue = issues.find((i) => i.type === 'lecturer_overlap')
    expect(lecturerIssue).toBeDefined()
    expect(lecturerIssue!.severity).toBe('warning')
    expect(lecturerIssue!.affected_session_ids).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('flags a student/unit-session conflict (same unit overlapping)', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', unit_code: 'HIS101', start_slot: 's1', day: 'Monday' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', unit_code: 'HIS101', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Prof. Grace Hopper' }),
    ]
    const issues = checkDraftForWarnings(draft, [])
    const unitIssue = issues.find((i) => i.type === 'unit_session_overlap')
    expect(unitIssue).toBeDefined()
    expect(unitIssue!.severity).toBe('warning')
    expect(unitIssue!.affected_session_ids).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('does not flag overlap on different days', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', start_slot: 's1', day: 'Tuesday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    expect(checkDraftForWarnings(draft, [])).toEqual([])
  })

  it('flags a lecturer availability conflict (placed on an unavailable slot)', () => {
    const lecturer = makeLecturer({
      title: 'Dr.',
      first_name: 'Ada',
      last_name: 'Lovelace',
      unavailable_slots: [{ day: 'Monday', slot: 's1' }],
    })
    const draft = [
      makeAssignment({ session_id: 'a', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    const issues = checkDraftForWarnings(draft, [lecturer])
    const availIssue = issues.find((i) => i.type === 'lecturer_unavailable')
    expect(availIssue).toBeDefined()
    expect(availIssue!.affected_slot).toBe('s1')
    expect(availIssue!.affected_day).toBe('Monday')
  })

  it('does not flag availability when the lecturer is free at that slot', () => {
    const lecturer = makeLecturer({
      unavailable_slots: [{ day: 'Tuesday', slot: 's4' }],
    })
    const draft = [
      makeAssignment({ session_id: 'a', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    expect(
      checkDraftForWarnings(draft, [lecturer]).some((i) => i.type === 'lecturer_unavailable')
    ).toBe(false)
  })

  it('getWarningSessionIds collects every flagged session id', () => {
    const draft = [
      makeAssignment({ session_id: 'a', unit_id: 'unit-1', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
      makeAssignment({ session_id: 'b', unit_id: 'unit-1', start_slot: 's1', day: 'Monday', lecturer_display_name: 'Dr. Ada Lovelace' }),
    ]
    const ids = getWarningSessionIds(draft, [])
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
  })
})
