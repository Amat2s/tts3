import type { SchedulableSession } from '@/lib/api/sessions'
import type { YearLevel } from '@/lib/api/students'
import type { UnitColorTokens } from './unitColors'
import { UnscheduledSessionCard } from './UnscheduledSessionCard'

interface UnitGroupProps {
  unitId: string
  unitCode: string
  unitName: string
  unitYearLevel?: YearLevel
  sessions: SchedulableSession[]
  colorTokens: UnitColorTokens
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
  colorTokens,
  pendingSessionId,
  editingDisabled = false,
  onSelectSession,
}: UnitGroupProps) {
  return (
    <section
      className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm"
      style={{
        borderColor: 'var(--border-default)',
        borderTopColor: colorTokens.border,
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
                  borderColor: colorTokens.border,
                  color: colorTokens.text,
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
            colorTokens={colorTokens}
            isSelected={pendingSessionId === session.session_id}
            editingDisabled={editingDisabled}
            onClick={() => onSelectSession?.(session.session_id)}
          />
        ))}
      </div>
    </section>
  )
}
