import { useEffect, useMemo, useRef } from 'react'
import { DAYS, AM_SLOTS, PM_SLOTS, LUNCH_LABEL, TIME_SLOTS, type Day } from './slots'
import { extendedGridMinWidth } from './gridView'
import { GridCell } from './GridCell'
import type { TimetableGridMetrics } from './hoverHighlight'
import type { TimetableAssignment } from './assignment'
import { buildBlockAnchorData, type BlockedCell } from './blocks'
import { computeSeminarLetters, computeTutorialLetters } from './tutorialLetters'

export interface RoomColumn {
  id: string
  name: string
}

interface TimetableGridProps {
  rooms: RoomColumn[]
  assignments?: TimetableAssignment[]
  // Unit 85: reserved cells keyed by "day:roomId:slotId" (see buildBlockedCellMap).
  blockedCells?: Map<string, BlockedCell>
  isBlockInteractive?: boolean
  onBlockClick?: (blockId: string) => void
  pendingSessionId?: string | null
  warningSessionIds?: Set<string>
  editingDisabled?: boolean
  // Set of "day:roomId:slotId" keys to highlight (valid hover proposals only).
  hoverHighlightKeys?: Set<string>
  // Unit 86: block-selection mode and the currently selected cell keys.
  blockSelectionMode?: boolean
  blockSelectionKeys?: Set<string>
  onBlockCellSelect?: (day: string, slotId: string, roomId: string) => void
  onCellClick?: (day: string, slotId: string, roomId: string) => void
  onUnschedule?: (sessionId: string) => void
  onMoveSelect?: (sessionId: string) => void
  // Called with measured grid cell dimensions; recomputed on container resize.
  onMetricsChange?: (metrics: TimetableGridMetrics) => void
  // Unit 103: view-only controls. Which weekdays to render (default all), and
  // whether to render the wider, horizontally scrollable extended layout.
  visibleDays?: Day[]
  extended?: boolean
  // Unit 108: session ids whose scheduled card should be dimmed (non-matching
  // for the active search). View-only — the cards stay in place, just faded.
  dimmedSessionIds?: Set<string>
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
  blockedCells,
  isBlockInteractive = false,
  onBlockClick,
  pendingSessionId,
  warningSessionIds,
  editingDisabled = false,
  hoverHighlightKeys,
  blockSelectionMode = false,
  blockSelectionKeys,
  onBlockCellSelect,
  onCellClick,
  onUnschedule,
  onMoveSelect,
  onMetricsChange,
  visibleDays = DAYS,
  extended = false,
  dimmedSessionIds,
}: TimetableGridProps) {
  // Unit 108: room sub-header shrinks further in the narrow (non-extended)
  // layout, keeping truncation; the extended layout keeps the Unit 103 size.
  const roomHeaderTextSize = extended ? 'text-[0.65rem]' : 'text-[0.4rem]'
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

  // Compute merged-block anchor data: for each block group/slot that spans
  // multiple adjacent room columns, identify the leftmost "anchor" cell (which
  // renders a merged card spanning N columns) and the covered non-anchor cells
  // (which render no visual card but remain functionally blocked).
  const { anchorMap, suppressSet } = useMemo(
    () =>
      blockedCells
        ? buildBlockAnchorData(blockedCells, rooms)
        : {
            anchorMap: new Map<string, { roomSpan: number; slotSpan: number }>(),
            suppressSet: new Set<string>(),
          },
    [blockedCells, rooms]
  )

  // Excel-export-style order letters ("Tutorial A" / "Seminar A"), recomputed
  // whenever the visible assignment set or room order changes. Tutorial and
  // seminar letters are independent per-unit A/B/C… series (Unit 116); merging
  // them into one map is safe since a session is never both types.
  const orderLetters = useMemo(() => {
    const tutorial = computeTutorialLetters(assignments, rooms)
    const seminar = computeSeminarLetters(assignments, rooms)
    return new Map([...tutorial, ...seminar])
  }, [assignments, rooms])

  if (rooms.length === 0) return null

  const assignmentMap = buildAssignmentMap(assignments)
  const coveredSet = buildCoveredSet(assignments)
  // Extended mode widens the grid past its container so cell measurement stays
  // legible on dense timetables; the ResizeObserver above re-measures the cell
  // when this width change lands, keeping drag/drop metrics accurate.
  const minWidth = extended
    ? extendedGridMinWidth(visibleDays.length, rooms.length)
    : undefined

  return (
    <div className="w-full overflow-x-auto">
    {/* overflow-hidden clips the absolutely-positioned session/block cards to the
        grid box so a sub-pixel span at the last row/column can never spill past
        the table border or trigger a spurious vertical scrollbar. */}
    <div
      ref={containerRef}
      className="w-full border rounded-none overflow-hidden"
      style={{ borderColor: 'var(--grid-border-emphasis)', minWidth }}
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
        {visibleDays.map((day) => (
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
        {visibleDays.flatMap((day) =>
          rooms.map((room, rIdx) => (
            <div
              key={`header-${day}-${room.id}`}
              className={`flex-1 flex items-center justify-center py-1 border-r ${roomHeaderTextSize} select-none overflow-hidden`}
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
          {visibleDays.flatMap((day) =>
            rooms.map((room, rIdx) => {
              const cellKey = `${day}:${room.id}:${slot.id}`
              const a = assignmentMap.get(cellKey)
              return (
                <GridCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  isDayBoundary={rIdx === rooms.length - 1}
                  assignment={a}
                  orderLetter={a ? orderLetters.get(a.session_id) : undefined}
                  blockedCell={blockedCells?.get(cellKey) ?? null}
                  blockRoomSpan={anchorMap.get(cellKey)?.roomSpan}
                  blockSlotSpan={anchorMap.get(cellKey)?.slotSpan}
                  suppressBlockVisual={suppressSet.has(cellKey)}
                  isBlockInteractive={isBlockInteractive}
                  onBlockClick={onBlockClick}
                  isOccupied={coveredSet.has(cellKey)}
                  pendingSessionId={pendingSessionId}
                  editingDisabled={editingDisabled}
                  extended={extended}
                  hasWarning={a ? (warningSessionIds?.has(a.session_id) ?? false) : false}
                  isDimmed={a ? (dimmedSessionIds?.has(a.session_id) ?? false) : false}
                  isHoverHighlighted={hoverHighlightKeys?.has(cellKey) ?? false}
                  blockSelectionMode={blockSelectionMode}
                  isBlockSelected={blockSelectionKeys?.has(cellKey) ?? false}
                  onBlockCellSelect={onBlockCellSelect ? () => onBlockCellSelect(day, slot.id, room.id) : undefined}
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
          {visibleDays.flatMap((day) =>
            rooms.map((room, rIdx) => {
              const cellKey = `${day}:${room.id}:${slot.id}`
              const a = assignmentMap.get(cellKey)
              return (
                <GridCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  isDayBoundary={rIdx === rooms.length - 1}
                  assignment={a}
                  orderLetter={a ? orderLetters.get(a.session_id) : undefined}
                  blockedCell={blockedCells?.get(cellKey) ?? null}
                  blockRoomSpan={anchorMap.get(cellKey)?.roomSpan}
                  blockSlotSpan={anchorMap.get(cellKey)?.slotSpan}
                  suppressBlockVisual={suppressSet.has(cellKey)}
                  isBlockInteractive={isBlockInteractive}
                  onBlockClick={onBlockClick}
                  isOccupied={coveredSet.has(cellKey)}
                  pendingSessionId={pendingSessionId}
                  editingDisabled={editingDisabled}
                  extended={extended}
                  hasWarning={a ? (warningSessionIds?.has(a.session_id) ?? false) : false}
                  isDimmed={a ? (dimmedSessionIds?.has(a.session_id) ?? false) : false}
                  isHoverHighlighted={hoverHighlightKeys?.has(cellKey) ?? false}
                  blockSelectionMode={blockSelectionMode}
                  isBlockSelected={blockSelectionKeys?.has(cellKey) ?? false}
                  onBlockCellSelect={onBlockCellSelect ? () => onBlockCellSelect(day, slot.id, room.id) : undefined}
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
    </div>
  )
}
