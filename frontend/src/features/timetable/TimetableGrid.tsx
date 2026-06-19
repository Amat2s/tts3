import { useEffect, useRef } from 'react'
import { DAYS, AM_SLOTS, PM_SLOTS, LUNCH_LABEL, TIME_SLOTS } from './slots'
import { GridCell } from './GridCell'
import type { TimetableGridMetrics } from './hoverHighlight'
import type { TimetableAssignment } from './assignment'

export interface RoomColumn {
  id: string
  name: string
}

interface TimetableGridProps {
  rooms: RoomColumn[]
  assignments?: TimetableAssignment[]
  pendingSessionId?: string | null
  warningSessionIds?: Set<string>
  editingDisabled?: boolean
  // Set of "day:roomId:slotId" keys to highlight (valid hover proposals only).
  hoverHighlightKeys?: Set<string>
  onCellClick?: (day: string, slotId: string, roomId: string) => void
  onUnschedule?: (sessionId: string) => void
  onMoveSelect?: (sessionId: string) => void
  // Called with measured grid cell dimensions; recomputed on container resize.
  onMetricsChange?: (metrics: TimetableGridMetrics) => void
}

const TIME_COL_W = '6rem'

const noSelectStyle: React.CSSProperties = { userSelect: 'none' }

function preventDefault(e: React.MouseEvent) {
  e.preventDefault()
}

// Key format: "${day}:${roomId}:${slotId}"
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

export function TimetableGrid({
  rooms,
  assignments = [],
  pendingSessionId,
  warningSessionIds,
  editingDisabled = false,
  hoverHighlightKeys,
  onCellClick,
  onUnschedule,
  onMoveSelect,
  onMetricsChange,
}: TimetableGridProps) {
  // Hooks must run unconditionally and before any early return so the hook
  // order stays stable when `rooms` changes from empty to non-empty.
  // Measure the first grid cell and report dimensions to the parent.
  // Uses a ResizeObserver on the container so metrics update on layout changes.
  const containerRef = useRef<HTMLDivElement>(null)
  const onMetricsChangeRef = useRef(onMetricsChange)
  useEffect(() => {
    onMetricsChangeRef.current = onMetricsChange
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function measure() {
      const cell = container!.querySelector<HTMLElement>('[data-grid-cell]')
      if (cell && onMetricsChangeRef.current) {
        onMetricsChangeRef.current({
          cellWidth: cell.offsetWidth,
          rowHeight: cell.offsetHeight,
        })
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(container)
    return () => ro.disconnect()
  }, []) // ResizeObserver handles layout-driven changes; callback accessed via ref

  if (rooms.length === 0) return null

  const assignmentMap = buildAssignmentMap(assignments)
  const coveredSet = buildCoveredSet(assignments)

  return (
    <div
      ref={containerRef}
      className="w-full border rounded-none"
      style={{ borderColor: 'var(--grid-border-emphasis)' }}
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

      {/* Room sub-header row */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--grid-line)' }}
      >
        <div
          className="shrink-0 border-r"
          style={{ width: TIME_COL_W, borderColor: 'var(--grid-line-strong)' }}
        />
        {DAYS.flatMap((day) =>
          rooms.map((room, rIdx) => (
            <div
              key={`header-${day}-${room.id}`}
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
          {DAYS.flatMap((day) =>
            rooms.map((room, rIdx) => {
              const a = assignmentMap.get(`${day}:${room.id}:${slot.id}`)
              return (
                <GridCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  isDayBoundary={rIdx === rooms.length - 1}
                  assignment={a}
                  isOccupied={coveredSet.has(`${day}:${room.id}:${slot.id}`)}
                  pendingSessionId={pendingSessionId}
                  editingDisabled={editingDisabled}
                  hasWarning={a ? (warningSessionIds?.has(a.session_id) ?? false) : false}
                  isHoverHighlighted={hoverHighlightKeys?.has(`${day}:${room.id}:${slot.id}`) ?? false}
                  onCellClick={onCellClick ? () => onCellClick(day, slot.id, room.id) : undefined}
                  onUnschedule={onUnschedule}
                  onMoveSelect={onMoveSelect}
                />
              )
            })
          )}
        </div>
      ))}

      {/* Lunch/Mass divider */}
      <div
        className="flex border-y"
        style={{
          borderColor: 'var(--grid-lunch-mass-border)',
          backgroundColor: 'var(--grid-lunch-mass-bg)',
        }}
      >
        <div
          className="shrink-0 flex items-center justify-end pr-3 border-r text-xs font-mono"
          style={{
            width: TIME_COL_W,
            borderColor: 'var(--grid-lunch-mass-border)',
            color: 'var(--grid-lunch-mass-text)',
            ...noSelectStyle,
          }}
          onContextMenu={preventDefault}
        >
          {LUNCH_LABEL}
        </div>
        <div
          className="flex-1 flex items-center justify-center py-2 text-xs font-medium tracking-wide select-none"
          style={{ color: 'var(--grid-lunch-mass-text)' }}
          onContextMenu={preventDefault}
        >
          Lunch/Mass
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
          {DAYS.flatMap((day) =>
            rooms.map((room, rIdx) => {
              const a = assignmentMap.get(`${day}:${room.id}:${slot.id}`)
              return (
                <GridCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  isDayBoundary={rIdx === rooms.length - 1}
                  assignment={a}
                  isOccupied={coveredSet.has(`${day}:${room.id}:${slot.id}`)}
                  pendingSessionId={pendingSessionId}
                  editingDisabled={editingDisabled}
                  hasWarning={a ? (warningSessionIds?.has(a.session_id) ?? false) : false}
                  isHoverHighlighted={hoverHighlightKeys?.has(`${day}:${room.id}:${slot.id}`) ?? false}
                  onCellClick={onCellClick ? () => onCellClick(day, slot.id, room.id) : undefined}
                  onUnschedule={onUnschedule}
                  onMoveSelect={onMoveSelect}
                />
              )
            })
          )}
        </div>
      ))}
    </div>
  )
}
