import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { TimetableAssignment } from './assignment'
import { ScheduledSessionCard } from './ScheduledSessionCard'
import { getUnitColor } from './unitColors'

interface GridCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
  assignment?: TimetableAssignment
  onClick?: () => void
  isInteractive?: boolean
  isMoving?: boolean
  isUnscheduling?: boolean
  isInvalid?: boolean
  onMoveStart?: () => void
  onUnschedule?: () => void
  isMutating?: boolean
}

export function GridCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
  assignment,
  onClick,
  isInteractive = false,
  isMoving = false,
  isUnscheduling = false,
  isInvalid = false,
  onMoveStart,
  onUnschedule,
  isMutating = false,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)
  const canClick = isInteractive && !!onClick

  const { setNodeRef, isOver } = useDroppable({
    id: `${day}:${roomId}:${slotId}`,
  })

  return (
    <div
      ref={setNodeRef}
      className="relative h-14 flex-1 border-r rounded-none"
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor:
          (isOver && !assignment) || (canClick && hovered && !assignment)
            ? 'var(--grid-cell-hover)'
            : 'var(--bg-surface)',
        cursor: canClick ? 'crosshair' : 'default',
        outline: isOver ? '2px solid var(--accent-secondary)' : 'none',
        outlineOffset: '-2px',
      }}
      onMouseEnter={() => { if (!assignment) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
      onClick={canClick ? onClick : undefined}
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
    >
      {assignment && (
        <ScheduledSessionCard
          assignment={assignment}
          colorVariant={getUnitColor(assignment.unit_id)}
          isMoving={isMoving}
          isUnscheduling={isUnscheduling}
          isInvalid={isInvalid}
          onMoveStart={onMoveStart}
          onUnschedule={onUnschedule}
          isMutating={isMutating}
        />
      )}
    </div>
  )
}
