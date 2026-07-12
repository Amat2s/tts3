import {
  DAYS,
  AM_SLOTS,
  PM_SLOTS,
  LUNCH_LABEL,
  type Day,
} from '@/features/timetable/slots'
import { extendedGridMinWidth } from '@/features/timetable/gridView'
import type { RoomColumn } from '@/features/timetable/TimetableGrid'
import type { LecturerPreferenceLevel } from '@/lib/api/lecturerPreferences'
import { PreferenceCell } from './PreferenceCell'

interface PreferenceGridProps {
  rooms: RoomColumn[]
  // Cell levels keyed by "day:roomId:slotId"; absent key means neutral.
  preferenceLevels?: Map<string, LecturerPreferenceLevel>
  onCellClick?: (day: string, slotId: string, roomId: string) => void
  // Disabled until a lecturer is selected.
  interactionDisabled?: boolean
  // Unit 103: view-only controls. Which weekdays to render (default all), and
  // whether to render the wider, horizontally scrollable extended layout.
  visibleDays?: Day[]
  extended?: boolean
}

export function preferenceCellKey(
  day: string,
  roomId: string,
  slotId: string
): string {
  return `${day}:${roomId}:${slotId}`
}

const TIME_COL_W = '6rem'

const noSelectStyle: React.CSSProperties = { userSelect: 'none' }

function preventDefault(e: React.MouseEvent) {
  e.preventDefault()
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

// Unit 99/103: sessions-free variant of `TimetableGrid`. It reuses the same day,
// room, and time-slot structure (Monday-Friday, rooms nested under each day,
// fixed AM/PM slot rows split by the Lunch/Mass divider) but renders neutral
// `PreferenceCell`s with no session cards, drag/drop, blocks, or sticky action
// bar. Like `TimetableGrid`, it needs rooms to render and returns null when the
// room list is empty (the route shows the shared empty-state instead). It shares
// the view-only day filter and extend/scroll behaviour with `TimetableGrid`.
export function PreferenceGrid({
  rooms,
  preferenceLevels,
  onCellClick,
  interactionDisabled = false,
  visibleDays = DAYS,
  extended = false,
}: PreferenceGridProps) {
  if (rooms.length === 0) return null

  // Match /timetable's room sub-header sizing: the narrow layout shrinks the
  // label further (keeping truncation), the extended layout keeps it legible.
  const roomHeaderTextSize = extended ? 'text-[0.65rem]' : 'text-[0.4rem]'

  const roomName = (id: string) =>
    rooms.find((r) => r.id === id)?.name ?? id
  const minWidth = extended
    ? extendedGridMinWidth(visibleDays.length, rooms.length)
    : undefined

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="w-full border rounded-none"
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
              rooms.map((room, rIdx) => (
                <PreferenceCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  timeLabel={slot.label}
                  roomName={roomName(room.id)}
                  isDayBoundary={rIdx === rooms.length - 1}
                  level={
                    preferenceLevels?.get(
                      preferenceCellKey(day, room.id, slot.id)
                    ) ?? null
                  }
                  disabled={interactionDisabled}
                  onClick={
                    onCellClick
                      ? () => onCellClick(day, slot.id, room.id)
                      : undefined
                  }
                />
              ))
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
              rooms.map((room, rIdx) => (
                <PreferenceCell
                  key={`${day}-${room.id}-${slot.id}`}
                  slotId={slot.id}
                  day={day}
                  roomId={room.id}
                  timeLabel={slot.label}
                  roomName={roomName(room.id)}
                  isDayBoundary={rIdx === rooms.length - 1}
                  level={
                    preferenceLevels?.get(
                      preferenceCellKey(day, room.id, slot.id)
                    ) ?? null
                  }
                  disabled={interactionDisabled}
                  onClick={
                    onCellClick
                      ? () => onCellClick(day, slot.id, room.id)
                      : undefined
                  }
                />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
