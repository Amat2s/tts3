import { describe, expect, it } from 'vitest'
import {
  EMPTY_LECTURER_FILTERS,
  filterLecturers,
  lecturerFiltersActive,
} from './filters'
import { makeLecturer, makeUnit } from '@/test/fixtures'
import type { Unit } from '@/lib/api/units'

const his = makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History' })
const phi = makeUnit({ id: 'u2', code: 'PHI202', name: 'Philosophy' })
// ENG is not a supported subject prefix — used to verify invalid codes are ignored.
const eng = makeUnit({ id: 'u3', code: 'ENG102', name: 'Literature' })

const ada = makeLecturer({ id: 'l1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' })
const grace = makeLecturer({ id: 'l2', title: 'Prof.', first_name: 'Grace', last_name: 'Hopper' })
const alan = makeLecturer({ id: 'l3', title: 'Mr', first_name: 'Alan', last_name: 'Turing' })

const lecturers = [ada, grace, alan]

// Ada teaches HIS101 (History, Year 1); Grace teaches PHI202 (Philosophy, Year 2)
// and ENG102 (invalid subject); Alan teaches nothing.
const taughtUnitsByLecturer = new Map<string, Unit[]>([
  ['l1', [his]],
  ['l2', [phi, eng]],
])

describe('filterLecturers', () => {
  it('returns all lecturers with empty filters', () => {
    expect(filterLecturers(lecturers, EMPTY_LECTURER_FILTERS, taughtUnitsByLecturer)).toHaveLength(3)
  })

  it('searches by title, first name, and last name', () => {
    expect(
      filterLecturers(lecturers, { ...EMPTY_LECTURER_FILTERS, search: 'hopper' }, taughtUnitsByLecturer).map((l) => l.id)
    ).toEqual(['l2'])
    expect(
      filterLecturers(lecturers, { ...EMPTY_LECTURER_FILTERS, search: 'prof.' }, taughtUnitsByLecturer).map((l) => l.id)
    ).toEqual(['l2'])
  })

  it('filters by taught unit using the derived map', () => {
    const result = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, unitId: 'u1' },
      taughtUnitsByLecturer
    )
    expect(result.map((l) => l.id)).toEqual(['l1'])
  })

  it('excludes lecturers who teach nothing when a taught-unit filter is set', () => {
    const result = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, unitId: 'u2' },
      taughtUnitsByLecturer
    )
    expect(result.map((l) => l.id)).toEqual(['l2'])
  })

  it('filters by subject derived from teaching-team unit codes', () => {
    // HIS: Ada teaches HIS101. Grace teaches PHI202+ENG102 — no HIS. Alan teaches nothing.
    const result = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, subject: 'HIS' },
      taughtUnitsByLecturer
    )
    expect(result.map((l) => l.id)).toEqual(['l1'])
  })

  it('matches a lecturer teaching a Philosophy unit when filtering by PHI', () => {
    const result = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, subject: 'PHI' },
      taughtUnitsByLecturer
    )
    expect(result.map((l) => l.id)).toEqual(['l2'])
  })

  it('ignores units with invalid subject prefixes — lecturer not matched via ENG code', () => {
    // Grace teaches ENG102 (ENG is not a supported prefix); ENG never appears as a
    // valid subject filter option so no filter value should match via that unit.
    // Filtering by LIT (Literature) returns nothing — ENG ≠ LIT.
    const result = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, subject: 'LIT' },
      taughtUnitsByLecturer
    )
    expect(result).toHaveLength(0)
  })

  it('filters by year derived from teaching-team unit codes', () => {
    // Ada teaches HIS101 (Year 1); Grace teaches PHI202 (Year 2) + ENG102 (invalid → no year).
    const year1 = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, year: '1' },
      taughtUnitsByLecturer
    )
    expect(year1.map((l) => l.id)).toEqual(['l1'])

    const year2 = filterLecturers(
      lecturers,
      { ...EMPTY_LECTURER_FILTERS, year: '2' },
      taughtUnitsByLecturer
    )
    expect(year2.map((l) => l.id)).toEqual(['l2'])
  })

  it('a lecturer teaching nothing does not match year or subject filters', () => {
    const year1 = filterLecturers(
      [alan],
      { ...EMPTY_LECTURER_FILTERS, year: '1' },
      taughtUnitsByLecturer
    )
    expect(year1).toHaveLength(0)

    const subj = filterLecturers(
      [alan],
      { ...EMPTY_LECTURER_FILTERS, subject: 'HIS' },
      taughtUnitsByLecturer
    )
    expect(subj).toHaveLength(0)
  })

  it('reports active state only when a filter is set', () => {
    expect(lecturerFiltersActive(EMPTY_LECTURER_FILTERS)).toBe(false)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, search: 'x' })).toBe(true)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, unitId: 'u1' })).toBe(true)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, subject: 'HIS' })).toBe(true)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, year: '1' })).toBe(true)
  })
})
