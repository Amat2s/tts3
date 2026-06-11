import { Clock, Users } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { UnitColorVariant } from './unitColors'

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
  onClick?: () => void
}

export function UnscheduledSessionCard({
  session,
  colorVariant,
  isSelected = false,
  onClick,
}: UnscheduledSessionCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${session.session_id}`,
    data: { type: 'unscheduled', session },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="rounded-md border px-2 py-1.5 flex flex-col gap-0.5 select-none w-full"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: isSelected ? 'var(--accent-primary)' : BORDER_MAP[colorVariant],
        borderLeftWidth: '4px',
        cursor: isDragging ? 'grabbing' : 'grab',
        outline: isSelected ? '2px solid var(--accent-primary)' : 'none',
        outlineOffset: '1px',
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      onClick={onClick}
    >
      <span
        className="text-xs font-medium"
        style={{ color: BORDER_MAP[colorVariant] }}
      >
        {SESSION_TYPE_LABEL[session.session_type] ?? session.session_type}
      </span>
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-0.5 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Clock className="h-3 w-3" />
          {session.duration} slot{session.duration !== 1 ? 's' : ''}
        </span>
        <span
          className="flex items-center gap-0.5 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Users className="h-3 w-3" />
          {session.student_count}
        </span>
      </div>
    </div>
  )
}
