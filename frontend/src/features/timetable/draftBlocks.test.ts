import { describe, expect, it } from 'vitest'
import {
  computeBlockDiff,
  computeSavedBlockFingerprint,
  blockDiffIsEmpty,
  isNewBlockId,
  makeNewBlockId,
  savedBlockToDraft,
  savedBlocksToDraft,
  type DraftBlock,
} from './draftBlocks'
import { makeTimetableBlock } from '@/test/fixtures'

describe('makeNewBlockId / isNewBlockId', () => {
  it('mints ids recognised as new and distinct from server ids', () => {
    const id = makeNewBlockId()
    expect(isNewBlockId(id)).toBe(true)
    expect(makeNewBlockId()).not.toBe(id)
    expect(isNewBlockId('block-1')).toBe(false)
  })
})

describe('savedBlockToDraft', () => {
  it('drops cell ids and marks the block as not new', () => {
    const saved = makeTimetableBlock({
      id: 'b1',
      name: 'Chapel',
      colour: 'gold',
      cells: [{ id: 'c1', day: 'Monday', slot: 's1', room_id: 'room-1' }],
    })
    expect(savedBlockToDraft(saved)).toEqual<DraftBlock>({
      id: 'b1',
      isNew: false,
      name: 'Chapel',
      colour: 'gold',
      cells: [{ day: 'Monday', slot: 's1', room_id: 'room-1' }],
    })
  })
})

describe('computeBlockDiff', () => {
  it('classifies new blocks as creates', () => {
    const draftBlocks: DraftBlock[] = [
      {
        id: 'new:1',
        isNew: true,
        name: 'Chapel',
        colour: 'gold',
        cells: [{ day: 'Monday', slot: 's1', room_id: 'room-1' }],
      },
    ]
    const diff = computeBlockDiff(draftBlocks, [])
    expect(diff.creates).toHaveLength(1)
    expect(diff.updates).toHaveLength(0)
    expect(diff.deletes).toHaveLength(0)
  })

  it('classifies a name/colour change on an existing block as an update', () => {
    const saved = makeTimetableBlock({ id: 'b1', name: 'Chapel', colour: 'gold' })
    const draftBlocks = savedBlocksToDraft([saved]).map((b) => ({
      ...b,
      name: 'Mass',
    }))
    const diff = computeBlockDiff(draftBlocks, [saved])
    expect(diff.creates).toHaveLength(0)
    expect(diff.updates).toEqual([expect.objectContaining({ id: 'b1', name: 'Mass' })])
    expect(diff.deletes).toHaveLength(0)
  })

  it('leaves an unchanged existing block out of the diff', () => {
    const saved = makeTimetableBlock({ id: 'b1', name: 'Chapel', colour: 'gold' })
    const diff = computeBlockDiff(savedBlocksToDraft([saved]), [saved])
    expect(blockDiffIsEmpty(diff)).toBe(true)
  })

  it('classifies a saved block missing from the draft as a delete', () => {
    const saved = makeTimetableBlock({ id: 'b1', name: 'Chapel', colour: 'gold' })
    const diff = computeBlockDiff([], [saved])
    expect(diff.deletes).toEqual(['b1'])
    expect(diff.creates).toHaveLength(0)
    expect(diff.updates).toHaveLength(0)
  })

  it('handles a mix of create, update, and delete in one diff', () => {
    const keep = makeTimetableBlock({ id: 'keep', name: 'A', colour: 'gold' })
    const rename = makeTimetableBlock({ id: 'rename', name: 'B', colour: 'gold' })
    const remove = makeTimetableBlock({ id: 'remove', name: 'C', colour: 'gold' })

    const draftBlocks: DraftBlock[] = [
      savedBlockToDraft(keep),
      { ...savedBlockToDraft(rename), colour: 'light_blue' },
      {
        id: 'new:x',
        isNew: true,
        name: null,
        colour: null,
        cells: [{ day: 'Friday', slot: 's7', room_id: 'room-1' }],
      },
    ]

    const diff = computeBlockDiff(draftBlocks, [keep, rename, remove])
    expect(diff.creates.map((c) => c.id)).toEqual(['new:x'])
    expect(diff.updates.map((u) => u.id)).toEqual(['rename'])
    expect(diff.deletes).toEqual(['remove'])
  })
})

describe('computeSavedBlockFingerprint', () => {
  it('is order-independent for equivalent block sets', () => {
    const a = makeTimetableBlock({ id: 'a', name: 'A', colour: 'gold' })
    const b = makeTimetableBlock({
      id: 'b',
      name: null,
      colour: null,
      cells: [{ id: 'c', day: 'Tuesday', slot: 's4', room_id: 'room-2' }],
    })
    expect(computeSavedBlockFingerprint([a, b])).toBe(
      computeSavedBlockFingerprint([b, a])
    )
  })

  it('changes when a block name/colour or cell changes', () => {
    const base = makeTimetableBlock({ id: 'a', name: 'A', colour: 'gold' })
    const renamed = makeTimetableBlock({ id: 'a', name: 'B', colour: 'gold' })
    expect(computeSavedBlockFingerprint([base])).not.toBe(
      computeSavedBlockFingerprint([renamed])
    )
  })

  it('produces a stable empty fingerprint for no blocks', () => {
    expect(computeSavedBlockFingerprint([])).toBe('')
  })
})
