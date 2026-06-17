import { describe, expect, it } from 'vitest'
import { getSubjectTokens } from './unitColors'

describe('getSubjectTokens', () => {
  it('returns history tokens for HIS101', () => {
    const tokens = getSubjectTokens('HIS101')
    expect(tokens.background).toBe('var(--subject-history-bg)')
    expect(tokens.border).toBe('var(--subject-history-border)')
    expect(tokens.text).toBe('var(--subject-history-text)')
  })

  it('returns philosophy tokens for PHI201', () => {
    const tokens = getSubjectTokens('PHI201')
    expect(tokens.background).toBe('var(--subject-philosophy-bg)')
    expect(tokens.border).toBe('var(--subject-philosophy-border)')
    expect(tokens.text).toBe('var(--subject-philosophy-text)')
  })

  it('returns theology tokens for THE301', () => {
    const tokens = getSubjectTokens('THE301')
    expect(tokens.background).toBe('var(--subject-theology-bg)')
  })

  it('returns stone fallback for an unsupported subject prefix', () => {
    const tokens = getSubjectTokens('ABC101')
    expect(tokens.background).toBe('var(--unit-stone-bg)')
    expect(tokens.border).toBe('var(--unit-stone-border)')
  })

  it('returns stone fallback for a structurally invalid code without crashing', () => {
    expect(() => getSubjectTokens('INVALID')).not.toThrow()
    const tokens = getSubjectTokens('INVALID')
    expect(tokens.background).toBe('var(--unit-stone-bg)')
  })

  it('returns stone fallback for an empty string without crashing', () => {
    expect(() => getSubjectTokens('')).not.toThrow()
    const tokens = getSubjectTokens('')
    expect(tokens.background).toBe('var(--unit-stone-bg)')
  })

  it('returns stone fallback for a year-4 code (valid structure, invalid year)', () => {
    const tokens = getSubjectTokens('HIS401')
    expect(tokens.background).toBe('var(--unit-stone-bg)')
  })
})
