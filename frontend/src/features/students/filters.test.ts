import { describe, expect, it } from 'vitest'
import {
  EMPTY_STUDENT_FILTERS,
  filterStudents,
  studentFiltersActive,
} from './filters'
import { makeStudent } from '@/test/fixtures'

const his = { id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 as const }
const eng = { id: 'u2', code: 'ENG102', name: 'Literature', year_level: 1 as const }

const students = [
  makeStudent({
    id: 's1',
    first_name: 'Ada',
    last_name: 'Lovelace',
    year_level: 1,
    units: [his],
    unit_count: 1,
  }),
  makeStudent({
    id: 's2',
    first_name: 'Grace',
    last_name: 'Hopper',
    year_level: 2,
    units: [eng],
    unit_count: 1,
  }),
  makeStudent({
    id: 's3',
    first_name: 'Alan',
    last_name: 'Turing',
    year_level: 1,
    units: [],
    unit_count: 0,
  }),
]

describe('filterStudents', () => {
  it('returns all students with empty filters', () => {
    expect(filterStudents(students, EMPTY_STUDENT_FILTERS)).toHaveLength(3)
  })

  it('searches by first name and last name', () => {
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'lovelace' }).map((s) => s.id)
    ).toEqual(['s1'])
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'grace' }).map((s) => s.id)
    ).toEqual(['s2'])
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'turing' }).map((s) => s.id)
    ).toEqual(['s3'])
  })

  it('filters by year level', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, year: '1' })
    expect(result.map((s) => s.id)).toEqual(['s1', 's3'])
  })

  it('filters by enrolled unit', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, unitId: 'u1' })
    expect(result.map((s) => s.id)).toEqual(['s1'])
  })

  it('combines year and enrolled-unit filters', () => {
    // Year 1 + enrolled in ENG102 (only a Year 2 student) → no matches.
    expect(
      filterStudents(students, { search: '', year: '1', unitId: 'u2' })
    ).toHaveLength(0)
  })

  it('reports active state only when a filter is set', () => {
    expect(studentFiltersActive(EMPTY_STUDENT_FILTERS)).toBe(false)
    expect(studentFiltersActive({ ...EMPTY_STUDENT_FILTERS, year: '2' })).toBe(true)
    expect(studentFiltersActive({ ...EMPTY_STUDENT_FILTERS, unitId: 'u1' })).toBe(true)
  })
})
