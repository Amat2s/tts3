import type { Room, RoomType } from '@/lib/api/rooms'

/** Client-side room filter state. Frontend-only — never persisted (Unit 66). */
export interface RoomFilters {
  /** Matched case-insensitively against the room name only. */
  search: string
  /** `'all'` or a specific room type. */
  roomType: RoomType | 'all'
}

export const EMPTY_ROOM_FILTERS: RoomFilters = { search: '', roomType: 'all' }

export function roomFiltersActive(f: RoomFilters): boolean {
  return f.search.trim() !== '' || f.roomType !== 'all'
}

/** Pure filter over the loaded room list. Search applies to the name only. */
export function filterRooms(rooms: Room[], f: RoomFilters): Room[] {
  const q = f.search.trim().toLowerCase()
  return rooms.filter((room) => {
    if (f.roomType !== 'all' && room.room_type !== f.roomType) return false
    if (q !== '' && !room.name.toLowerCase().includes(q)) return false
    return true
  })
}
