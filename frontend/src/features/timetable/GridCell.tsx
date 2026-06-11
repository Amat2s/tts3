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
  isOccupied?: boolean
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
  isOccupied = !!assignment,
  pendingSessionId,
  hasWarning = false,
  onCellClick,
  onUnschedule,
  onMoveSelect,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  // Droppable ID format matches buildAssignmentMap key: "${day}:${roomId}:${slotId}"
  // isOccupied covers all slots spanned by a multi-slot session, not just the start slot.
  const { setNodeRef, isOver } = useDroppable({
    id: `${day}:${roomId}:${slotId}`,
    disabled: isOccupied,
  })

  const isClickDropTarget = !!pendingSessionId && !isOccupied
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
