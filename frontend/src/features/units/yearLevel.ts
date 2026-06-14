/**
 * Frontend helper mirroring the backend unit-code → year-level parser
 * (`backend/services/year_level.py`, Unit 58).
 *
 * Product rule: find the first digit in the (whitespace-stripped) unit code.
 * That digit must be 1, 2, or 3 and becomes the unit's derived year level.
 * Codes without a valid first digit are rejected.
 *
 * This helper exists for UX only — the backend remains authoritative. It lets
 * the unit modal display the derived year and block create/save before a
 * doomed request is sent.
 */
import type { YearLevel } from '@/lib/api/students'

const VALID_YEAR_LEVELS: readonly YearLevel[] = [1, 2, 3]

export type YearParseResult =
  | { ok: true; year: YearLevel }
  | { ok: false; error: string }

export function parseUnitYearLevel(code: string): YearParseResult {
  const stripped = code.trim()
  for (const char of stripped) {
    if (char >= '0' && char <= '9') {
      const digit = Number(char)
      if ((VALID_YEAR_LEVELS as readonly number[]).includes(digit)) {
        return { ok: true, year: digit as YearLevel }
      }
      return {
        ok: false,
        error: `Unit code "${stripped}" starts with year digit ${digit}; the first digit must be 1, 2, or 3.`,
      }
    }
  }
  return {
    ok: false,
    error: stripped.length === 0
      ? 'Enter a unit code so the year level can be derived from its first digit (1, 2, or 3).'
      : `Unit code "${stripped}" has no digit; the year level must come from a first digit of 1, 2, or 3.`,
  }
}
