import { User, Users } from 'lucide-react'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { UnitColorVariant } from './unitColors'
import { UnscheduledSessionCard } from './UnscheduledSessionCard'

const BG_MAP: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-bg)',
  gold: 'var(--unit-gold-bg)',
  blue: 'var(--unit-blue-bg)',
  green: 'var(--unit-green-bg)',
  purple: 'var(--unit-purple-bg)',
  stone: 'var(--unit-stone-bg)',
}

const BORDER_MAP: Record<UnitColorVariant, string> = {
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
  sessions: SchedulableSession[]
  colorVariant: UnitColorVariant
  selectedSessionId?: string | null
  onSelectSession?: (session: SchedulableSession) => void
}

export function UnitGroup({
  unitCode,
  unitName,
  sessions,
  colorVariant,
  selectedSessionId,
  onSelectSession,
}: UnitGroupProps) {
  if (sessions.length === 0) return null

  const lecturerDisplayName = sessions[0]?.lecturer_display_name ?? ''
  const studentCount = sessions[0]?.student_count ?? 0
  const accent = BORDER_MAP[colorVariant]
  const bg = BG_MAP[colorVariant]

  return (
    <div
      className="flex flex-col shrink-0 rounded-lg border overflow-hidden"
      style={{
        width: '160px',
        backgroundColor: bg,
        borderColor: accent,
        borderLeftWidth: '4px',
      }}
    >
      {/* Unit header — highlighted at the top */}
      <div
        className="px-2.5 py-2 flex flex-col gap-0.5 border-b"
        style={{ borderBottomColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-bold shrink-0" style={{ color: accent }}>
            {unitCode}
          </span>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p
          className="text-xs font-medium leading-tight truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {unitName}
        </p>
        <div className="flex items-center gap-2 min-w-0 mt-0.5">
          <span
            className="flex items-center gap-0.5 text-xs min-w-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{lecturerDisplayName}</span>
          </span>
          <span
            className="flex items-center gap-0.5 text-xs shrink-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Users className="h-3 w-3" />
            {studentCount}
          </span>
        </div>
      </div>

      {/* Session cards inside the box */}
      <div className="p-1.5 flex flex-col gap-1">
        {sessions.map((session) => (
          <UnscheduledSessionCard
            key={session.session_id}
            session={session}
            colorVariant={colorVariant}
            isSelected={selectedSessionId === session.session_id}
            onClick={onSelectSession ? () => onSelectSession(session) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
