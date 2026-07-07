import type { LecturerPreferenceLevel } from '@/lib/api/lecturerPreferences'
import { getPreferenceTokens } from './preferenceColors'

interface PreferenceCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
  // Current level for this cell, or null for neutral (no preference).
  level?: LecturerPreferenceLevel | null
  // Fired on click/Enter/Space; the page cycles neutral -> preferred -> avoid.
  onClick?: () => void
  // Disabled until a lecturer is selected (nothing to key a preference to).
  disabled?: boolean
}

// Unit 99/100: a grid cell on the preferences page. Neutral by default; when a
// preference level is set it renders with the dedicated preference tokens and a
// short text label (never colour alone). Clicking cycles the level; each click
// is persisted immediately by the page (no dirty draft / explicit save).
export function PreferenceCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
  level = null,
  onClick,
  disabled = false,
}: PreferenceCellProps) {
  const tokens = level ? getPreferenceTokens(level) : null

  function handleClick() {
    if (disabled) return
    onClick?.()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  const ariaLabel = `${day} ${slotId} ${roomId}: ${
    level ? getPreferenceTokens(level).label : 'neutral'
  }`

  return (
    <div
      className="relative h-14 flex-1 border-r rounded-none"
      data-preference-cell="true"
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
      data-level={level ?? 'neutral'}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor: 'var(--bg-surface)',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {tokens && (
        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-none border px-1 text-xs font-medium select-none"
          data-preference-fill="true"
          style={{
            backgroundColor: tokens.background,
            borderColor: tokens.border,
            color: tokens.text,
          }}
        >
          <span className="truncate">{tokens.label}</span>
        </div>
      )}
    </div>
  )
}
