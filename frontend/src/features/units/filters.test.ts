import { describe, expect, it } from 'vitest'
import {
  EMPTY_UNIT_FILTERS,
  filterUnits,
  unitFiltersActive,
} from './filters'
import { makeUnit } from '@/test/fixtures'
import type { LecturerSummary } from '@/lib/api/units'

const ada: LecturerSummary = { id: 'l1', title: 'Dr', first_name: 'Ada', last_name: 'Lovelace' }
const grace: LecturerSummary = { id: 'l2', title: 'Prof.', first_name: 'Grace', last_name: 'Hopper' }

// ENG is not a supported subject prefix — used to verify invalid codes are ignored.
const units = [
  makeUnit({ id: 'u1', code: 'HIS101', name: 'Ancient History', year_level: 1, lecturers: [ada] }),
  makeUnit({ id: 'u2', code: 'ENG202', name: 'Modern Literature', year_level: 2, lecturers: [grace] }),
  makeUnit({ id: 'u3', code: 'HIS301', name: 'World History', year_level: 3, lecturers: [ada, grace] }),
]

describe('filterUnits', () => {
  it('returns all units with empty filters', () => {
    expect(filterUnits(units, EMPTY_UNIT_FILTERS)).toHaveLength(3)
  })

  it('searches by code and by name', () => {
    expect(
      filterUnits(units, { ...EMPTY_UNIT_FILTERS, search: 'his' }).map((u) => u.id)
    ).toEqual(['u1', 'u3'])
    expect(
      filterUnits(units, { ...EMPTY_UNIT_FILTERS, search: 'literature' }).map((u) => u.id)
    ).toEqual(['u2'])
  })

  it('filters by derived year level', () => {
    expect(
      filterUnits(units, { ...EMPTY_UNIT_FILTERS, year: '3' }).map((u) => u.id)
    ).toEqual(['u3'])
  })

  it('filters by teaching lecturer', () => {
    const result = filterUnits(units, { ...EMPTY_UNIT_FILTERS, lecturerId: 'l1' })
    expect(result.map((u) => u.id)).toEqual(['u1', 'u3'])
  })

  it('filters by subject derived from unit code', () => {
    // HIS101 and HIS301 → History; ENG202 has an invalid prefix.
    const result = filterUnits(units, { ...EMPTY_UNIT_FILTERS, subject: 'HIS' })
    expect(result.map((u) => u.id)).toEqual(['u1', 'u3'])
  })

  it('units with unrecognised subject prefixes never match a subject filter', () => {
    // ENG is not in the supported subject list — ENG202 should not match any subject filter.
    // Filtering by LIT returns nothing because HIS≠LIT and ENG is invalid.
    const lit = filterUnits(units, { ...EMPTY_UNIT_FILTERS, subject: 'LIT' })
    expect(lit).toHaveLength(0)

    // HIS filter returns only HIS units, not ENG202.
    const his = filterUnits(units, { ...EMPTY_UNIT_FILTERS, subject: 'HIS' })
    expect(his.map((u) => u.id)).not.toContain('u2')
  })

  it('combines search, year, and lecturer filters', () => {
    const result = filterUnits(units, { search: 'his', year: '3', lecturerId: 'l2', subject: 'all' })
    expect(result.map((u) => u.id)).toEqual(['u3'])
  })

  it('combines subject and year filters', () => {
    // HIS + Year 1 → only HIS101.
    const result = filterUnits(units, { ...EMPTY_UNIT_FILTERS, subject: 'HIS', year: '1' })
    expect(result.map((u) => u.id)).toEqual(['u1'])
  })

  it('reports active state only when a filter is set', () => {
    expect(unitFiltersActive(EMPTY_UNIT_FILTERS)).toBe(false)
    expect(unitFiltersActive({ ...EMPTY_UNIT_FILTERS, year: '1' })).toBe(true)
    expect(unitFiltersActive({ ...EMPTY_UNIT_FILTERS, lecturerId: 'l1' })).toBe(true)
    expect(unitFiltersActive({ ...EMPTY_UNIT_FILTERS, subject: 'HIS' })).toBe(true)
  })
})
