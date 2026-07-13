import type { TimetableAssignment } from './assignment'
import { DAYS, TIME_SLOTS } from './slots'

const SLOT_ORDER = TIME_SLOTS.map((s) => s.id)

// Mirrors the fixed room order the Unit 93 Excel export uses
// (`ROOM_ORDER` in services/timetable_excel_export.py) so the tutorial order
// letter shown on a scheduled card lines up with the letter the same
// session gets in the exported timetable. Any room outside this fixed set
// (there shouldn't be one in the real Campion room list) falls back to its
// position in the caller-supplied `rooms` list.
const EXPORT_ROOM_ORDER = [
  'PDS',
  'L1.05',
  'Bromley',
  'L1.08',
  'Dawson',
  'L1.10',
  'L1.12',
  'JTW',
]

function roomSortIndex(
  roomId: string,
  roomNameById: Map<string, string>,
  fallbackIndex: Map<string, number>
): number {
  const name = roomNameById.get(roomId)
  const fixedIndex = name ? EXPORT_ROOM_ORDER.indexOf(name) : -1
  if (fixedIndex !== -1) return fixedIndex
  return fallbackIndex.get(roomId) ?? EXPORT_ROOM_ORDER.length
}

/**
 * Assign display-only order letters (A, B, C…) per unit, for the
 * "UNITCODE Tutorial A (INITIALS)" / "UNITCODE Seminar A (INITIALS)" card
 * label. Ordering mirrors the Unit 93 export's `_tutorial_letters`: day
 * (Mon-Fri), start slot (s1-s7), room, then session id as the final
 * tie-breaker. Only sessions of the given type consume letters from a given
 * call, so tutorial and seminar letters (Unit 115/116) are independent A/B/C…
 * series that never share a counter — call once per type.
 */
function computeOrderLetters(
  assignments: ReadonlyArray<TimetableAssignment>,
  rooms: ReadonlyArray<{ id: string; name: string }>,
  sessionType: TimetableAssignment['session_type']
): Map<string, string> {
  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]))
  const fallbackIndex = new Map(rooms.map((r, i) => [r.id, i]))

  const byUnit = new Map<string, TimetableAssignment[]>()
  for (const a of assignments) {
    if (a.session_type !== sessionType) continue
    const list = byUnit.get(a.unit_id)
    if (list) list.push(a)
    else byUnit.set(a.unit_id, [a])
  }

  const letters = new Map<string, string>()
  for (const items of byUnit.values()) {
    const ordered = [...items].sort((x, y) => {
      const dayDiff = DAYS.indexOf(x.day) - DAYS.indexOf(y.day)
      if (dayDiff !== 0) return dayDiff
      const slotDiff = SLOT_ORDER.indexOf(x.start_slot) - SLOT_ORDER.indexOf(y.start_slot)
      if (slotDiff !== 0) return slotDiff
      const roomDiff =
        roomSortIndex(x.room_id, roomNameById, fallbackIndex) -
        roomSortIndex(y.room_id, roomNameById, fallbackIndex)
      if (roomDiff !== 0) return roomDiff
      return x.session_id.localeCompare(y.session_id)
    })
    ordered.forEach((a, index) => {
      letters.set(a.session_id, String.fromCharCode(65 + index))
    })
  }
  return letters
}

export function computeTutorialLetters(
  assignments: ReadonlyArray<TimetableAssignment>,
  rooms: ReadonlyArray<{ id: string; name: string }>
): Map<string, string> {
  return computeOrderLetters(assignments, rooms, 'tutorial')
}

export function computeSeminarLetters(
  assignments: ReadonlyArray<TimetableAssignment>,
  rooms: ReadonlyArray<{ id: string; name: string }>
): Map<string, string> {
  return computeOrderLetters(assignments, rooms, 'seminar')
}
