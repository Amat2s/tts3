import type { Student } from '@/lib/api/students'

// Unit 108: shared, view-only session search/filter matching for the timetable
// grid (dim non-matching cards) and the unscheduled pool (hide non-matching
// sessions). Matching is by unit/course code or name, lecturer name (session
// level, or the unit's teaching team when supplied), and any allocated student
// (name or student number) resolved through the hidden allocation ids. This is
// a visual focus aid only — it never mutates assignments, blocks, or the draft.

// The subset of fields both `SchedulableSession` and `TimetableAssignment`
// expose, so the same matcher works for the pool and the grid.
export interface SearchableSession {
  unit_code: string
  unit_name: string
  lecturer_display_name: string
  allocated_student_ids: string[]
}

// Maps a student id to a single lowercased haystack ("first last number") so a
// query can match either the student's name or their institutional number.
export type StudentSearchIndex = Map<string, string>

export function buildStudentSearchIndex(
  students: Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'>[]
): StudentSearchIndex {
  const index: StudentSearchIndex = new Map()
  for (const student of students) {
    index.set(
      student.id,
      `${student.first_name} ${student.last_name} ${student.student_number}`.toLocaleLowerCase()
    )
  }
  return index
}

// True when the (trimmed) query is empty or matches the session's unit, a
// lecturer name, or an allocated student. `teamNames`, when provided, replaces
// the session-level lecturer for the lecturer match (the pool matches whole
// teaching teams — Unit 76); otherwise the session-level lecturer is used.
export function sessionMatchesSearch(
  session: SearchableSession,
  query: string,
  studentIndex?: StudentSearchIndex,
  teamNames?: string[]
): boolean {
  const q = query.trim().toLocaleLowerCase()
  if (q.length === 0) return true

  const lecturerValues =
    teamNames && teamNames.length > 0
      ? teamNames
      : [session.lecturer_display_name]

  if (
    [session.unit_code, session.unit_name, ...lecturerValues].some((value) =>
      value.toLocaleLowerCase().includes(q)
    )
  ) {
    return true
  }

  if (studentIndex) {
    for (const studentId of session.allocated_student_ids) {
      const haystack = studentIndex.get(studentId)
      if (haystack && haystack.includes(q)) return true
    }
  }

  return false
}
