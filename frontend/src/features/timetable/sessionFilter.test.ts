import { describe, expect, it } from 'vitest'
import {
  buildStudentSearchIndex,
  sessionMatchesSearch,
  type SearchableSession,
} from './sessionFilter'
import { makeStudent } from '@/test/fixtures'

const SESSION: SearchableSession = {
  unit_code: 'HIS101',
  unit_name: 'Ancient History',
  lecturer_display_name: 'Dr. Ada Lovelace',
  allocated_student_ids: ['student-1'],
}

const STUDENT_INDEX = buildStudentSearchIndex([
  makeStudent({
    id: 'student-1',
    first_name: 'Sam',
    last_name: 'Carter',
    student_number: '20259999',
  }),
])

describe('sessionMatchesSearch', () => {
  it('matches everything for an empty / whitespace query', () => {
    expect(sessionMatchesSearch(SESSION, '')).toBe(true)
    expect(sessionMatchesSearch(SESSION, '   ')).toBe(true)
  })

  it('matches by unit/course code and name (case-insensitive)', () => {
    expect(sessionMatchesSearch(SESSION, 'his101')).toBe(true)
    expect(sessionMatchesSearch(SESSION, 'ancient')).toBe(true)
  })

  it('matches by session-level lecturer name', () => {
    expect(sessionMatchesSearch(SESSION, 'lovelace')).toBe(true)
  })

  it('prefers teaching-team names over the session lecturer when supplied', () => {
    expect(
      sessionMatchesSearch(SESSION, 'grace hopper', undefined, [
        'Dr Ada Lovelace',
        'Prof Grace Hopper',
      ])
    ).toBe(true)
  })

  it('matches an allocated student by name and by number', () => {
    expect(sessionMatchesSearch(SESSION, 'carter', STUDENT_INDEX)).toBe(true)
    expect(sessionMatchesSearch(SESSION, '20259999', STUDENT_INDEX)).toBe(true)
  })

  it('does not match a student when no index is supplied', () => {
    expect(sessionMatchesSearch(SESSION, 'carter')).toBe(false)
  })

  it('returns false for a query that matches nothing', () => {
    expect(sessionMatchesSearch(SESSION, 'zzz', STUDENT_INDEX)).toBe(false)
  })

  it('does not match session-type text', () => {
    expect(sessionMatchesSearch(SESSION, 'lecture', STUDENT_INDEX)).toBe(false)
  })
})

describe('buildStudentSearchIndex', () => {
  it('indexes each student by lowercased name and number', () => {
    const index = buildStudentSearchIndex([
      makeStudent({
        id: 's-1',
        first_name: 'Grace',
        last_name: 'Hopper',
        student_number: '20250001',
      }),
    ])
    expect(index.get('s-1')).toBe('grace hopper 20250001')
  })
})
