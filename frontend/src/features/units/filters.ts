import type { Unit } from '@/lib/api/units'
import { parseUnitCode } from '@/lib/unit-code-parser'

/** Client-side unit filter state. Frontend-only — never persisted (Unit 66). */
export interface UnitFilters {
  /** Matched case-insensitively against the unit code and name. */
  search: string
  /** `'all'` or a derived year level as a string (`'1'`/`'2'`/`'3'`). */
  year: string
  /** `'all'` or a teaching lecturer id (matched against `unit.lecturers`). */
  lecturerId: string
  /** `'all'` or a subject prefix (e.g. `'HIS'`). Units with invalid codes never match. */
  subject: string
}

export const EMPTY_UNIT_FILTERS: UnitFilters = {
  search: '',
  year: 'all',
  lecturerId: 'all',
  subject: 'all',
}

export function unitFiltersActive(f: UnitFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.year !== 'all' ||
    f.lecturerId !== 'all' ||
    f.subject !== 'all'
  )
}

/** Pure filter over the loaded unit list. Year uses the derived `year_level`. */
export function filterUnits(units: Unit[], f: UnitFilters): Unit[] {
  const q = f.search.trim().toLowerCase()
  return units.filter((u) => {
    if (f.year !== 'all' && String(u.year_level) !== f.year) return false
    if (f.lecturerId !== 'all' && !u.lecturers.some((l) => l.id === f.lecturerId)) return false
    if (f.subject !== 'all') {
      const r = parseUnitCode(u.code)
      if (!r.valid || r.prefix !== f.subject) return false
    }
    if (q !== '') {
      const hay = `${u.code} ${u.name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
