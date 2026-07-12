/**
 * Unit 109: Timetable blocks folded into the unsaved draft.
 *
 * Block edits (create, rename/recolour, delete) are no longer pushed to the
 * backend the moment they happen. Instead they live inside the frontend draft
 * alongside assignment edits and are persisted together on the single Save
 * action. This module owns the draft-side representation of a block plus the
 * helpers that reconcile the draft against the saved backend blocks at save
 * time.
 */
import type {
  BlockCellInput,
  TimetableBlock,
  TimetableBlockColour,
} from '@/lib/api/timetableBlocks'

/**
 * A timetable block as it lives inside the unsaved draft. Existing saved blocks
 * keep their real server id; blocks created in the draft carry a synthetic
 * `new:<uuid>` id (and `isNew: true`) until Save persists them and the backend
 * assigns a real id.
 */
export interface DraftBlock {
  id: string
  isNew: boolean
  name: string | null
  colour: TimetableBlockColour | null
  cells: BlockCellInput[]
}

const NEW_BLOCK_PREFIX = 'new:'

/** Mint a client-only id for a block created inside the draft. */
export function makeNewBlockId(): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${NEW_BLOCK_PREFIX}${suffix}`
}

export function isNewBlockId(id: string): boolean {
  return id.startsWith(NEW_BLOCK_PREFIX)
}

/** Convert a saved backend block into its draft representation. */
export function savedBlockToDraft(block: TimetableBlock): DraftBlock {
  return {
    id: block.id,
    isNew: false,
    name: block.name,
    colour: block.colour,
    cells: block.cells.map((c) => ({
      day: c.day,
      slot: c.slot,
      room_id: c.room_id,
    })),
  }
}

export function savedBlocksToDraft(blocks: TimetableBlock[]): DraftBlock[] {
  return blocks.map(savedBlockToDraft)
}

/**
 * The set of block API operations needed to make the saved backend blocks match
 * the current draft blocks. Cells are never re-selected for an existing block in
 * the current UI, so an existing block only ever needs an update when its
 * name/colour changed; new draft blocks are created, and saved blocks missing
 * from the draft are deleted.
 */
export interface BlockDiff {
  creates: DraftBlock[]
  updates: DraftBlock[]
  deletes: string[]
}

function blockMetaChanged(draft: DraftBlock, saved: TimetableBlock): boolean {
  return draft.name !== saved.name || draft.colour !== saved.colour
}

export function computeBlockDiff(
  draftBlocks: DraftBlock[],
  savedBlocks: TimetableBlock[]
): BlockDiff {
  const savedById = new Map(savedBlocks.map((b) => [b.id, b]))
  const draftIds = new Set(draftBlocks.map((b) => b.id))

  const creates: DraftBlock[] = []
  const updates: DraftBlock[] = []

  for (const draft of draftBlocks) {
    if (draft.isNew) {
      creates.push(draft)
      continue
    }
    const saved = savedById.get(draft.id)
    if (!saved) {
      // An existing-id block whose saved counterpart has vanished underneath the
      // draft — recreate it defensively rather than silently dropping it.
      creates.push({ ...draft, isNew: true })
      continue
    }
    if (blockMetaChanged(draft, saved)) updates.push(draft)
  }

  const deletes = savedBlocks
    .filter((b) => !draftIds.has(b.id))
    .map((b) => b.id)

  return { creates, updates, deletes }
}

export function blockDiffIsEmpty(diff: BlockDiff): boolean {
  return (
    diff.creates.length === 0 &&
    diff.updates.length === 0 &&
    diff.deletes.length === 0
  )
}

/**
 * Deterministic, order-independent fingerprint of the saved block set. Used
 * (alongside the saved-assignment fingerprint) to detect when the saved backend
 * blocks have changed underneath a stored draft so a stale draft is discarded.
 */
export function computeSavedBlockFingerprint(
  blocks: ReadonlyArray<TimetableBlock>
): string {
  return blocks
    .map((b) => {
      const cells = b.cells
        .map((c) => `${c.day}:${c.slot}:${c.room_id}`)
        .sort()
        .join(',')
      return `${b.id}|${b.name ?? ''}|${b.colour ?? ''}|${cells}`
    })
    .sort()
    .join('||')
}
