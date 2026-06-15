import type { SchedulableSession } from '@/lib/api/sessions'
import type { YearLevel } from '@/lib/api/students'
import type { UnitColorVariant } from './unitColors'
import { UnscheduledSessionCard } from './UnscheduledSessionCard'

const ACCENT_MAP: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-border)',
  gold: 'var(--unit-gold-border)',
  blue: 'var(--unit-blue-border)',
  green: 'var(--unit-green-border)',
  purple: 'var(--unit-purple-border)',
  stone: 'var(--unit-stone-border)',
}

interface UnitGroupProps {
  unitId: string
  unitCode: string
  unitName: string
  unitYearLevel?: YearLevel
  sessions: SchedulableSession[]
  colorVariant: UnitColorVariant
  pendingSessionId?: string | null
  editingDisabled?: boolean
  onSelectSession?: (sessionId: string) => void
}

export function UnitGroup({
  unitId,
  unitCode,
  unitName,
  unitYearLevel,
  sessions,
  colorVariant,
  pendingSessionId,
  editingDisabled = false,
  onSelectSession,
}: UnitGroupProps) {
  const accent = ACCENT_MAP[colorVariant]

  return (
    <section
      className="flex min-w-0 basis-72 grow flex-col overflow-hidden rounded-lg border shadow-sm sm:max-w-sm"
      style={{
        borderColor: 'var(--border-default)',
        borderTopColor: accent,
        borderTopWidth: '3px',
        backgroundColor: 'var(--bg-elevated)',
      }}
      aria-labelledby={`unit-group-${unitId}`}
    >
      <div
        className="flex items-start justify-between gap-3 border-b px-3 py-3"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-warm)',
        }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id={`unit-group-${unitId}`}
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {unitCode}
            </h3>
            {unitYearLevel !== undefined && (
              <span
                className="rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{
                  borderColor: accent,
                  color: accent,
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                Year {unitYearLevel}
              </span>
            )}
          </div>
          <p
            className="mt-0.5 text-sm leading-snug"
            style={{ color: 'var(--text-secondary)' }}
          >
            {unitName}
          </p>
        </div>
        <span
          className="shrink-0 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {sessions.length} remaining
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {sessions.map((session) => (
          <UnscheduledSessionCard
            key={session.session_id}
            session={session}
            colorVariant={colorVariant}
            isSelected={pendingSessionId === session.session_id}
            editingDisabled={editingDisabled}
            onClick={() => onSelectSession?.(session.session_id)}
          />
        ))}
      </div>
    </section>
  )
}
