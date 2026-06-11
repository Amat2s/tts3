import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { TimetableAssignment } from './assignment'
import { ScheduledSessionCard } from './ScheduledSessionCard'
import { getUnitColor } from './unitColors'

interface GridCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
  assignment?: TimetableAssignment
  pendingSessionId?: string | null
  hasWarning?: boolean
  onCellClick?: () => void
  onUnschedule?: (sessionId: string) => void
  onMoveSelect?: (sessionId: string) => void
}

export function GridCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
  assignment,
  pendingSessionId,
  hasWarning = false,
  onCellClick,
  onUnschedule,
  onMoveSelect,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  // Droppable ID format matches buildAssignmentMap key: "${day}:${roomId}:${slotId}"
  const { setNodeRef, isOver } = useDroppable({
    id: `${day}:${roomId}:${slotId}`,
    // Disable dropping onto cells that already have a session starting there
    disabled: !!assignment,
  })

  const isClickDropTarget = !!pendingSessionId && !assignment
  const showDropHighlight = isOver || (isClickDropTarget && hovered)

  function handleClick() {
    if (isClickDropTarget) {
      onCellClick?.()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className="relative h-14 flex-1 border-r rounded-none"
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor: showDropHighlight
          ? 'var(--grid-cell-hover)'
          : 'var(--bg-surface)',
        cursor: isClickDropTarget ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
    >
      {assignment && (
        <ScheduledSessionCard
          assignment={assignment}
          colorVariant={getUnitColor(assignment.unit_id)}
          isPending={pendingSessionId === assignment.session_id}
          hasWarning={hasWarning}
          onUnschedule={() => onUnschedule?.(assignment.session_id)}
          onMoveSelect={() => onMoveSelect?.(assignment.session_id)}
        />
      )}
    </div>
  )
}
