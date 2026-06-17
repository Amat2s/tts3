import type { Student } from '@/lib/api/students'

/** Client-side student filter state. Frontend-only — never persisted (Unit 66). */
export interface StudentFilters {
  /** Matched case-insensitively against first name and last name. */
  search: string
  /** `'all'` or a year level as a string (`'1'`/`'2'`/`'3'`). */
  year: string
  /** `'all'` or an enrolled unit id (matched against `student.units`). */
  unitId: string
}

export const EMPTY_STUDENT_FILTERS: StudentFilters = {
  search: '',
  year: 'all',
  unitId: 'all',
}

export function studentFiltersActive(f: StudentFilters): boolean {
  return f.search.trim() !== '' || f.year !== 'all' || f.unitId !== 'all'
}

/** Pure filter over the loaded student list. */
export function filterStudents(students: Student[], f: StudentFilters): Student[] {
  const q = f.search.trim().toLowerCase()
  return students.filter((s) => {
    if (f.year !== 'all' && String(s.year_level) !== f.year) return false
    if (f.unitId !== 'all' && !s.units.some((u) => u.id === f.unitId)) return false
    if (q !== '') {
      const hay = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
