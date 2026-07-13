/**
 * Derive lecturer initials from a display name for the Excel-export-style
 * session label ("HIS101 Lecture (SC)"). Mirrors the backend's
 * `lecturer_initials(first_name, last_name)` (services/timetable_excel_export.py),
 * but the frontend only has the combined `lecturer_display_name` ("Dr Ada
 * Lovelace") to work with, so it drops the leading title token and takes the
 * first letter of the next token plus the first letter of the last token.
 */
export function getLecturerInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  // Most titles ("Dr", "A/Prof.", "Prof.") are a single leading token, but
  // "Rev. Dr" is two tokens — drop both when we see it. Otherwise a name with
  // 3+ parts has a single title token to drop; a 2-part name has none.
  let rest = parts
  if (parts.length >= 4 && /^rev\.?$/i.test(parts[0]) && /^dr\.?$/i.test(parts[1])) {
    rest = parts.slice(2)
  } else if (parts.length >= 3) {
    rest = parts.slice(1)
  }
  const first = rest[0]
  const last = rest[rest.length - 1]
  return `${first[0]}${last[0]}`.toUpperCase()
}
