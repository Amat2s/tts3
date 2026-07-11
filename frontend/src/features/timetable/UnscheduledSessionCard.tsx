import { useDraggable } from '@dnd-kit/core'
import { Clock, User, Users } from 'lucide-react'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { UnitColorTokens } from './unitColors'

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  seminar: 'Seminar',
}

const CARD_CLASS_NAME =
  'flex w-full select-none flex-col gap-2 rounded-md border px-3 py-2.5'

interface UnscheduledSessionCardProps {
  session: SchedulableSession
  colorTokens: UnitColorTokens
  isSelected?: boolean
  editingDisabled?: boolean
  onClick?: () => void
}

export function UnscheduledSessionCard({
  session,
  colorTokens,
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
      className={CARD_CLASS_NAME}
      style={{
        backgroundColor: colorTokens.background,
        borderColor: colorTokens.border,
        borderLeftWidth: '3px',
        outline: isSelected ? `2px solid ${colorTokens.border}` : undefined,
        outlineOffset: isSelected ? '1px' : undefined,
        opacity: isDragging ? 0.3 : editingDisabled ? 0.6 : 1,
        cursor: editingDisabled ? 'default' : 'pointer',
      }}
      onClick={editingDisabled ? undefined : onClick}
    >
      <SessionCardContent session={session} colorTokens={colorTokens} />
    </div>
  )
}

interface UnscheduledSessionCardPreviewProps {
  session: SchedulableSession
  colorTokens: UnitColorTokens
}

export function UnscheduledSessionCardPreview({
  session,
  colorTokens,
}: UnscheduledSessionCardPreviewProps) {
  return (
    <div
      className={`${CARD_CLASS_NAME} shadow-md`}
      style={{
        width: '288px',
        backgroundColor: colorTokens.background,
        borderColor: colorTokens.border,
        borderLeftWidth: '3px',
      }}
    >
      <SessionCardContent session={session} colorTokens={colorTokens} />
    </div>
  )
}

function SessionCardContent({
  session,
  colorTokens,
}: {
  session: SchedulableSession
  colorTokens: UnitColorTokens
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: colorTokens.text }}
        >
          {SESSION_TYPE_LABEL[session.session_type] ?? session.session_type}
        </span>
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Clock className="h-3.5 w-3.5" />
          {session.duration} hour{session.duration !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span
          className="flex min-w-0 items-center gap-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{session.lecturer_display_name}</span>
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Users className="h-3.5 w-3.5" />
          {session.student_count} student
          {session.student_count !== 1 ? 's' : ''}
        </span>
      </div>
    </>
  )
}
