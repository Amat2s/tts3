import { describe, expect, it } from 'vitest'
import { buildBlockedCellMap, getBlockColorTokens } from './blocks'
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
