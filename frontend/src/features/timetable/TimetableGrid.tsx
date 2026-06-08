import { DAYS, AM_SLOTS, PM_SLOTS, LUNCH_LABEL } from './slots'
import { GridCell } from './GridCell'

export interface RoomColumn {
  id: string
  name: string
}

interface TimetableGridProps {
  rooms: RoomColumn[]
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

export function TimetableGrid({ rooms }: TimetableGridProps) {
  if (rooms.length === 0) return null

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
            rooms.map((room, rIdx) => (
              <GridCell
                key={`${day}-${room.id}-${slot.id}`}
                slotId={slot.id}
                day={day}
                roomId={room.id}
                isDayBoundary={rIdx === rooms.length - 1}
              />
            ))
          )}
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
          {DAYS.flatMap((day) =>
            rooms.map((room, rIdx) => (
              <GridCell
                key={`${day}-${room.id}-${slot.id}`}
                slotId={slot.id}
                day={day}
                roomId={room.id}
                isDayBoundary={rIdx === rooms.length - 1}
              />
            ))
          )}
        </div>
      ))}
    </div>
  )
}
