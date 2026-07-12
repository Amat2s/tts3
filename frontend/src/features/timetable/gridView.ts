import { useState } from 'react'
import { DAYS, type Day } from './slots'

// Unit 103: view-only grid controls shared by /timetable and /preferences.
//
// Extended-mode geometry — each room column gets at least this width so columns
// stop squeezing on dense (many-room) timetables; the grid then overflows its
// container horizontally (scroll) instead of shrinking cells to nothing.
// Unit 108: halved (92 → 46) so the extended layout is ~2× narrower overall —
// less aggressive while still widening past the container and staying scrollable.
export const EXTENDED_MIN_COL_PX = 46
// Matches TIME_COL_W (6rem) in the grids.
export const GRID_TIME_COL_PX = 96

// Minimum grid width in extended mode: the fixed time-label column plus one
// min-width column per visible day × room.
export function extendedGridMinWidth(
  visibleDayCount: number,
  roomCount: number
): number {
  return GRID_TIME_COL_PX + visibleDayCount * roomCount * EXTENDED_MIN_COL_PX
}

export interface GridViewState {
  extended: boolean
  setExtended: (value: boolean) => void
  toggleExtended: () => void
  visibleDays: Day[]
  toggleDay: (day: Day) => void
}

// State for the shared grid view controls: an extend (wider + horizontal scroll)
// toggle and a per-day visibility filter. This state never mutates saved data —
// hidden days keep all assignments/preferences and reappear unchanged when shown
// again; validation and the solver still operate on the full dataset.
export function useGridViewState(): GridViewState {
  const [extended, setExtended] = useState(false)
  const [hiddenDays, setHiddenDays] = useState<ReadonlySet<Day>>(
    () => new Set()
  )

  const visibleDays = DAYS.filter((d) => !hiddenDays.has(d))

  function toggleDay(day: Day) {
    setHiddenDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        // Never hide the final visible day; keep at least one column rendered.
        if (DAYS.length - next.size <= 1) return prev
        next.add(day)
      }
      return next
    })
  }

  return {
    extended,
    setExtended,
    toggleExtended: () => setExtended((v) => !v),
    visibleDays,
    toggleDay,
  }
}
