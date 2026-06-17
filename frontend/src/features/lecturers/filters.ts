import type { Lecturer } from '@/lib/api/lecturers'
import type { Unit } from '@/lib/api/units'
import { parseUnitCode } from '@/lib/unit-code-parser'

/** Client-side lecturer filter state. Frontend-only — never persisted (Unit 66). */
export interface LecturerFilters {
  /** Matched case-insensitively against title, first name, and last name. */
  search: string
  /** `'all'` or a taught unit id. */
  unitId: string
  /** `'all'` or a subject prefix (e.g. `'HIS'`). Matches any taught unit with that subject. */
  subject: string
  /** `'all'` or a parser-derived year level string (`'1'`/`'2'`/`'3'`). */
  year: string
}

export const EMPTY_LECTURER_FILTERS: LecturerFilters = {
  search: '',
  unitId: 'all',
  subject: 'all',
  year: 'all',
}

export function lecturerFiltersActive(f: LecturerFilters): boolean {
  return f.search.trim() !== '' || f.unitId !== 'all' || f.subject !== 'all' || f.year !== 'all'
}

/**
 * Pure filter over the loaded lecturer list. The taught-unit filter reads the
 * derived `taughtUnitsByLecturer` map the page builds from the units list (the
 * Units page owns the teaching relationship — there is no taught-unit field on
 * the lecturer response). Subject and year are derived from unit codes via the
 * frontend parser; units with invalid codes never match a subject or year filter.
 */
export function filterLecturers(
  lecturers: Lecturer[],
  f: LecturerFilters,
  taughtUnitsByLecturer: Map<string, Unit[]>
): Lecturer[] {
  const q = f.search.trim().toLowerCase()
  return lecturers.filter((l) => {
    const taught = taughtUnitsByLecturer.get(l.id) ?? []
    if (f.unitId !== 'all') {
      if (!taught.some((u) => u.id === f.unitId)) return false
    }
    if (f.subject !== 'all') {
      const hasSubject = taught.some((u) => {
        const r = parseUnitCode(u.code)
        return r.valid && r.prefix === f.subject
      })
      if (!hasSubject) return false
    }
    if (f.year !== 'all') {
      const hasYear = taught.some((u) => {
        const r = parseUnitCode(u.code)
        return r.valid && String(r.yearLevel) === f.year
      })
      if (!hasYear) return false
    }
    if (q !== '') {
      const hay = `${l.title} ${l.first_name} ${l.last_name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
