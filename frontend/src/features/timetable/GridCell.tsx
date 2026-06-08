import { useState } from 'react'

interface GridCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
}

export function GridCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="h-14 flex-1 border-r border-b rounded-none"
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor: hovered
          ? 'var(--grid-cell-hover)'
          : 'var(--bg-surface)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
    />
  )
}
