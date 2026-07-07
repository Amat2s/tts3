import type { LecturerPreferenceLevel } from '@/lib/api/lecturerPreferences'

export interface PreferenceTokens {
  background: string
  border: string
  text: string
  // Short, accessible label so the level never relies on colour alone.
  label: string
}

// Unit 100: map a preference level to its dedicated colour tokens. These are
// separate from the subject and block token sets and must not be reused for
// sessions or blocks.
export function getPreferenceTokens(
  level: LecturerPreferenceLevel
): PreferenceTokens {
  if (level === 'preferred') {
    return {
      background: 'var(--preference-preferred-bg)',
      border: 'var(--preference-preferred-border)',
      text: 'var(--preference-preferred-text)',
      label: 'Prefer',
    }
  }
  return {
    background: 'var(--preference-avoid-bg)',
    border: 'var(--preference-avoid-border)',
    text: 'var(--preference-avoid-text)',
    label: 'Avoid',
  }
}
