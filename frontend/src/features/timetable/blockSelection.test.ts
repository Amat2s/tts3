import { describe, expect, it } from 'vitest'
import {
  parseSelectionKey,
  selectionDay,
  selectionKey,
  toggleCellSelection,
  type SelectionCell,
} from './blockSelection'
import { buildBlockedCellMap } from './blocks'
import { makeTimetableBlock } from '@/test/fixtures'

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

describe('selectionDay', () => {
  it('returns null for an empty selection', () => {
    expect(selectionDay(new Set())).toBeNull()
  })

  it('returns the day shared by every key in the selection', () => {
    const set = new Set(['Monday:room-1:s1', 'Monday:room-2:s2'])
    expect(selectionDay(set)).toBe('Monday')
  })
})

describe('toggleCellSelection', () => {
  it('selects a free cell from an empty selection', () => {
    const next = toggleCellSelection(new Set(), cell('Monday', 's1', 'room-1'), noBlocks)
    expect([...next]).toEqual(['Monday:room-1:s1'])
  })

  it('deselects a cell that is already selected (click again to toggle off)', () => {
    const selected = new Set(['Monday:room-1:s1'])
    const next = toggleCellSelection(selected, cell('Monday', 's1', 'room-1'), noBlocks)
    expect(next.size).toBe(0)
  })

  it('adds a non-adjacent cell to an existing selection without requiring a rectangle', () => {
    const selected = new Set(['Monday:room-1:s1'])
    const next = toggleCellSelection(selected, cell('Monday', 's3', 'room-3'), noBlocks)
    expect(next).toEqual(new Set(['Monday:room-1:s1', 'Monday:room-3:s3']))
  })

  it('refuses an already-blocked cell, leaving the selection unchanged', () => {
    const blocks = buildBlockedCellMap([
      makeTimetableBlock({ cells: [{ id: 'c', day: 'Monday', slot: 's1', room_id: 'room-1' }] }),
    ])
    const selected = new Set(['Monday:room-2:s1'])
    const next = toggleCellSelection(selected, cell('Monday', 's1', 'room-1'), blocks)
    expect(next).toEqual(selected)
  })

  it('starts a fresh single-day selection when toggling a cell on a different day', () => {
    const selected = new Set(['Monday:room-1:s1', 'Monday:room-2:s2'])
    const next = toggleCellSelection(selected, cell('Tuesday', 's1', 'room-1'), noBlocks)
    expect([...next]).toEqual(['Tuesday:room-1:s1'])
  })
})
