import { describe, expect, it } from 'vitest'
import {
  computeRectangleSelection,
  parseSelectionKey,
  selectionKey,
  singleCellSelection,
  type SelectionCell,
} from './blockSelection'
import { buildBlockedCellMap } from './blocks'
import { makeTimetableBlock } from '@/test/fixtures'

const rooms = [{ id: 'room-1' }, { id: 'room-2' }, { id: 'room-3' }]
const noBlocks = buildBlockedCellMap([])

function cell(day: SelectionCell['day'], slot: SelectionCell['slot'], roomId: string): SelectionCell {
  return { day, slot, roomId }
}

describe('selectionKey / parseSelectionKey', () => {
  it('round-trips a cell key (day:roomId:slot)', () => {
    const key = selectionKey('Monday', 'room-1', 's1')
    expect(key).toBe('Monday:room-1:s1')
    expect(parseSelectionKey(key)).toEqual({
      day: 'Monday',
      slot: 's1',
      room_id: 'room-1',
    })
  })
})

describe('singleCellSelection', () => {
  it('selects a free cell', () => {
    const set = singleCellSelection(cell('Monday', 's1', 'room-1'), noBlocks)
    expect([...set]).toEqual(['Monday:room-1:s1'])
  })

  it('refuses an already-blocked cell', () => {
    const blocks = buildBlockedCellMap([
      makeTimetableBlock({ cells: [{ id: 'c', day: 'Monday', slot: 's1', room_id: 'room-1' }] }),
    ])
    expect(singleCellSelection(cell('Monday', 's1', 'room-1'), blocks).size).toBe(0)
  })
})

describe('computeRectangleSelection', () => {
  it('selects a single cell when anchor equals target', () => {
    const set = computeRectangleSelection(
      cell('Monday', 's1', 'room-1'),
      cell('Monday', 's1', 'room-1'),
      rooms,
      noBlocks
    )
    expect([...set]).toEqual(['Monday:room-1:s1'])
  })

  it('builds a rectangle across slot rows and room columns (inclusive)', () => {
    const set = computeRectangleSelection(
      cell('Monday', 's1', 'room-1'),
      cell('Monday', 's2', 'room-2'),
      rooms,
      noBlocks
    )
    expect(set).toEqual(
      new Set([
        'Monday:room-1:s1',
        'Monday:room-2:s1',
        'Monday:room-1:s2',
        'Monday:room-2:s2',
      ])
    )
  })

  it('normalizes corner order (target before anchor)', () => {
    const forward = computeRectangleSelection(
      cell('Monday', 's1', 'room-1'),
      cell('Monday', 's3', 'room-3'),
      rooms,
      noBlocks
    )
    const reverse = computeRectangleSelection(
      cell('Monday', 's3', 'room-3'),
      cell('Monday', 's1', 'room-1'),
      rooms,
      noBlocks
    )
    expect(reverse).toEqual(forward)
    expect(forward.size).toBe(9) // 3 slots × 3 rooms
  })

  it('excludes already-blocked cells from the rectangle', () => {
    const blocks = buildBlockedCellMap([
      makeTimetableBlock({ cells: [{ id: 'c', day: 'Monday', slot: 's1', room_id: 'room-2' }] }),
    ])
    const set = computeRectangleSelection(
      cell('Monday', 's1', 'room-1'),
      cell('Monday', 's2', 'room-2'),
      rooms,
      blocks
    )
    expect(set.has('Monday:room-2:s1')).toBe(false)
    expect(set.size).toBe(3)
  })

  it('can span across the lunch divider (s3 → s4)', () => {
    const set = computeRectangleSelection(
      cell('Monday', 's3', 'room-1'),
      cell('Monday', 's4', 'room-1'),
      rooms,
      noBlocks
    )
    expect(set).toEqual(new Set(['Monday:room-1:s3', 'Monday:room-1:s4']))
  })

  it('falls back to the target cell when the two cells are on different days', () => {
    const set = computeRectangleSelection(
      cell('Monday', 's1', 'room-1'),
      cell('Tuesday', 's2', 'room-2'),
      rooms,
      noBlocks
    )
    expect([...set]).toEqual(['Tuesday:room-2:s2'])
  })
})
