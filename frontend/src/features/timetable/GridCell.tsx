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
}

export function GridCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
  assignment,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="relative h-14 flex-1 border-r rounded-none"
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor:
          hovered && !assignment ? 'var(--grid-cell-hover)' : 'var(--bg-surface)',
      }}
      onMouseEnter={() => { if (!assignment) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
    >
      {assignment && (
        <ScheduledSessionCard
          assignment={assignment}
          colorVariant={getUnitColor(assignment.unit_id)}
        />
      )}
    </div>
  )
}
