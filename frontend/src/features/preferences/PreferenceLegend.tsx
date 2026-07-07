import { getPreferenceTokens } from './preferenceColors'

// Unit 103: legend for the preferences grid. Because preference cells no longer
// carry an in-cell text label, this legend is the visual key (green = Prefer,
// red = Avoid). It uses the dedicated preference tokens only.
export function PreferenceLegend() {
  const items = [getPreferenceTokens('preferred'), getPreferenceTokens('avoid')]

  return (
    <div
      className="flex flex-wrap items-center gap-4"
      aria-label="Preference legend"
    >
      {items.map((tokens) => (
        <div key={tokens.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 rounded-md border"
            style={{
              backgroundColor: tokens.background,
              borderColor: tokens.border,
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {tokens.label}
          </span>
        </div>
      ))}
    </div>
  )
}
