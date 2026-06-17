import { describe, expect, it } from 'vitest'
import {
  parseUnitCode,
  isValidUnitCode,
  subjectFilterOptions,
  yearLevelFilterOptions,
  SUBJECTS,
} from './unit-code-parser'

describe('parseUnitCode — valid cases', () => {
  it('parses a fully valid code into subject/year metadata', () => {
    const result = parseUnitCode('HIS101')
    expect(result).toEqual({
      valid: true,
      normalizedCode: 'HIS101',
      prefix: 'HIS',
      subjectName: 'History',
      colourName: 'Orange',
      yearLevel: 1,
      tokens: {
        background: 'var(--subject-history-bg)',
        border: 'var(--subject-history-border)',
        text: 'var(--subject-history-text)',
      },
    })
  })

  it('accepts each supported subject prefix at years 1–3', () => {
    for (const prefix of Object.keys(SUBJECTS)) {
      for (const year of [1, 2, 3] as const) {
        const result = parseUnitCode(`${prefix}${year}05`)
        expect(result.valid).toBe(true)
        if (result.valid) {
          expect(result.prefix).toBe(prefix)
          expect(result.yearLevel).toBe(year)
        }
      }
    }
  })
})

describe('parseUnitCode — normalization', () => {
  it('trims surrounding whitespace and uppercases the code', () => {
    const result = parseUnitCode('  his101  ')
    expect(result.valid).toBe(true)
    expect(result.normalizedCode).toBe('HIS101')
  })
})

describe('parseUnitCode — structural invalid cases', () => {
  it('reports empty + structure reasons for a blank code', () => {
    const result = parseUnitCode('   ')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reasons).toContain('empty')
      expect(result.reasons).toContain('structure')
    }
  })

  it('reports a structure reason for the wrong shape', () => {
    const result = parseUnitCode('HIS10')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reasons).toEqual(['structure'])
    }
  })

  it('rejects too many digits / letters in the wrong order', () => {
    expect(isValidUnitCode('1HIS01')).toBe(false)
    expect(isValidUnitCode('HISTORY')).toBe(false)
    expect(isValidUnitCode('HIS1010')).toBe(false)
  })
})

describe('parseUnitCode — unknown subject prefix', () => {
  it('flags a structurally valid but unknown subject', () => {
    const result = parseUnitCode('XYZ101')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reasons).toContain('unknown_subject')
      expect(result.reasons).not.toContain('invalid_year')
      expect(result.partial).toEqual({ prefix: 'XYZ', yearLevel: 1 })
    }
  })
})

describe('parseUnitCode — invalid year digit', () => {
  it('flags a known subject with an out-of-range year', () => {
    const result = parseUnitCode('HIS401')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reasons).toContain('invalid_year')
      expect(result.reasons).not.toContain('unknown_subject')
      expect(result.partial).toEqual({ prefix: 'HIS', yearLevel: 4 })
    }
  })

  it('rejects year 0', () => {
    expect(isValidUnitCode('SCI001')).toBe(false)
  })

  it('can report both unknown subject and invalid year', () => {
    const result = parseUnitCode('XYZ901')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reasons).toEqual(
        expect.arrayContaining(['unknown_subject', 'invalid_year'])
      )
    }
  })
})

describe('subject metadata / token mapping', () => {
  it('maps every supported prefix to CSS-token references', () => {
    const result = parseUnitCode('THE201')
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.subjectName).toBe('Theology')
      expect(result.tokens).toEqual({
        background: 'var(--subject-theology-bg)',
        border: 'var(--subject-theology-border)',
        text: 'var(--subject-theology-text)',
      })
    }
  })

  it('exposes subject and year filter options', () => {
    expect(subjectFilterOptions()).toEqual([
      { value: 'HIS', label: 'History' },
      { value: 'PHI', label: 'Philosophy' },
      { value: 'THE', label: 'Theology' },
      { value: 'LIT', label: 'Literature' },
      { value: 'LAN', label: 'Latin' },
      { value: 'GRE', label: 'Greek' },
      { value: 'SCI', label: 'Science' },
    ])
    expect(yearLevelFilterOptions()).toEqual([
      { value: 1, label: 'Year 1' },
      { value: 2, label: 'Year 2' },
      { value: 3, label: 'Year 3' },
    ])
  })
})
