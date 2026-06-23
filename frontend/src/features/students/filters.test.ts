import { describe, expect, it } from 'vitest'
import {
  EMPTY_STUDENT_FILTERS,
  filterStudents,
  studentFiltersActive,
} from './filters'
import { makeStudent } from '@/test/fixtures'

const his = { id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1 as const }
const phi = { id: 'u2', code: 'PHI202', name: 'Philosophy', year_level: 2 as const }
// ENG is not a supported subject prefix — used to verify invalid codes are ignored.
const eng = { id: 'u3', code: 'ENG102', name: 'Literature', year_level: 1 as const }

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
    units: [phi],
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
  makeStudent({
    id: 's4',
    first_name: 'Grace',
    last_name: 'Murray',
    year_level: 1,
    units: [eng],
    unit_count: 1,
  }),
]

describe('filterStudents', () => {
  it('returns all students with empty filters', () => {
    expect(filterStudents(students, EMPTY_STUDENT_FILTERS)).toHaveLength(4)
  })

  it('searches by first name and last name', () => {
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'lovelace' }).map((s) => s.id)
    ).toEqual(['s1'])
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'grace' }).map((s) => s.id)
    ).toEqual(['s2', 's4'])
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, search: 'turing' }).map((s) => s.id)
    ).toEqual(['s3'])
  })

  it('searches by student number (Unit 91)', () => {
    const list = [
      makeStudent({ id: 's1', student_number: '20250001' }),
      makeStudent({ id: 's2', student_number: '20250002' }),
    ]
    expect(
      filterStudents(list, { ...EMPTY_STUDENT_FILTERS, search: '0001' }).map((s) => s.id)
    ).toEqual(['s1'])
    expect(
      filterStudents(list, { ...EMPTY_STUDENT_FILTERS, search: '20250002' }).map((s) => s.id)
    ).toEqual(['s2'])
  })

  it('filters by year level', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, year: '1' })
    expect(result.map((s) => s.id)).toEqual(['s1', 's3', 's4'])
  })

  it('filters by enrolled unit', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, unitId: 'u1' })
    expect(result.map((s) => s.id)).toEqual(['s1'])
  })

  it('filters by subject derived from enrolled unit codes', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'HIS' })
    expect(result.map((s) => s.id)).toEqual(['s1'])
  })

  it('matches a student enrolled in a Philosophy unit when filtering by PHI', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'PHI' })
    expect(result.map((s) => s.id)).toEqual(['s2'])
  })

  it('ignores units with invalid subject prefixes — student not matched by any subject filter', () => {
    // ENG is not a supported subject; s4's only unit has an invalid prefix.
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'LIT' })
    expect(result).toHaveLength(0)
    // s4 also never matches any valid subject filter because ENG is unknown.
    const resultHis = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'HIS' })
    expect(resultHis.map((s) => s.id)).not.toContain('s4')
  })

  it('student with no enrolled units does not match any subject filter', () => {
    const result = filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'HIS' })
    expect(result.map((s) => s.id)).not.toContain('s3')
  })

  it('combines year and enrolled-unit filters', () => {
    // Year 1 + enrolled in PHI202 (only a Year 2 student) → no matches.
    expect(
      filterStudents(students, { search: '', year: '1', unitId: 'u2', subject: 'all' })
    ).toHaveLength(0)
  })

  it('combines subject and year filters', () => {
    // HIS subject + Year 2 → no match (Ada is Year 1).
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'HIS', year: '2' })
    ).toHaveLength(0)
    // HIS subject + Year 1 → Ada matches.
    expect(
      filterStudents(students, { ...EMPTY_STUDENT_FILTERS, subject: 'HIS', year: '1' }).map(
        (s) => s.id
      )
    ).toEqual(['s1'])
  })

  it('reports active state only when a filter is set', () => {
    expect(studentFiltersActive(EMPTY_STUDENT_FILTERS)).toBe(false)
    expect(studentFiltersActive({ ...EMPTY_STUDENT_FILTERS, year: '2' })).toBe(true)
    expect(studentFiltersActive({ ...EMPTY_STUDENT_FILTERS, unitId: 'u1' })).toBe(true)
    expect(studentFiltersActive({ ...EMPTY_STUDENT_FILTERS, subject: 'HIS' })).toBe(true)
  })
})
