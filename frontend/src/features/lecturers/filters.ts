import type { Lecturer } from '@/lib/api/lecturers'
import type { Unit } from '@/lib/api/units'

/** Client-side lecturer filter state. Frontend-only — never persisted (Unit 66). */
export interface LecturerFilters {
  /** Matched case-insensitively against title, first name, and last name. */
  search: string
  /** `'all'` or a taught unit id. */
  unitId: string
}

export const EMPTY_LECTURER_FILTERS: LecturerFilters = { search: '', unitId: 'all' }

export function lecturerFiltersActive(f: LecturerFilters): boolean {
  return f.search.trim() !== '' || f.unitId !== 'all'
}

/**
 * Pure filter over the loaded lecturer list. The taught-unit filter reads the
 * derived `taughtUnitsByLecturer` map the page builds from the units list (the
 * Units page owns the teaching relationship — there is no taught-unit field on
 * the lecturer response).
 */
export function filterLecturers(
  lecturers: Lecturer[],
  f: LecturerFilters,
  taughtUnitsByLecturer: Map<string, Unit[]>
): Lecturer[] {
  const q = f.search.trim().toLowerCase()
  return lecturers.filter((l) => {
    if (f.unitId !== 'all') {
      const taught = taughtUnitsByLecturer.get(l.id) ?? []
      if (!taught.some((u) => u.id === f.unitId)) return false
    }
    if (q !== '') {
      const hay = `${l.title} ${l.first_name} ${l.last_name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
