import { describe, expect, it } from 'vitest'
import {
  EMPTY_ROOM_FILTERS,
  filterRooms,
  roomFiltersActive,
} from './filters'
import { makeRoom } from '@/test/fixtures'

const rooms = [
  makeRoom({ id: 'r1', name: 'Lecture Hall A', room_type: 'lecture' }),
  makeRoom({ id: 'r2', name: 'Tutorial Room 3', room_type: 'tutorial' }),
  makeRoom({ id: 'r3', name: 'Seminar Hall B', room_type: 'lecture' }),
]

describe('filterRooms', () => {
  it('returns all rooms with empty filters', () => {
    expect(filterRooms(rooms, EMPTY_ROOM_FILTERS)).toHaveLength(3)
  })

  it('searches by room name only, case-insensitively', () => {
    const result = filterRooms(rooms, { ...EMPTY_ROOM_FILTERS, search: 'hall' })
    expect(result.map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('does not match room type via the search box', () => {
    // "tutorial" is a room type, not part of room r1/r3 names — search is name-only.
    const result = filterRooms(rooms, { ...EMPTY_ROOM_FILTERS, search: 'tutorial' })
    expect(result.map((r) => r.id)).toEqual(['r2'])
  })

  it('filters by room type', () => {
    const result = filterRooms(rooms, { ...EMPTY_ROOM_FILTERS, roomType: 'lecture' })
    expect(result.map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('combines search and type filters', () => {
    const result = filterRooms(rooms, { search: 'hall', roomType: 'lecture' })
    expect(result.map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('reports active state only when a filter is set', () => {
    expect(roomFiltersActive(EMPTY_ROOM_FILTERS)).toBe(false)
    expect(roomFiltersActive({ ...EMPTY_ROOM_FILTERS, search: 'a' })).toBe(true)
    expect(roomFiltersActive({ ...EMPTY_ROOM_FILTERS, roomType: 'tutorial' })).toBe(true)
  })
})
