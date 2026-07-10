/**
 * Unit 79 / Unit 109: Frontend local timetable draft persistence.
 *
 * Persists the current unsaved timetable draft in browser storage so draft work
 * survives leaving `/timetable` or refreshing the browser. The stored draft is
 * schema-versioned, validated on restore, fingerprinted against the saved
 * backend state to avoid silently overriding unrelated changes, and cleared
 * after a successful save.
 *
 * As of Unit 109 the draft carries two layers of pending change — assignment
 * edits *and* block edits — so both round-trip through storage together and both
 * are fingerprinted against their saved backend counterparts. The schema version
 * is bumped to 2; any older (v1, assignment-only) stored draft is discarded
 * safely on load.
 *
 * This module owns *only* the unsaved draft. Server-owned query data is never
 * persisted here — that remains in TanStack Query (see architecture-context.md
 * invariants 3, 16 and code-standards "Do not store server-owned data").
 */
import type { TimetableAssignment } from './assignment'
import type { DraftBlock } from './draftBlocks'

const STORAGE_KEY = 'tts3.timetable.draft.v2'
const SCHEMA_VERSION = 2 as const

// Older, incompatible draft keys removed on load/clear so stale drafts never
// linger in browser storage after a schema bump.
const LEGACY_STORAGE_KEYS = ['tts3.timetable.draft.v1'] as const

const BLOCK_COLOURS = ['gold', 'light_blue', 'light_pink'] as const

export interface StoredTimetableDraft {
  schemaVersion: 2
  /** Fingerprint of the saved backend assignments this draft was built against. */
  savedAssignmentFingerprint: string
  /** Fingerprint of the saved backend blocks this draft was built against. */
  savedBlockFingerprint: string
  /** ISO timestamp of the last persisted draft mutation. */
  updatedAt: string
  assignments: TimetableAssignment[]
  blocks: DraftBlock[]
  // TODO(multi-admin): v1 is single-admin (architecture-context.md auth model).
  // If multiple admin accounts ever become possible, include the authenticated
  // user ID / workspace key here AND in STORAGE_KEY so a stored draft is never
  // reused across accounts. Do not implement multi-tenant behavior now.
}

export type LoadDraftResult =
  | { status: 'none' }
  | { status: 'restored'; draft: StoredTimetableDraft }
  | {
      status: 'discarded'
      reason: 'invalid' | 'schema-mismatch' | 'fingerprint-mismatch'
    }

/** Minimal shape required to fingerprint a placed/saved assignment. */
type FingerprintInput = {
  session_id: string
  day: string
  start_slot: string
  room_id: string
}

/**
 * Deterministic fingerprint of the saved assignment set. Order-independent so a
 * reordered-but-equivalent saved set produces the same value. Used to detect
 * when the saved backend timetable has changed underneath a stored draft.
 */
export function computeSavedAssignmentFingerprint(
  assignments: ReadonlyArray<FingerprintInput>
): string {
  return assignments
    .map((a) => `${a.session_id}:${a.day}:${a.start_slot}:${a.room_id}`)
    .sort()
    .join('|')
}

function getStorage(): Storage | null {
  try {
    // Accessing window.localStorage can throw (SSR, disabled storage, privacy mode).
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function removeLegacyKeys(storage: Storage): void {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      storage.removeItem(key)
    } catch {
      // Best-effort cleanup — nothing actionable if it fails.
    }
  }
}

function safeParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) }
  } catch {
    return { ok: false }
  }
}

function isValidAssignment(value: unknown): value is TimetableAssignment {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return (
    typeof a.session_id === 'string' &&
    typeof a.unit_id === 'string' &&
    typeof a.unit_code === 'string' &&
    typeof a.unit_name === 'string' &&
    typeof a.session_type === 'string' &&
    typeof a.duration === 'number' &&
    typeof a.lecturer_display_name === 'string' &&
    typeof a.student_count === 'number' &&
    Array.isArray(a.allocated_student_ids) &&
    a.allocated_student_ids.every((s) => typeof s === 'string') &&
    typeof a.day === 'string' &&
    typeof a.start_slot === 'string' &&
    typeof a.room_id === 'string'
  )
}

function isValidBlockCell(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const c = value as Record<string, unknown>
  return (
    typeof c.day === 'string' &&
    typeof c.slot === 'string' &&
    typeof c.room_id === 'string'
  )
}

function isValidDraftBlock(value: unknown): value is DraftBlock {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return (
    typeof b.id === 'string' &&
    typeof b.isNew === 'boolean' &&
    (b.name === null || typeof b.name === 'string') &&
    (b.colour === null ||
      (typeof b.colour === 'string' &&
        (BLOCK_COLOURS as ReadonlyArray<string>).includes(b.colour))) &&
    Array.isArray(b.cells) &&
    b.cells.every(isValidBlockCell)
  )
}

function isValidStoredDraft(value: unknown): value is StoredTimetableDraft {
  if (typeof value !== 'object' || value === null) return false
  const d = value as Record<string, unknown>
  return (
    d.schemaVersion === SCHEMA_VERSION &&
    typeof d.savedAssignmentFingerprint === 'string' &&
    typeof d.savedBlockFingerprint === 'string' &&
    typeof d.updatedAt === 'string' &&
    Array.isArray(d.assignments) &&
    d.assignments.every(isValidAssignment) &&
    Array.isArray(d.blocks) &&
    d.blocks.every(isValidDraftBlock)
  )
}

/**
 * Persist the current draft (assignment + block layers). Best-effort: storage
 * failures (quota, unavailable) are swallowed because draft persistence must
 * never break editing.
 */
export function saveStoredDraft(
  assignments: TimetableAssignment[],
  blocks: DraftBlock[],
  savedAssignmentFingerprint: string,
  savedBlockFingerprint: string
): void {
  const storage = getStorage()
  if (!storage) return
  const payload: StoredTimetableDraft = {
    schemaVersion: SCHEMA_VERSION,
    savedAssignmentFingerprint,
    savedBlockFingerprint,
    updatedAt: new Date().toISOString(),
    assignments,
    blocks,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage full or unavailable — persistence is best-effort.
  }
}

export function clearStoredDraft(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore — nothing actionable for the user.
  }
  removeLegacyKeys(storage)
}

/**
 * Attempt to load a stored draft for the given current saved-state fingerprints.
 * Restores only when the stored shape is valid, schema-current, and *both* its
 * assignment and block fingerprints match the live saved state. Any unsafe
 * stored draft (and any legacy-schema draft) is cleared and reported as
 * discarded so the caller can surface a message.
 */
export function loadStoredDraft(
  currentAssignmentFingerprint: string,
  currentBlockFingerprint: string
): LoadDraftResult {
  const storage = getStorage()
  if (!storage) return { status: 'none' }

  // Always sweep away legacy-schema drafts so a stale v1 draft can never be
  // silently reused after the v2 bump.
  removeLegacyKeys(storage)

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'none' }
  }
  if (raw === null) return { status: 'none' }

  const parsed = safeParse(raw)
  if (!parsed.ok) {
    clearStoredDraft()
    return { status: 'discarded', reason: 'invalid' }
  }

  if (!isValidStoredDraft(parsed.value)) {
    clearStoredDraft()
    const candidate = parsed.value as { schemaVersion?: unknown } | null
    if (
      typeof candidate === 'object' &&
      candidate !== null &&
      'schemaVersion' in candidate &&
      candidate.schemaVersion !== SCHEMA_VERSION
    ) {
      return { status: 'discarded', reason: 'schema-mismatch' }
    }
    return { status: 'discarded', reason: 'invalid' }
  }

  if (
    parsed.value.savedAssignmentFingerprint !== currentAssignmentFingerprint ||
    parsed.value.savedBlockFingerprint !== currentBlockFingerprint
  ) {
    clearStoredDraft()
    return { status: 'discarded', reason: 'fingerprint-mismatch' }
  }

  return { status: 'restored', draft: parsed.value }
}
