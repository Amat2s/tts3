import { useDraggable } from '@dnd-kit/core'
import { Clock, User, Users } from 'lucide-react'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { UnitColorVariant } from './unitColors'

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

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  lab: 'Lab',
  workshop: 'Workshop',
}

interface UnscheduledSessionCardProps {
  session: SchedulableSession
  colorVariant: UnitColorVariant
  isSelected?: boolean
  editingDisabled?: boolean
  onClick?: () => void
}

export function UnscheduledSessionCard({
  session,
  colorVariant,
  isSelected = false,
  editingDisabled = false,
  onClick,
}: UnscheduledSessionCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: session.session_id,
    data: { sessionId: session.session_id },
    disabled: editingDisabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="rounded-md border px-3 py-2 flex flex-col gap-1 select-none"
      style={{
        backgroundColor: BG_MAP[colorVariant],
        borderColor: BORDER_MAP[colorVariant],
        borderLeftWidth: '3px',
        minWidth: '180px',
        maxWidth: '240px',
        outline: isSelected ? `2px solid ${BORDER_MAP[colorVariant]}` : undefined,
        outlineOffset: isSelected ? '1px' : undefined,
        opacity: isDragging ? 0.3 : editingDisabled ? 0.6 : 1,
        cursor: editingDisabled ? 'default' : 'pointer',
      }}
      onClick={editingDisabled ? undefined : onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-xs font-semibold"
          style={{ color: BORDER_MAP[colorVariant] }}
        >
          {session.unit_code}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {SESSION_TYPE_LABEL[session.session_type] ?? session.session_type}
        </span>
      </div>
      <p
        className="text-sm font-medium leading-tight truncate"
        style={{ color: 'var(--text-primary)' }}
      >
        {session.unit_name}
      </p>
      <div className="flex items-center gap-3 mt-0.5">
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Clock className="h-3.5 w-3.5" />
          {session.duration} slot{session.duration !== 1 ? 's' : ''}
        </span>
        <span
          className="flex items-center gap-1 text-xs truncate"
          style={{ color: 'var(--text-secondary)' }}
        >
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{session.lecturer_display_name}</span>
        </span>
        <span
          className="flex items-center gap-1 text-xs shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Users className="h-3.5 w-3.5" />
          {session.student_count}
        </span>
      </div>
    </div>
  )
}
