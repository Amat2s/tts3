import { memo, useState } from 'react'
import { GripHorizontal, Loader2, TriangleAlert, X } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import type { TimetableAssignment } from './assignment'
import type { UnitColorVariant } from './unitColors'

const BG_MAP: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-bg)',
  gold: 'var(--unit-gold-bg)',
  blue: 'var(--unit-blue-bg)',
  green: 'var(--unit-green-bg)',
  purple: 'var(--unit-purple-bg)',
  stone: 'var(--unit-stone-bg)',
}

const ACCENT_MAP: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-border)',
  gold: 'var(--unit-gold-border)',
  blue: 'var(--unit-blue-border)',
  green: 'var(--unit-green-border)',
  purple: 'var(--unit-purple-border)',
  stone: 'var(--unit-stone-border)',
}

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lec',
  tutorial: 'Tut',
  lab: 'Lab',
  workshop: 'Wksp',
}

// CELL_HEIGHT must match the h-14 (3.5rem) used in GridCell.
const CELL_HEIGHT_REM = 3.5

interface ScheduledSessionCardProps {
  assignment: TimetableAssignment
  colorVariant: UnitColorVariant
  isMoving?: boolean
  isUnscheduling?: boolean
  isInvalid?: boolean
  onMoveStart?: () => void
  onUnschedule?: () => void
  isMutating?: boolean
}

export const ScheduledSessionCard = memo(function ScheduledSessionCard({
  assignment,
  colorVariant,
  isMoving = false,
  isUnscheduling = false,
  isInvalid = false,
  onMoveStart,
  onUnschedule,
  isMutating = false,
}: ScheduledSessionCardProps) {
  const [hovered, setHovered] = useState(false)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scheduled:${assignment.assignment_id ?? assignment.session_id}`,
    data: { type: 'scheduled', assignment },
    disabled: isMutating,
  })

  const accent = isInvalid ? 'var(--state-error)' : ACCENT_MAP[colorVariant]
  const bg = isInvalid ? 'var(--state-error-bg)' : BG_MAP[colorVariant]
  const showActions = (hovered || isMoving) && !isUnscheduling

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="absolute inset-x-0 top-0 rounded-md border overflow-hidden z-10 px-1.5 py-1 flex flex-col gap-0.5 select-none"
      style={{
        height: `calc(${assignment.duration} * ${CELL_HEIGHT_REM}rem)`,
        backgroundColor: bg,
        borderColor: isMoving ? 'var(--accent-primary)' : accent,
        borderLeftWidth: '4px',
        outline: isMoving ? '2px solid var(--accent-primary)' : 'none',
        outlineOffset: '-1px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Action buttons: stopPropagation on pointerDown prevents drag from initiating on buttons */}
      {showActions && (
        <div
          className="absolute top-0.5 right-0.5 flex items-center gap-0.5 z-20"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onMoveStart && (
            <button
              className="p-0.5 rounded"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: isMoving ? 'var(--accent-primary)' : 'var(--text-muted)',
                opacity: isMutating ? 0.4 : 1,
                cursor: isMutating ? 'not-allowed' : 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!isMutating) onMoveStart()
              }}
              title={isMoving ? 'Cancel move' : 'Move session'}
              aria-label={isMoving ? 'Cancel move' : 'Move session'}
            >
              <GripHorizontal className="h-3 w-3" />
            </button>
          )}
          {onUnschedule && (
            <button
              className="p-0.5 rounded"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                opacity: isMutating ? 0.4 : 1,
                cursor: isMutating ? 'not-allowed' : 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!isMutating) onUnschedule()
              }}
              title="Remove from timetable"
              aria-label="Remove from timetable"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Unscheduling loading overlay */}
      {isUnscheduling && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20"
          style={{ backgroundColor: bg, opacity: 0.85 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />
        </div>
      )}

      {/* Card content */}
      <div className="flex items-baseline gap-1 min-w-0">
        {isInvalid && (
          <TriangleAlert
            className="h-3 w-3 shrink-0 self-center"
            style={{ color: 'var(--state-error)' }}
            aria-label="Constraint violation"
          />
        )}
        <span
          className="text-xs font-semibold shrink-0"
          style={{ color: accent }}
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
})
