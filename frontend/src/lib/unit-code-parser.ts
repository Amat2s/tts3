/**
 * Frontend-only unit-code parser (Unit 73).
 *
 * Pure and deterministic. The backend only guarantees the structural contract
 * (`^[A-Z]{3}\d{3}$`) and the derived year level; the richer subject metadata,
 * subject colours, and human labels all live here so they can power:
 *   - unit-code field feedback;
 *   - subject colour selection;
 *   - subject filters;
 *   - year filters derived from unit codes.
 *
 * Subject colours are referenced as CSS-token `var(--subject-*)` strings, never
 * inline hex values — the tokens are declared once in `index.css` / `ui-context.md`.
 */

export const SUBJECT_PREFIXES = [
  'HIS',
  'PHI',
  'THE',
  'LIT',
  'LAN',
  'GRE',
  'SCI',
] as const

export type SubjectPrefix = (typeof SUBJECT_PREFIXES)[number]

export type YearLevel = 1 | 2 | 3

export interface SubjectTokens {
  background: string
  border: string
  text: string
}

export interface SubjectMeta {
  prefix: SubjectPrefix
  subjectName: string
  /** Human colour description (e.g. "Orange", "Dark Blue"). */
  colourName: string
  tokens: SubjectTokens
}

function tokens(slug: string): SubjectTokens {
  return {
    background: `var(--subject-${slug}-bg)`,
    border: `var(--subject-${slug}-border)`,
    text: `var(--subject-${slug}-text)`,
  }
}

/** Supported subject metadata, keyed by code prefix. */
export const SUBJECTS: Record<SubjectPrefix, SubjectMeta> = {
  HIS: { prefix: 'HIS', subjectName: 'History', colourName: 'Orange', tokens: tokens('history') },
  PHI: { prefix: 'PHI', subjectName: 'Philosophy', colourName: 'Blue', tokens: tokens('philosophy') },
  THE: { prefix: 'THE', subjectName: 'Theology', colourName: 'Pink', tokens: tokens('theology') },
  LIT: { prefix: 'LIT', subjectName: 'Literature', colourName: 'Dark Green', tokens: tokens('literature') },
  LAN: { prefix: 'LAN', subjectName: 'Latin', colourName: 'Light Orange', tokens: tokens('latin') },
  GRE: { prefix: 'GRE', subjectName: 'Greek', colourName: 'Light Green', tokens: tokens('greek') },
  SCI: { prefix: 'SCI', subjectName: 'Science', colourName: 'Dark Blue', tokens: tokens('science') },
}

export type UnitCodeInvalidReason =
  | 'empty'
  | 'structure'
  | 'unknown_subject'
  | 'invalid_year'

export type UnitCodeParseResult =
  | {
      valid: true
      normalizedCode: string
      prefix: SubjectPrefix
      subjectName: string
      colourName: string
      yearLevel: YearLevel
      tokens: SubjectTokens
    }
  | {
      valid: false
      normalizedCode: string
      reasons: UnitCodeInvalidReason[]
      partial?: {
        prefix?: string
        yearLevel?: number
      }
    }

const STRUCTURE_PATTERN = /^[A-Z]{3}\d{3}$/

function isSubjectPrefix(value: string): value is SubjectPrefix {
  return (SUBJECT_PREFIXES as readonly string[]).includes(value)
}

function isValidYear(value: number): value is YearLevel {
  return value === 1 || value === 2 || value === 3
}

/**
 * Parse a unit code into structured subject/year metadata. Trims and uppercases
 * the input first. A fully valid code requires structural validity, a known
 * subject prefix, and a year level of 1, 2, or 3. Invalid codes return the set
 * of structured reasons plus any best-effort partial information.
 */
export function parseUnitCode(code: string): UnitCodeParseResult {
  const normalizedCode = code.trim().toUpperCase()

  const reasons: UnitCodeInvalidReason[] = []
  if (normalizedCode === '') reasons.push('empty')

  const structurallyValid = STRUCTURE_PATTERN.test(normalizedCode)
  if (!structurallyValid) reasons.push('structure')

  // Subject prefix is the first three characters; year is the first digit.
  const prefix = normalizedCode.slice(0, 3)
  const firstDigit = normalizedCode.match(/\d/)
  const yearNumber = firstDigit ? Number(firstDigit[0]) : undefined

  if (structurallyValid) {
    const knownSubject = isSubjectPrefix(prefix)
    if (!knownSubject) reasons.push('unknown_subject')
    if (yearNumber === undefined || !isValidYear(yearNumber)) reasons.push('invalid_year')

    if (knownSubject && yearNumber !== undefined && isValidYear(yearNumber)) {
      const subject = SUBJECTS[prefix]
      return {
        valid: true,
        normalizedCode,
        prefix,
        subjectName: subject.subjectName,
        colourName: subject.colourName,
        yearLevel: yearNumber,
        tokens: subject.tokens,
      }
    }
  }

  const partialPrefix = /^[A-Z]{3}/.test(normalizedCode) ? prefix : undefined
  return {
    valid: false,
    normalizedCode,
    reasons,
    partial:
      partialPrefix !== undefined || yearNumber !== undefined
        ? { prefix: partialPrefix, yearLevel: yearNumber }
        : undefined,
  }
}

/** Convenience boolean wrapper over {@link parseUnitCode}. */
export function isValidUnitCode(code: string): boolean {
  return parseUnitCode(code).valid
}

/** Subject filter options derived from the supported subject metadata. */
export function subjectFilterOptions(): { value: SubjectPrefix; label: string }[] {
  return SUBJECT_PREFIXES.map((prefix) => ({
    value: prefix,
    label: SUBJECTS[prefix].subjectName,
  }))
}

/** Year filter options for codes whose year is derived from the unit code. */
export function yearLevelFilterOptions(): { value: YearLevel; label: string }[] {
  return [1, 2, 3].map((y) => ({ value: y as YearLevel, label: `Year ${y}` }))
}
