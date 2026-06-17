import { parseUnitCode } from '@/lib/unit-code-parser'
import type { SubjectTokens } from '@/lib/unit-code-parser'

export type UnitColorTokens = SubjectTokens

const FALLBACK_TOKENS: UnitColorTokens = {
  background: 'var(--unit-stone-bg)',
  border: 'var(--unit-stone-border)',
  text: 'var(--text-secondary)',
}

/** Returns subject-based colour tokens for a valid unit code, or stone fallback for invalid/legacy codes. */
export function getSubjectTokens(unitCode: string): UnitColorTokens {
  const result = parseUnitCode(unitCode)
  return result.valid ? result.tokens : FALLBACK_TOKENS
}
