import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, X } from 'lucide-react'
import type { TimetableAssignment } from './assignment'
import type { UnitColorTokens } from './unitColors'

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lec',
  tutorial: 'Tut',
}

// CELL_HEIGHT must match the h-14 (3.5rem) used in GridCell.
// A card spanning N slots uses calc(N * 3.5rem) so it visually covers N rows.
const CELL_HEIGHT_REM = 3.5

interface ScheduledSessionCardProps {
  assignment: TimetableAssignment
  colorTokens: UnitColorTokens
  isPending?: boolean
  hasWarning?: boolean
  editingDisabled?: boolean
  onUnschedule?: () => void
  onMoveSelect?: () => void
}

export function ScheduledSessionCard({
  assignment,
  colorTokens,
  isPending = false,
  hasWarning = false,
  editingDisabled = false,
  onUnschedule,
  onMoveSelect,
}: ScheduledSessionCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.session_id,
    data: { sessionId: assignment.session_id },
    disabled: editingDisabled,
  })

  function handleUnschedule(e: React.MouseEvent) {
    e.stopPropagation()
    onUnschedule?.()
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute inset-x-0 top-0 rounded-md border overflow-hidden z-10 px-1.5 py-1 flex flex-col gap-0.5 select-none"
      style={{
        height: `calc(${assignment.duration} * ${CELL_HEIGHT_REM}rem)`,
        backgroundColor: colorTokens.background,
        borderColor: hasWarning ? 'var(--state-warning)' : colorTokens.border,
        borderLeftWidth: '4px',
        outline: isPending ? `2px solid ${colorTokens.border}` : undefined,
        outlineOffset: isPending ? '1px' : undefined,
        opacity: isPending ? 0.8 : isDragging ? 0.3 : 1,
        cursor: editingDisabled ? 'default' : 'pointer',
      }}
      onClick={editingDisabled ? undefined : onMoveSelect}
    >
      <div className="flex items-start justify-between gap-0.5 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
          <span
            className="text-xs font-semibold shrink-0"
            style={{ color: colorTokens.text }}
          >
            {assignment.unit_code}
          </span>
          <span
            className="text-xs shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {SESSION_TYPE_LABEL[assignment.session_type] ?? assignment.session_type}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {hasWarning && (
            <AlertTriangle
              className="h-3 w-3"
              style={{ color: 'var(--state-warning)' }}
              aria-label="Scheduling warning"
            />
          )}
          {!editingDisabled && (
            <button
              className="flex items-center justify-center h-4 w-4 rounded-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleUnschedule}
              title="Unschedule"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <span
        className="text-xs truncate"
        style={{ color: 'var(--text-secondary)' }}
      >
        {assignment.lecturer_display_name}
      </span>
      {assignment.duration > 1 && (
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {assignment.student_count} student{assignment.student_count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
