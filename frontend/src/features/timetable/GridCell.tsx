import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { TimetableAssignment } from './assignment'
import { ScheduledSessionCard } from './ScheduledSessionCard'
import { getSubjectTokens } from './unitColors'

interface GridCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
  assignment?: TimetableAssignment
  isOccupied?: boolean
  pendingSessionId?: string | null
  hasWarning?: boolean
  editingDisabled?: boolean
  isHoverHighlighted?: boolean
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
  editingDisabled = false,
  isHoverHighlighted = false,
  onCellClick,
  onUnschedule,
  onMoveSelect,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  // Droppable ID format matches buildAssignmentMap key: "${day}:${roomId}:${slotId}"
  // isOccupied covers all slots spanned by a multi-slot session, not just the start slot.
  // Drops are also disabled while a solver run is in progress.
  const { setNodeRef } = useDroppable({
    id: `${day}:${roomId}:${slotId}`,
    disabled: isOccupied || editingDisabled,
  })

  const isClickDropTarget = !!pendingSessionId && !isOccupied && !editingDisabled
  // Hover highlight is driven by the parent-computed hoverHighlightKeys (valid
  // drag proposals only). Click-based hover uses local mouse state.
  const showDropHighlight = isHoverHighlighted || (isClickDropTarget && hovered)

  function handleClick() {
    if (isClickDropTarget) {
      onCellClick?.()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className="relative h-14 flex-1 border-r rounded-none"
      data-grid-cell="true"
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
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
    >
      {assignment && (
        <ScheduledSessionCard
          assignment={assignment}
          colorTokens={getSubjectTokens(assignment.unit_code)}
          isPending={pendingSessionId === assignment.session_id}
          hasWarning={hasWarning}
          editingDisabled={editingDisabled}
          onUnschedule={() => onUnschedule?.(assignment.session_id)}
          onMoveSelect={() => onMoveSelect?.(assignment.session_id)}
        />
      )}
    </div>
  )
}
