import { describe, expect, it } from 'vitest'
import { buildBlockAnchorData, buildBlockedCellMap, getBlockColorTokens } from './blocks'
import { makeTimetableBlock } from '@/test/fixtures'

describe('buildBlockedCellMap', () => {
  it('flattens block cells into a day:room_id:slot lookup', () => {
    const map = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        name: 'Chapel',
        colour: 'gold',
        cells: [
          { id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' },
          { id: 'c2', day: 'Monday', slot: 's2', room_id: 'room-1' },
        ],
      }),
    ])

    expect(map.size).toBe(2)
    const cell = map.get('Monday:room-1:s1')
    expect(cell).toMatchObject({
      blockId: 'b1',
      name: 'Chapel',
      colour: 'gold',
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
    })
    expect(map.get('Monday:room-1:s2')?.blockId).toBe('b1')
  })

  it('carries unnamed (no name / no colour) blocks', () => {
    const map = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b2',
        name: null,
        colour: null,
        cells: [{ id: 'c1', day: 'Tuesday', slot: 's4', room_id: 'room-2' }],
      }),
    ])
    const cell = map.get('Tuesday:room-2:s4')
    expect(cell?.name).toBeNull()
    expect(cell?.colour).toBeNull()
  })

  it('returns an empty map for no blocks', () => {
    expect(buildBlockedCellMap([]).size).toBe(0)
  })
})

describe('buildBlockAnchorData', () => {
  const rooms = [
    { id: 'r1' },
    { id: 'r2' },
    { id: 'r3' },
    { id: 'r4' },
  ]

  it('returns empty maps when blockedCells is empty', () => {
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(new Map(), rooms)
    expect(anchorSpanMap.size).toBe(0)
    expect(suppressSet.size).toBe(0)
  })

  it('produces no anchor entry for a single-room block (no merging needed)', () => {
    const blockedCells = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'r1' }],
      }),
    ])
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(blockedCells, rooms)
    expect(anchorSpanMap.size).toBe(0)
    expect(suppressSet.size).toBe(0)
  })

  it('merges a 3-room block into an anchor with span 3 and 2 suppressed cells', () => {
    const blockedCells = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        cells: [
          { id: 'c1', day: 'Monday', slot: 's1', room_id: 'r1' },
          { id: 'c2', day: 'Monday', slot: 's1', room_id: 'r2' },
          { id: 'c3', day: 'Monday', slot: 's1', room_id: 'r3' },
        ],
      }),
    ])
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(blockedCells, rooms)

    // r1 is the anchor with span 3
    expect(anchorSpanMap.get('Monday:r1:s1')).toBe(3)
    // r2 and r3 are suppressed
    expect(suppressSet.has('Monday:r2:s1')).toBe(true)
    expect(suppressSet.has('Monday:r3:s1')).toBe(true)
    // r1 is not suppressed
    expect(suppressSet.has('Monday:r1:s1')).toBe(false)
  })

  it('produces independent anchor entries per slot row for a multi-slot multi-room block', () => {
    // 2 rooms × 2 slots = each slot row gets its own anchor+suppress pair.
    const blockedCells = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        cells: [
          { id: 'c1', day: 'Tuesday', slot: 's2', room_id: 'r1' },
          { id: 'c2', day: 'Tuesday', slot: 's2', room_id: 'r2' },
          { id: 'c3', day: 'Tuesday', slot: 's3', room_id: 'r1' },
          { id: 'c4', day: 'Tuesday', slot: 's3', room_id: 'r2' },
        ],
      }),
    ])
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(blockedCells, rooms)

    expect(anchorSpanMap.get('Tuesday:r1:s2')).toBe(2)
    expect(anchorSpanMap.get('Tuesday:r1:s3')).toBe(2)
    expect(suppressSet.has('Tuesday:r2:s2')).toBe(true)
    expect(suppressSet.has('Tuesday:r2:s3')).toBe(true)
    expect(anchorSpanMap.size).toBe(2)
    expect(suppressSet.size).toBe(2)
  })

  it('handles two independent block groups in the same slot independently', () => {
    // b1 spans r1-r2, b2 spans r3-r4 at the same slot.
    const blockedCells = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        cells: [
          { id: 'c1', day: 'Wednesday', slot: 's4', room_id: 'r1' },
          { id: 'c2', day: 'Wednesday', slot: 's4', room_id: 'r2' },
        ],
      }),
      makeTimetableBlock({
        id: 'b2',
        cells: [
          { id: 'c3', day: 'Wednesday', slot: 's4', room_id: 'r3' },
          { id: 'c4', day: 'Wednesday', slot: 's4', room_id: 'r4' },
        ],
      }),
    ])
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(blockedCells, rooms)

    expect(anchorSpanMap.get('Wednesday:r1:s4')).toBe(2)
    expect(anchorSpanMap.get('Wednesday:r3:s4')).toBe(2)
    expect(suppressSet.has('Wednesday:r2:s4')).toBe(true)
    expect(suppressSet.has('Wednesday:r4:s4')).toBe(true)
  })

  it('skips rooms that are not present in the rooms list', () => {
    const blockedCells = buildBlockedCellMap([
      makeTimetableBlock({
        id: 'b1',
        cells: [
          { id: 'c1', day: 'Friday', slot: 's5', room_id: 'r1' },
          { id: 'c2', day: 'Friday', slot: 's5', room_id: 'unknown-room' },
        ],
      }),
    ])
    // Only r1 is in the rooms list; unknown-room is not.
    const { anchorSpanMap, suppressSet } = buildBlockAnchorData(blockedCells, [
      { id: 'r1' },
    ])
    // No merging since only 1 known room
    expect(anchorSpanMap.size).toBe(0)
    expect(suppressSet.size).toBe(0)
  })
})

describe('getBlockColorTokens', () => {
  it('maps each named colour to its dedicated --block-* tokens', () => {
    expect(getBlockColorTokens('gold')).toEqual({
      background: 'var(--block-gold-bg)',
      border: 'var(--block-gold-border)',
      text: 'var(--block-gold-text)',
    })
    expect(getBlockColorTokens('light_blue')).toEqual({
      background: 'var(--block-blue-bg)',
      border: 'var(--block-blue-border)',
      text: 'var(--block-blue-text)',
    })
    expect(getBlockColorTokens('light_pink')).toEqual({
      background: 'var(--block-pink-bg)',
      border: 'var(--block-pink-border)',
      text: 'var(--block-pink-text)',
    })
  })

  it('falls back to the grey empty set for a missing colour (unnamed block)', () => {
    expect(getBlockColorTokens(null)).toEqual({
      background: 'var(--block-empty-bg)',
      border: 'var(--block-empty-border)',
      text: 'var(--block-empty-text)',
    })
    expect(getBlockColorTokens(undefined)).toEqual(getBlockColorTokens(null))
  })

  it('falls back to grey for an unknown colour value', () => {
    expect(
      getBlockColorTokens('chartreuse' as unknown as 'gold')
    ).toEqual(getBlockColorTokens(null))
  })
})
