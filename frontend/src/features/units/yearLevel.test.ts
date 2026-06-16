import { describe, expect, it } from 'vitest'
import { parseUnitYearLevel } from './yearLevel'

describe('parseUnitYearLevel', () => {
  it('derives the year from the first digit for valid codes', () => {
    expect(parseUnitYearLevel('HIS101')).toEqual({ ok: true, year: 1 })
    expect(parseUnitYearLevel('MAT204')).toEqual({ ok: true, year: 2 })
    expect(parseUnitYearLevel('PHL301')).toEqual({ ok: true, year: 3 })
  })

  it('uses the first digit even when later digits differ', () => {
    expect(parseUnitYearLevel('BIO250')).toEqual({ ok: true, year: 2 })
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parseUnitYearLevel('  CHM110  ')).toEqual({ ok: true, year: 1 })
  })

  it('rejects a first digit outside 1..3', () => {
    const result = parseUnitYearLevel('ENG404')
    expect(result.ok).toBe(false)
  })

  it('rejects codes with no digit', () => {
    const result = parseUnitYearLevel('SEMINAR')
    expect(result.ok).toBe(false)
  })

  it('rejects an empty code', () => {
    const result = parseUnitYearLevel('   ')
    expect(result.ok).toBe(false)
  })
})
