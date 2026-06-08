import { Fragment } from 'react'
import { DAYS, AM_SLOTS, PM_SLOTS } from '@/features/timetable/slots'
import type { AvailabilityEntry } from '@/lib/api/lecturers'

interface AvailabilityEditorProps {
  value: AvailabilityEntry[]
  onChange: (value: AvailabilityEntry[]) => void
}

export function AvailabilityEditor({ value, onChange }: AvailabilityEditorProps) {
  function isUnavail(day: string, slotId: string): boolean {
    return value.some(e => e.day === day && e.slot === slotId)
  }

  function toggle(day: string, slotId: string) {
    if (isUnavail(day, slotId)) {
      onChange(value.filter(e => !(e.day === day && e.slot === slotId)))
    } else {
      onChange([
        ...value,
        {
          day: day as AvailabilityEntry['day'],
          slot: slotId as AvailabilityEntry['slot'],
        },
      ])
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '4.5rem repeat(5, 1fr)',
          gap: 2,
        }}
      >
        {/* Header row */}
        <div />
        {DAYS.map(day => (
          <div
            key={day}
            className="py-1.5 text-center text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            {day.slice(0, 3)}
          </div>
        ))}

        {/* AM slots */}
        {AM_SLOTS.map(slot => (
          <Fragment key={slot.id}>
            <div
              className="flex items-center justify-end pr-2 text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
            >
              {slot.label}
            </div>
            {DAYS.map(day => (
              <button
                key={`${day}-${slot.id}`}
                type="button"
                className="h-9 rounded-sm border transition-colors"
                style={{
                  backgroundColor: isUnavail(day, slot.id)
                    ? 'var(--accent-primary-soft)'
                    : 'var(--bg-surface)',
                  borderColor: isUnavail(day, slot.id)
                    ? 'var(--accent-primary)'
                    : 'var(--border-default)',
                }}
                onClick={() => toggle(day, slot.id)}
                aria-pressed={isUnavail(day, slot.id)}
                aria-label={`${day} ${slot.label} — ${isUnavail(day, slot.id) ? 'unavailable' : 'available'}`}
              />
            ))}
          </Fragment>
        ))}

        {/* Lunch divider */}
        <div
          className="py-1 text-center text-xs"
          style={{
            gridColumn: '1 / -1',
            backgroundColor: 'var(--grid-lunch-bg)',
            color: 'var(--text-muted)',
          }}
        >
          Lunch
        </div>

        {/* PM slots */}
        {PM_SLOTS.map(slot => (
          <Fragment key={slot.id}>
            <div
              className="flex items-center justify-end pr-2 text-xs"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
            >
              {slot.label}
            </div>
            {DAYS.map(day => (
              <button
                key={`${day}-${slot.id}`}
                type="button"
                className="h-9 rounded-sm border transition-colors"
                style={{
                  backgroundColor: isUnavail(day, slot.id)
                    ? 'var(--accent-primary-soft)'
                    : 'var(--bg-surface)',
                  borderColor: isUnavail(day, slot.id)
                    ? 'var(--accent-primary)'
                    : 'var(--border-default)',
                }}
                onClick={() => toggle(day, slot.id)}
                aria-pressed={isUnavail(day, slot.id)}
                aria-label={`${day} ${slot.label} — ${isUnavail(day, slot.id) ? 'unavailable' : 'available'}`}
              />
            ))}
          </Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <div
            className="h-3.5 w-3.5 rounded-sm border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Available
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-3.5 w-3.5 rounded-sm border"
            style={{
              backgroundColor: 'var(--accent-primary-soft)',
              borderColor: 'var(--accent-primary)',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Unavailable
          </span>
        </div>
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
        Click a slot to toggle availability. Unavailable slots are treated as hard scheduling constraints.
      </p>
    </div>
  )
}
