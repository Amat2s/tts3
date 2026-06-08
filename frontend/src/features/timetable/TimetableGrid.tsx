import { DAYS, AM_SLOTS, PM_SLOTS, LUNCH_LABEL } from './slots'
import { GridCell } from './GridCell'

export interface RoomColumn {
  id: string
  name: string
}

interface TimetableGridProps {
  rooms: RoomColumn[]
}

const TIME_COL_W = '4rem'
const ROOM_COL_W = 8 // rem per room column

function TimeLabel({ label }: { label: string }) {
  return (
    <div
      className="shrink-0 flex items-center justify-end pr-3 border-r text-xs font-mono"
      style={{
        width: TIME_COL_W,
        borderColor: 'var(--grid-line-strong)',
        color: 'var(--text-muted)',
      }}
    >
      {label}
    </div>
  )
}

export function TimetableGrid({ rooms }: TimetableGridProps) {
  if (rooms.length === 0) return null

  const dayWidth = `${rooms.length * ROOM_COL_W}rem`

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-max border rounded-none"
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
              className="shrink-0 flex items-center justify-center py-2 border-r text-sm font-medium"
              style={{
                width: dayWidth,
                borderColor: 'var(--grid-line-strong)',
                color: 'var(--text-primary)',
              }}
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
                className="shrink-0 w-32 flex items-center justify-center py-1 border-r text-xs"
                style={{
                  borderRightColor:
                    rIdx === rooms.length - 1
                      ? 'var(--grid-line-strong)'
                      : 'var(--grid-line)',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-muted)',
                }}
              >
                {room.name}
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
            }}
          >
            {LUNCH_LABEL}
          </div>
          <div
            className="flex-1 flex items-center justify-center py-2 text-xs tracking-wide"
            style={{ color: 'var(--text-muted)' }}
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
    </div>
  )
}
