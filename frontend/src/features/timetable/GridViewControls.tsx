import { Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DAYS, type Day } from './slots'

interface GridViewControlsProps {
  extended: boolean
  onToggleExtended: () => void
  visibleDays: Day[]
  onToggleDay: (day: Day) => void
  className?: string
}

// Unit 103: view-only toolbar shared by /timetable and /preferences. Choose
// which weekdays are shown and toggle the extended (wider, horizontally
// scrollable) grid layout. Filtering days is purely visual — it never changes
// saved assignments, blocks, or preferences.
export function GridViewControls({
  extended,
  onToggleExtended,
  visibleDays,
  onToggleDay,
  className,
}: GridViewControlsProps) {
  const visible = new Set(visibleDays)
  const onlyOneVisible = visibleDays.length <= 1

  return (
    <div
      className={['flex flex-wrap items-center gap-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Visible days"
      >
        {DAYS.map((day) => {
          const active = visible.has(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => onToggleDay(day)}
              aria-pressed={active}
              // Disable un-toggling the final visible day so the grid never
              // renders with zero day columns.
              disabled={active && onlyOneVisible}
              className="px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed"
              style={{
                borderColor: active
                  ? 'var(--accent-primary)'
                  : 'var(--border-default)',
                backgroundColor: active
                  ? 'var(--accent-primary-soft)'
                  : 'var(--bg-surface)',
                color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              {day.slice(0, 3)}
            </button>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggleExtended}
        aria-pressed={extended}
        className="flex items-center gap-1.5"
      >
        {extended ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
        {extended ? 'Collapse' : 'Extend'}
      </Button>
    </div>
  )
}
