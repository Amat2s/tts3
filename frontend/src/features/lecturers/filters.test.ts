import { describe, expect, it } from 'vitest'
import {
  EMPTY_LECTURER_FILTERS,
  filterLecturers,
  lecturerFiltersActive,
} from './filters'
import { makeLecturer, makeUnit } from '@/test/fixtures'
import type { Unit } from '@/lib/api/units'

const his = makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History' })
const eng = makeUnit({ id: 'u2', code: 'ENG102', name: 'Literature' })

const ada = makeLecturer({ id: 'l1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' })
const grace = makeLecturer({ id: 'l2', title: 'Prof.', first_name: 'Grace', last_name: 'Hopper' })
const alan = makeLecturer({ id: 'l3', title: 'Mr', first_name: 'Alan', last_name: 'Turing' })

const lecturers = [ada, grace, alan]

// Ada teaches HIS101; Grace teaches ENG102; Alan teaches nothing.
const taughtUnitsByLecturer = new Map<string, Unit[]>([
  ['l1', [his]],
  ['l2', [eng]],
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

  it('reports active state only when a filter is set', () => {
    expect(lecturerFiltersActive(EMPTY_LECTURER_FILTERS)).toBe(false)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, search: 'x' })).toBe(true)
    expect(lecturerFiltersActive({ ...EMPTY_LECTURER_FILTERS, unitId: 'u1' })).toBe(true)
  })
})
