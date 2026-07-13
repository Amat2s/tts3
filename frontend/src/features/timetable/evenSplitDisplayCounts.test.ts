import { describe, expect, it } from 'vitest'
import { makeSchedulableSession } from '@/test/fixtures'
import { withEvenSplitDisplayCounts } from './unscheduledPoolView'

function countsById(sessions: ReturnType<typeof makeSchedulableSession>[]) {
  return Object.fromEntries(
    sessions.map((s) => [s.session_id, s.student_count])
  )
}

describe('withEvenSplitDisplayCounts', () => {
  it('shows the whole cohort on lectures and an even split on tutorials', () => {
    const sessions = [
      makeSchedulableSession({
        session_id: 'lec',
        session_type: 'lecture',
        student_count: 31, // backend already correct here
      }),
      makeSchedulableSession({
        session_id: 'tut-a',
        session_type: 'tutorial',
        student_count: 31, // stale: shows the full cohort
      }),
      makeSchedulableSession({
        session_id: 'tut-b',
        session_type: 'tutorial',
        student_count: 31, // stale: shows the full cohort
      }),
    ]
    const result = withEvenSplitDisplayCounts(
      sessions,
      new Map([['unit-1', 31]])
    )
    // 31 over two tutorials -> 16 / 15; lecture stays at the full 31.
    expect(countsById(result)).toEqual({ lec: 31, 'tut-a': 16, 'tut-b': 15 })
  })

  it('shows the whole cohort on every seminar, like lectures', () => {
    const sessions = [
      makeSchedulableSession({ session_id: 't1', session_type: 'tutorial', student_count: 10 }),
      makeSchedulableSession({ session_id: 't2', session_type: 'tutorial', student_count: 10 }),
      makeSchedulableSession({ session_id: 's1', session_type: 'seminar', student_count: 10 }),
      makeSchedulableSession({ session_id: 's2', session_type: 'seminar', student_count: 10 }),
      makeSchedulableSession({ session_id: 's3', session_type: 'seminar', student_count: 10 }),
    ]
    const result = withEvenSplitDisplayCounts(
      sessions,
      new Map([['unit-1', 10]])
    )
    // Tutorials: 10 / 2 -> 5, 5. Seminars each hold the whole cohort of 10.
    expect(countsById(result)).toEqual({
      t1: 5,
      t2: 5,
      s1: 10,
      s2: 10,
      s3: 10,
    })
  })

  it('keeps raw counts when a unit has no enrolment info', () => {
    const sessions = [
      makeSchedulableSession({ session_id: 't1', session_type: 'tutorial', student_count: 31 }),
    ]
    const result = withEvenSplitDisplayCounts(sessions, new Map())
    expect(result).toBe(sessions) // untouched reference
    expect(result[0].student_count).toBe(31)
  })
})
