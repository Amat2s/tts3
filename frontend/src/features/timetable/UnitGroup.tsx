import type { SchedulableSession } from '@/lib/api/sessions'
import type { UnitColorVariant } from './unitColors'
import { UnscheduledSessionCard } from './UnscheduledSessionCard'

interface UnitGroupProps {
  unitId: string
  unitCode: string
  unitName: string
  sessions: SchedulableSession[]
  colorVariant: UnitColorVariant
  pendingSessionId?: string | null
  editingDisabled?: boolean
  onSelectSession?: (sessionId: string) => void
}

export function UnitGroup({
  unitCode,
  unitName,
  sessions,
  colorVariant,
  pendingSessionId,
  editingDisabled = false,
  onSelectSession,
}: UnitGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {unitCode}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {unitName}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
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
    </div>
  )
}
