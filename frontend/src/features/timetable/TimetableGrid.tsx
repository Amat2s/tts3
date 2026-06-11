import { memo, useMemo, useRef, useEffect } from 'react'
import { DAYS, AM_SLOTS, PM_SLOTS, LUNCH_LABEL } from './slots'
import { GridCell } from './GridCell'
import type { TimetableAssignment } from './assignment'

export interface RoomColumn {
  id: string
  name: string
}

interface TimetableGridProps {
  rooms: RoomColumn[]
  assignments?: TimetableAssignment[]
  onCellClick?: (day: string, roomId: string, slotId: string) => void
  isInteractive?: boolean
  movingAssignmentId?: string | null
  unschedulingAssignmentId?: string | null
  onMoveStart?: (assignmentId: string) => void
  onUnschedule?: (assignmentId: string) => void
  frozenAssignmentIds?: Set<string>
  invalidSessionIds?: Set<string>
  onCellWidthChange?: (width: number) => void
}

const TIME_COL_W = '6rem'

const noSelectStyle: React.CSSProperties = { userSelect: 'none' }

const EMPTY_FROZEN = new Set<string>()
const EMPTY_INVALID = new Set<string>()

function preventDefault(e: React.MouseEvent) {
  e.preventDefault()
}

function buildAssignmentMap(
  assignments: TimetableAssignment[]
): Map<string, TimetableAssignment> {
  const map = new Map<string, TimetableAssignment>()
  for (const a of assignments) {
    map.set(`${a.day}:${a.room_id}:${a.start_slot}`, a)
  }
  return map
}

const SLOT_IDS = TIME_SLOTS.map((s) => s.id)

// Returns every "${day}:${roomId}:${slotId}" key covered by each session,
// not just the start slot, so intermediate cells are treated as occupied.
function buildCoveredSet(assignments: TimetableAssignment[]): Set<string> {
  const set = new Set<string>()
  for (const a of assignments) {
    const startIdx = SLOT_IDS.indexOf(a.start_slot)
    for (let i = 0; i < a.duration; i++) {
      const slotId = SLOT_IDS[startIdx + i]
      if (slotId) set.add(`${a.day}:${a.room_id}:${slotId}`)
    }
  }
  return set
}

function TimeLabel({ label }: { label: string }) {
  return (
    <div
      className="shrink-0 flex items-center justify-end pr-3 border-r text-xs font-mono"
      style={{
        width: TIME_COL_W,
        borderColor: 'var(--grid-line-strong)',
        color: 'var(--text-muted)',
        ...noSelectStyle,
      }}
      onContextMenu={preventDefault}
    >
      {label}
    </div>
  )
}

export const TimetableGrid = memo(function TimetableGrid({
  rooms,
  assignments = [],
  onCellClick,
  isInteractive = false,
  movingAssignmentId,
  unschedulingAssignmentId,
  onMoveStart,
  onUnschedule,
  frozenAssignmentIds = EMPTY_FROZEN,
  invalidSessionIds = EMPTY_INVALID,
  onCellWidthChange,
}: TimetableGridProps) {
  const cellMeasureRef = useRef<HTMLDivElement>(null)
  const assignmentMap = useMemo(() => buildAssignmentMap(assignments), [assignments])

  useEffect(() => {
    const el = cellMeasureRef.current
    if (!el || !onCellWidthChange) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) onCellWidthChange(Math.round(w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onCellWidthChange])

  if (rooms.length === 0) return null

  function renderCells(day: string, slotId: string) {
    return rooms.map((room, rIdx) => {
      const assignment = assignmentMap.get(`${day}:${room.id}:${slotId}`)
      const assignId = assignment?.assignment_id
      const sessionId = assignment?.session_id
      const isCardMutating = assignId != null && frozenAssignmentIds.has(assignId)
      const isInvalid = sessionId != null && invalidSessionIds.has(sessionId)
      return (
        <GridCell
          key={`${day}-${room.id}-${slotId}`}
          slotId={slotId}
          day={day}
          roomId={room.id}
          isDayBoundary={rIdx === rooms.length - 1}
          assignment={assignment}
          onClick={onCellClick ? () => onCellClick(day, room.id, slotId) : undefined}
          isInteractive={isInteractive}
          isMoving={movingAssignmentId != null && assignId === movingAssignmentId}
          isUnscheduling={unschedulingAssignmentId != null && assignId === unschedulingAssignmentId}
          isInvalid={isInvalid}
          onMoveStart={assignId ? () => onMoveStart?.(assignId) : undefined}
          onUnschedule={assignId ? () => onUnschedule?.(assignId) : undefined}
          isMutating={isCardMutating}
        />
      )
    })
  }

  return (
    <div
      className="w-full border rounded-none"
      style={{ borderColor: 'var(--grid-line-strong)' }}
    >
      {/* Day header row */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--grid-line-strong)' }}
      >
        <div
          className="shrink-0 border-r"
          style={{ width: TIME_COL_W, borderColor: 'var(--grid-line-strong)' }}
        />
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex items-center justify-center py-2 border-r text-sm font-medium select-none"
            style={{
              flex: rooms.length,
              borderColor: 'var(--grid-line-strong)',
              color: 'var(--text-primary)',
            }}
            onContextMenu={preventDefault}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Room sub-header row — first cell is used to measure column width */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--grid-line)' }}
      >
        <div
          className="shrink-0 border-r"
          style={{ width: TIME_COL_W, borderColor: 'var(--grid-line-strong)' }}
        />
        {DAYS.flatMap((day, dIdx) =>
          rooms.map((room, rIdx) => (
            <div
              key={`header-${day}-${room.id}`}
              ref={dIdx === 0 && rIdx === 0 ? cellMeasureRef : undefined}
              className="flex-1 flex items-center justify-center py-1 border-r text-xs select-none overflow-hidden"
              style={{
                borderRightColor:
                  rIdx === rooms.length - 1
                    ? 'var(--grid-line-strong)'
                    : 'var(--grid-line)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-muted)',
              }}
              onContextMenu={preventDefault}
            >
              <span className="truncate px-1">{room.name}</span>
            </div>
          ))
        )}
      </div>

      {/* AM time slot rows */}
      {AM_SLOTS.map((slot) => (
        <div
          key={slot.id}
          className="flex border-b"
          style={{ borderColor: 'var(--grid-line)' }}
        >
          <TimeLabel label={slot.label} />
          {DAYS.flatMap((day) => renderCells(day, slot.id))}
        </div>
      ))}

      {/* Lunch divider */}
      <div
        className="flex border-b"
        style={{
          borderColor: 'var(--grid-line-strong)',
          backgroundColor: 'var(--grid-lunch-bg)',
        }}
      >
        <div
          className="shrink-0 flex items-center justify-end pr-3 border-r text-xs font-mono"
          style={{
            width: TIME_COL_W,
            borderColor: 'var(--grid-line-strong)',
            color: 'var(--text-muted)',
            ...noSelectStyle,
          }}
          onContextMenu={preventDefault}
        >
          {LUNCH_LABEL}
        </div>
        <div
          className="flex-1 flex items-center justify-center py-2 text-xs tracking-wide select-none"
          style={{ color: 'var(--text-muted)' }}
          onContextMenu={preventDefault}
        >
          Lunch
        </div>
      </div>

      {/* PM time slot rows */}
      {PM_SLOTS.map((slot, idx) => (
        <div
          key={slot.id}
          className="flex"
          style={{
            borderBottom:
              idx < PM_SLOTS.length - 1
                ? `1px solid var(--grid-line)`
                : 'none',
          }}
        >
          <TimeLabel label={slot.label} />
          {DAYS.flatMap((day) => renderCells(day, slot.id))}
        </div>
      ))}
    </div>
  )
})
