import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppFrame } from '@/components/layout/AppFrame'
import { TimetableActionBar } from '@/features/timetable/TimetableActionBar'
import type { TransientNotice } from '@/features/timetable/TimetableActionBar'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { GridViewControls } from '@/features/timetable/GridViewControls'
import { useGridViewState } from '@/features/timetable/gridView'
import { UnscheduledPool } from '@/features/timetable/UnscheduledPool'
import { DragPreviewCard } from '@/features/timetable/DragPreviewCard'
import { pointerSlotCollision } from '@/features/timetable/dragCollision'
import { useSolverRun } from '@/features/timetable/useSolverRun'
import type { TimetableAssignment } from '@/features/timetable/assignment'
import {
  computeHoverHighlightKeys,
  type TimetableGridMetrics,
} from '@/features/timetable/hoverHighlight'
import {
  clearStoredDraft,
  computeSavedAssignmentFingerprint,
  loadStoredDraft,
  saveStoredDraft,
} from '@/features/timetable/draftStorage'
import {
  type AssignmentResponse,
  listAssignments,
  saveAssignments,
} from '@/lib/api/assignments'
import { listLecturers } from '@/lib/api/lecturers'
import { listRooms } from '@/lib/api/rooms'
import { listUnits } from '@/lib/api/units'
import {
  type SchedulableSession,
  listSchedulableSessions,
} from '@/lib/api/sessions'
import {
  type BlockCellInput,
  type TimetableBlock,
  type TimetableBlockColour,
  createTimetableBlock,
  deleteTimetableBlock,
  listTimetableBlocks,
  updateTimetableBlock,
} from '@/lib/api/timetableBlocks'
import { buildBlockedCellMap } from '@/features/timetable/blocks'
import {
  type SelectionCell,
  computeRectangleSelection,
  parseSelectionKey,
  singleCellSelection,
} from '@/features/timetable/blockSelection'
import { BlockEditDialog } from '@/features/timetable/BlockEditDialog'
import { BlockCreateDialog } from '@/features/timetable/BlockCreateDialog'
import { TimetableDownloadDialog } from '@/features/timetable/TimetableDownloadDialog'
import {
  exportSavedTimetableExcel,
  fallbackExportFilename,
  triggerBlobDownload,
} from '@/lib/api/timetableExport'
import {
  checkDraftForBlockingViolations,
  checkProposedPlacement,
  getBlockingViolatorIds,
} from '@/lib/validation/blocking'
import { checkDraftForWarnings } from '@/lib/validation/warning'
import { getErrorMessage } from '@/lib/errors'

function toTimetableAssignment(r: AssignmentResponse): TimetableAssignment {
  return {
    assignment_id: r.assignment_id,
    session_id: r.session_id,
    unit_id: r.unit_id,
    unit_code: r.unit_code,
    unit_name: r.unit_name,
    session_type: r.session_type,
    duration: r.duration,
    lecturer_display_name: r.lecturer_display_name,
    lecturer_id: r.lecturer_id ?? undefined,
    student_count: r.student_count,
    // Allocation-derived validation payload (Unit 60/67).
    allocated_student_ids: r.allocated_student_ids,
    day: r.day,
    start_slot: r.start_slot,
    room_id: r.room_id,
  }
}

// Pointer-align modifier: centers the overlay width-wise on the cursor and
// positions the cursor at the center of the first slot vertically.
// Works for both unscheduled-pool drags and scheduled-card moves.
function createPointerAlignModifier(metrics: TimetableGridMetrics | null) {
  return function pointerAlignModifier({
    activatorEvent,
    draggingNodeRect,
    overlayNodeRect,
    transform,
  }: {
    activatorEvent: Event | null
    draggingNodeRect: { left: number; top: number; width: number; height: number } | null
    overlayNodeRect: { width: number; height: number } | null
    transform: { x: number; y: number; scaleX: number; scaleY: number }
  }) {
    if (!activatorEvent || !draggingNodeRect) return transform
    const event = activatorEvent as PointerEvent
    if (!('clientX' in event)) return transform

    // Where the pointer was within the original draggable at drag-start
    const offsetX = event.clientX - draggingNodeRect.left
    const offsetY = event.clientY - draggingNodeRect.top

    // Target pointer position within the overlay:
    // - horizontal center of the overlay
    // - vertical center of the first slot only (rowHeight / 2)
    const overlayWidth = overlayNodeRect?.width ?? (metrics?.cellWidth ?? 200)
    const rowH = metrics?.rowHeight ?? 56

    return {
      ...transform,
      x: transform.x + offsetX - overlayWidth / 2,
      y: transform.y + offsetY - rowH / 2,
    }
  }
}

export default function TimetablePage() {
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const {
    data: rooms,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
  })

  const {
    data: schedulableSessions,
    isLoading: sessionsLoading,
    isError: sessionsIsError,
    error: sessionsError,
  } = useQuery({
    queryKey: ['schedulable-sessions'],
    queryFn: listSchedulableSessions,
  })

  const {
    data: savedAssignments,
    isError: assignmentsIsError,
    error: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ['assignments'],
    queryFn: listAssignments,
  })

  const { data: lecturers } = useQuery({
    queryKey: ['lecturers'],
    queryFn: listLecturers,
  })

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: listUnits,
  })

  const {
    data: blocks,
    isError: blocksIsError,
    error: blocksError,
    refetch: refetchBlocks,
  } = useQuery({
    queryKey: ['timetable-blocks'],
    queryFn: listTimetableBlocks,
  })

  // View-only grid controls (day filter + extend/scroll), shared with /preferences.
  const gridView = useGridViewState()

  const [draft, setDraft] = useState<TimetableAssignment[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  // The droppable ID currently hovered by the active drag ("day:roomId:slotId").
  const [activeHoverKey, setActiveHoverKey] = useState<string | null>(null)
  // Measured grid cell dimensions for the drag preview and pointer modifier.
  const [gridMetrics, setGridMetrics] = useState<TimetableGridMetrics | null>(null)
  // One-time notice when a locally persisted draft is restored or discarded.
  const [draftNotice, setDraftNotice] = useState<'restored' | 'discarded' | null>(
    null
  )
  // Existing-block edit/delete (Unit 85).
  const [editingBlock, setEditingBlock] = useState<TimetableBlock | null>(null)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockMutationError, setBlockMutationError] = useState<string | null>(null)
  // Block-selection mode (Unit 86): anchor + the selected cell keys, plus the
  // create dialog state.
  const [blockMode, setBlockMode] = useState(false)
  const [blockAnchor, setBlockAnchor] = useState<SelectionCell | null>(null)
  const [blockSelectionKeys, setBlockSelectionKeys] = useState<Set<string>>(
    new Set()
  )
  const [blockCreateOpen, setBlockCreateOpen] = useState(false)
  const [blockCreateError, setBlockCreateError] = useState<string | null>(null)
  // Timetable Excel download (Unit 94).
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  // Consolidated one-time transient notice shared by block edit/delete/create
  // and the timetable download (Unit 106). Setting a new notice replaces the
  // previous one, so stale notices never pile up behind newer ones.
  const [notice, setNotice] = useState<TransientNotice | null>(null)

  // Keep a ref of the latest draft so data-change effects can read it without
  // adding draft to their dependency arrays (which would cause validation loops).
  const draftRef = useRef<TimetableAssignment[]>([])
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  // Restore happens exactly once, after saved assignments first load. Subsequent
  // saved-assignment refetches (after a save or solver run) must never resurrect
  // an old stored draft.
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (savedAssignments === undefined) return

    const savedDraftList = savedAssignments.map(toTimetableAssignment)

    if (!hydratedRef.current) {
      hydratedRef.current = true
      const fingerprint = computeSavedAssignmentFingerprint(savedAssignments)
      const result = loadStoredDraft(fingerprint)

      if (result.status === 'restored') {
        // Restore the unsaved draft; it is dirty by definition and must flow
        // through the existing blocking-cleanup and warning derivation paths.
        setDraft(result.draft.assignments)
        setIsDirty(true)
        setSaveError(null)
        setBlockingError(null)
        setPendingSessionId(null)
        setDraftNotice('restored')
        return
      }

      if (result.status === 'discarded') {
        setDraftNotice('discarded')
      }
      // 'none' and 'discarded' both initialize from saved backend state below.
      setDraft(savedDraftList)
      setIsDirty(false)
      setSaveError(null)
      setBlockingError(null)
      setPendingSessionId(null)
      return
    }

    // Subsequent saved-assignment refetches (after a save or solver run):
    // re-init from saved state, clear any stale restore notice, never resurrect.
    setDraft(savedDraftList)
    setIsDirty(false)
    setSaveError(null)
    setBlockingError(null)
    setPendingSessionId(null)
    setDraftNotice(null)
  }, [savedAssignments])

  // Persist the draft whenever it is dirty; clear storage once it is clean again
  // (e.g. after a successful save). Gated on hydration so the initial load never
  // wipes a draft before the restore attempt has run.
  useEffect(() => {
    if (!hydratedRef.current || savedAssignments === undefined) return
    if (isDirty) {
      saveStoredDraft(draft, computeSavedAssignmentFingerprint(savedAssignments))
    } else {
      clearStoredDraft()
    }
  }, [draft, isDirty, savedAssignments])

  // Flatten block groups into a `day:roomId:slot` lookup for rendering and the
  // `timetable_slot_blocked` validation rule. Only build the map when blocks
  // data is actually available to prevent silent bypass of validation.
  const blockedCellMap = useMemo(
    () => (blocks ? buildBlockedCellMap(blocks) : undefined),
    [blocks]
  )

  // Auto-unschedule any draft assignments that now violate blocking rules after
  // room, session, or block data changes (e.g. room capacity reduced, student
  // count increased, or a new/loaded block now overlaps a draft assignment).
  // Depends on `draft` as well so a freshly restored draft that overlaps a block
  // is cleaned up immediately, not only on a later data change. The cleanup is
  // idempotent and terminating: removing violators changes `draft`, the effect
  // re-runs, finds none, and stops.
  useEffect(() => {
    const currentDraft = draftRef.current
    if (!rooms || currentDraft.length === 0) return

    const sessionCountMap = schedulableSessions
      ? new Map(schedulableSessions.map((s) => [s.session_id, s.student_count]))
      : null

    const validationDraft = sessionCountMap
      ? currentDraft.map((a) => {
          const count = sessionCountMap.get(a.session_id)
          return count !== undefined ? { ...a, student_count: count } : a
        })
      : currentDraft

    const violators = getBlockingViolatorIds(validationDraft, rooms, blockedCellMap)
    if (violators.size > 0) {
      setDraft((prev) => prev.filter((a) => !violators.has(a.session_id)))
      setIsDirty(true)
    }
  }, [rooms, schedulableSessions, blockedCellMap, draft])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAssignments({
        assignments: draft.map((a) => ({
          session_id: a.session_id,
          day: a.day,
          start_slot: a.start_slot,
          room_id: a.room_id,
        })),
      }),
    onSuccess: () => {
      // Settle the Save button immediately: mark the draft clean and drop any
      // prior save error so the button returns to its idle "Saved" state without
      // waiting on the assignments refetch below (Unit 106). The refetch then
      // re-initialises the draft from the persisted state as usual.
      setIsDirty(false)
      setSaveError(null)
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
    onError: (err: unknown) => {
      setSaveError(
        getErrorMessage(
          err,
          'Your timetable changes were not saved. Please try again.'
        )
      )
    },
    // The busy/disabled state is driven purely by the mutation lifecycle
    // (`isPending`), so it always clears on both success and error — the button
    // can never get stuck spinning after a settled save (Unit 106).
  })

  const updateBlockMutation = useMutation({
    mutationFn: (input: {
      blockId: string
      name: string | null
      colour: TimetableBlockColour | null
      cells: TimetableBlock['cells']
    }) =>
      updateTimetableBlock(input.blockId, {
        name: input.name,
        colour: input.colour,
        // Cell re-selection is not offered in this unit; preserve saved cells.
        cells: input.cells.map((c) => ({
          day: c.day,
          slot: c.slot,
          room_id: c.room_id,
        })),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-blocks'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      setBlockDialogOpen(false)
      setEditingBlock(null)
      surfaceUnscheduledNotice(result.unscheduled_session_ids.length)
    },
    onError: (err: unknown) => {
      setBlockMutationError(
        getErrorMessage(err, 'The block could not be updated. Please try again.')
      )
    },
  })

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteTimetableBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-blocks'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      setBlockDialogOpen(false)
      setEditingBlock(null)
    },
    onError: (err: unknown) => {
      setBlockMutationError(
        getErrorMessage(err, 'The block could not be deleted. Please try again.')
      )
    },
  })

  const createBlockMutation = useMutation({
    mutationFn: (input: {
      name: string | null
      colour: TimetableBlockColour | null
      cells: BlockCellInput[]
    }) =>
      createTimetableBlock({
        name: input.name,
        colour: input.colour,
        cells: input.cells,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['timetable-blocks'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      // Exit block mode and clear the selection on success.
      exitBlockMode()
      setBlockCreateOpen(false)
      surfaceBlockCreatedNotice(result.unscheduled_session_ids.length)
    },
    onError: (err: unknown) => {
      setBlockCreateError(
        getErrorMessage(err, 'The block could not be created. Please try again.')
      )
    },
  })

  // Export the SAVED timetable as Excel. The backend renders the workbook; we
  // only trigger the browser download from the returned blob, preferring the
  // backend `Content-Disposition` filename and falling back to a dated slug.
  const exportMutation = useMutation({
    mutationFn: (title: string) => exportSavedTimetableExcel({ title }),
    onSuccess: (result) => {
      const filename = result.filename ?? fallbackExportFilename()
      triggerBlobDownload(result.blob, filename)
      setDownloadDialogOpen(false)
      setExportError(null)
      setNotice({ text: 'Timetable downloaded.', tone: 'success' })
    },
    onError: (err: unknown) => {
      // Keep the dialog open and surface a readable message inside it.
      setExportError(
        getErrorMessage(
          err,
          'The timetable could not be downloaded. Please try again.'
        )
      )
    },
  })

  function surfaceUnscheduledNotice(count: number) {
    if (count > 0) {
      setNotice({
        text: `Block saved — ${count} overlapping session${count !== 1 ? 's were' : ' was'} returned to the unscheduled pool.`,
        tone: 'info',
      })
    }
  }

  function surfaceBlockCreatedNotice(count: number) {
    setNotice(
      count > 0
        ? {
            text: `Block created — ${count} overlapping session${count !== 1 ? 's were' : ' was'} returned to the unscheduled pool.`,
            tone: 'info',
          }
        : { text: 'Block created.', tone: 'success' }
    )
  }

  function handleBlockClick(blockId: string) {
    if (blockEditingDisabled) return
    const block = blocks?.find((b) => b.id === blockId)
    if (!block) return
    setBlockMutationError(null)
    setNotice(null)
    setEditingBlock(block)
    setBlockDialogOpen(true)
  }

  // --- Block-selection mode (Unit 86) ----------------------------------------

  function exitBlockMode() {
    setBlockMode(false)
    setBlockAnchor(null)
    setBlockSelectionKeys(new Set())
    setBlockCreateError(null)
  }

  function handleStartBlockMode() {
    if (!canAddBlock) return
    // Starting block mode disables normal placement and clears any pending
    // session selection so the two interaction modes never overlap.
    setPendingSessionId(null)
    setBlockingError(null)
    setNotice(null)
    setBlockAnchor(null)
    setBlockSelectionKeys(new Set())
    setBlockCreateError(null)
    setBlockMode(true)
  }

  function handleCancelBlockMode() {
    exitBlockMode()
  }

  function handleBlockCellSelect(day: string, slotId: string, roomId: string) {
    if (!blockMode || !blockedCellMap) return
    const cell: SelectionCell = {
      day: day as SelectionCell['day'],
      slot: slotId as SelectionCell['slot'],
      roomId,
    }

    // No anchor yet: this click sets the anchor (single-cell selection).
    if (!blockAnchor) {
      const single = singleCellSelection(cell, blockedCellMap)
      if (single.size === 0) return // anchor landed on an already-blocked cell
      setBlockAnchor(cell)
      setBlockSelectionKeys(single)
      return
    }

    // Clicking a different day re-anchors there.
    if (blockAnchor.day !== cell.day) {
      const single = singleCellSelection(cell, blockedCellMap)
      if (single.size === 0) return
      setBlockAnchor(cell)
      setBlockSelectionKeys(single)
      return
    }

    // Same day: extend the rectangle from the anchor to this cell.
    setBlockSelectionKeys(
      computeRectangleSelection(blockAnchor, cell, rooms ?? [], blockedCellMap)
    )
  }

  function handleOpenCreateBlock() {
    if (blockSelectionKeys.size === 0) return
    setBlockCreateError(null)
    setBlockCreateOpen(true)
  }

  function handleCreateBlock(input: {
    name: string | null
    colour: TimetableBlockColour | null
  }) {
    if (blockSelectionKeys.size === 0) return
    setBlockCreateError(null)
    createBlockMutation.mutate({
      name: input.name,
      colour: input.colour,
      cells: [...blockSelectionKeys].map(parseSelectionKey),
    })
  }

  // Selected cells parsed into persistable cell inputs, for the create dialog
  // summary (day/time/room).
  const blockSelectionCells: BlockCellInput[] = [...blockSelectionKeys].map(
    parseSelectionKey
  )

  // Async solver run lifecycle. The solver runs against the *saved* timetable
  // state; on success we refetch saved assignments + the schedulable pool, which
  // resets the draft from the latest saved data (savedAssignments effect above).
  // A failed run leaves saved state untouched, so nothing is refetched.
  const solver = useSolverRun({
    onSucceeded: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
    },
  })

  // Editing and saving are locked while a run is starting or active.
  const editingDisabled = solver.isStarting || solver.isActive

  // Block edit/delete persists immediately and is independent of the timetable
  // draft Save. Because it mutates saved state, it is disabled while the draft is
  // dirty (the admin must save or clear timetable changes first) or mid-solver.
  const blockEditingDisabled = isDirty || editingDisabled

  // "Add block" gating (Unit 86). Block creation persists immediately, so it is
  // disabled while the draft is dirty, mid-solver, before data is ready, when
  // blocks failed to load, or when there are no rooms to block.
  const addBlockDisabledReason: string | null = (() => {
    if (editingDisabled) return 'A solver run is in progress.'
    if (blocksIsError) return 'Timetable blocks could not be loaded.'
    if (rooms === undefined || blocks === undefined)
      return 'Timetable data is still loading.'
    if (rooms.length === 0) return 'Add at least one room before blocking slots.'
    if (isDirty) return 'Save or discard timetable changes before editing blocked slots.'
    return null
  })()
  const canAddBlock = addBlockDisabledReason === null

  // Timetable Excel download gating (Unit 94). The export represents the SAVED
  // timetable, so it is blocked whenever the saved data is unsafe to export:
  // a dirty draft, a save in flight, a solver run, still-loading or failed saved
  // assignments / rooms / blocks, or an export already running. It deliberately
  // stays enabled for unscheduled sessions, warning-invalid saved assignments,
  // and otherwise-partial saved timetables.
  const downloadDisabledReason: string | null = (() => {
    if (isDirty) return 'Save timetable changes before downloading.'
    if (saveMutation.isPending) return 'Saving timetable changes…'
    if (editingDisabled) return 'A solver run is in progress.'
    if (isError) return 'Rooms could not be loaded.'
    if (assignmentsIsError) return 'Saved timetable data could not be loaded.'
    if (blocksIsError) return 'Timetable blocks could not be loaded.'
    if (savedAssignments === undefined)
      return 'Saved timetable data is still loading.'
    if (exportMutation.isPending) return 'A download is already in progress.'
    return null
  })()
  const canDownload = downloadDisabledReason === null

  function handleOpenDownload() {
    if (!canDownload) return
    setExportError(null)
    setNotice(null)
    setDownloadDialogOpen(true)
  }

  function handleDownload(title: string) {
    const trimmed = title.trim()
    if (!trimmed || exportMutation.isPending) return
    setExportError(null)
    exportMutation.mutate(trimmed)
  }

  // Sessions not currently placed in the draft.
  const scheduledIds = new Set(draft.map((a) => a.session_id))
  const unscheduledSessions = schedulableSessions?.filter(
    (s) => !scheduledIds.has(s.session_id)
  ) ?? []

  const warningIssues = checkDraftForWarnings(draft, lecturers)
  const warningSessionIds = new Set(
    warningIssues.flatMap((i) => i.affected_session_ids)
  )
  const blockingViolations = rooms
    ? checkDraftForBlockingViolations(draft, rooms, blockedCellMap)
    : []

  // Solver start gating. The solver button is enabled only when there is nothing
  // blocking a run; the reason is surfaced to the admin when it is disabled.
  const hasRooms = !!rooms && rooms.length > 0
  const requiredDataReady =
    rooms !== undefined &&
    schedulableSessions !== undefined &&
    savedAssignments !== undefined

  const solverDisabledReason: string | null = (() => {
    if (editingDisabled) return 'A solver run is in progress.'
    if (!hasRooms) return 'Add at least one room before running the solver.'
    if (!requiredDataReady) return 'Timetable data is still loading.'
    if (blockingViolations.length > 0 || warningIssues.length > 0) {
      const parts: string[] = []
      if (blockingViolations.length > 0) {
        parts.push(
          `${blockingViolations.length} blocking violation${blockingViolations.length !== 1 ? 's' : ''}`
        )
      }
      if (warningIssues.length > 0) {
        parts.push(
          `${warningIssues.length} scheduling warning${warningIssues.length !== 1 ? 's' : ''}`
        )
      }
      return `${parts.join(' and ')} must be resolved before running the solver`
    }
    // Solver runs from saved state, so unsaved draft changes must be saved first.
    if (isDirty) return 'Save your timetable changes before running the solver.'
    return null
  })()
  const canRunSolver = solverDisabledReason === null

  // The session being actively dragged (for DragOverlay preview).
  const activeSession: SchedulableSession | null = activeSessionId
    ? (schedulableSessions?.find((s) => s.session_id === activeSessionId) ?? null)
    : null

  // Highlighted cell keys for the current valid drag hover proposal.
  const hoverHighlightKeys = useMemo(
    () =>
      computeHoverHighlightKeys(
        activeHoverKey,
        activeSessionId,
        schedulableSessions ?? [],
        draft,
        rooms ?? [],
        blockedCellMap
      ),
    [activeHoverKey, activeSessionId, schedulableSessions, draft, rooms, blockedCellMap]
  )

  // Stable metrics change handler — avoids causing the measurement effect to
  // re-fire on every render by keeping the same function reference.
  const handleMetricsChange = useCallback((metrics: TimetableGridMetrics) => {
    setGridMetrics(metrics)
  }, [])

  // Pointer-align modifier for DragOverlay — recreated only when metrics change.
  const pointerAlignModifier = useMemo(
    () => createPointerAlignModifier(gridMetrics),
    [gridMetrics]
  )

  function handleSelectSession(sessionId: string) {
    if (editingDisabled || blockMode) return
    setBlockingError(null)
    setPendingSessionId((prev) => (prev === sessionId ? null : sessionId))
  }

  function handleCellClick(day: string, slotId: string, roomId: string) {
    // Normal session placement is disabled while in block-selection mode.
    if (blockMode) return
    // Block placement when the saved baseline could not be loaded — otherwise the
    // user could save a draft on top of an unknown saved timetable.
    if (editingDisabled || assignmentsIsError) return
    if (!pendingSessionId) return
    const session = schedulableSessions?.find(
      (s) => s.session_id === pendingSessionId
    )
    if (!session) return

    const proposed: TimetableAssignment = {
      session_id: session.session_id,
      unit_id: session.unit_id,
      unit_code: session.unit_code,
      unit_name: session.unit_name,
      session_type: session.session_type,
      duration: session.duration,
      lecturer_id: session.lecturer_id,
      lecturer_display_name: session.lecturer_display_name,
      student_count: session.student_count,
      allocated_student_ids: session.allocated_student_ids,
      unit_year_level: session.unit_year_level,
      day: day as TimetableAssignment['day'],
      start_slot: slotId as TimetableAssignment['start_slot'],
      room_id: roomId,
    }

    const issues = checkProposedPlacement(proposed, draft, rooms ?? [], blockedCellMap)
    if (issues.length > 0) {
      setBlockingError(issues[0].message)
      return
    }

    const withoutOld = draft.filter((a) => a.session_id !== pendingSessionId)
    setBlockingError(null)
    setDraft([...withoutOld, proposed])
    setIsDirty(true)
    setPendingSessionId(null)
  }

  function handleUnschedule(sessionId: string) {
    if (editingDisabled) return
    setBlockingError(null)
    setDraft((prev) => prev.filter((a) => a.session_id !== sessionId))
    setIsDirty(true)
    setPendingSessionId((prev) => (prev === sessionId ? null : prev))
  }

  function handleClearAll() {
    if (editingDisabled || draft.length === 0) return
    setDraft([])
    setIsDirty(true)
    setPendingSessionId(null)
    setBlockingError(null)
  }

  function handleSave() {
    if (editingDisabled) return
    // A new save supersedes any lingering one-time notice (Unit 106).
    setNotice(null)
    setSaveError(null)
    saveMutation.mutate()
  }

  function handleRunSolver() {
    if (!canRunSolver) return
    // A new solver run supersedes any lingering one-time notice (Unit 106).
    setNotice(null)
    solver.start()
  }

  function handleDragStart(event: DragStartEvent) {
    if (editingDisabled || blockMode) return
    const sessionId = event.active.id as string
    setActiveSessionId(sessionId)
    setActiveHoverKey(null)
    // Cancel any pending click-based selection when drag starts.
    setPendingSessionId(null)
    setBlockingError(null)
  }

  function handleDragOver(event: DragOverEvent) {
    setActiveHoverKey(event.over ? (event.over.id as string) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSessionId(null)
    setActiveHoverKey(null)
    // Block placement when the saved baseline could not be loaded (see handleCellClick).
    if (assignmentsIsError) return
    const { active, over } = event
    if (!over) return

    const sessionId = active.id as string
    // Droppable ID format: "${day}:${roomId}:${slotId}" (matches buildAssignmentMap key)
    const parts = (over.id as string).split(':')
    if (parts.length < 3) return
    // day can be a single word, roomId is a UUID (no colons), slotId is "s1"–"s7"
    const [day, roomId, slotId] = parts

    const session = schedulableSessions?.find((s) => s.session_id === sessionId)
    if (!session) return

    const proposed: TimetableAssignment = {
      session_id: session.session_id,
      unit_id: session.unit_id,
      unit_code: session.unit_code,
      unit_name: session.unit_name,
      session_type: session.session_type,
      duration: session.duration,
      lecturer_id: session.lecturer_id,
      lecturer_display_name: session.lecturer_display_name,
      student_count: session.student_count,
      allocated_student_ids: session.allocated_student_ids,
      unit_year_level: session.unit_year_level,
      day: day as TimetableAssignment['day'],
      start_slot: slotId as TimetableAssignment['start_slot'],
      room_id: roomId,
    }

    const issues = checkProposedPlacement(proposed, draft, rooms ?? [], blockedCellMap)
    if (issues.length > 0) {
      setBlockingError(issues[0].message)
      return
    }

    // Remove any existing placement for this session (handles moves), then place.
    const withoutOld = draft.filter((a) => a.session_id !== sessionId)
    setBlockingError(null)
    setDraft([...withoutOld, proposed])
    setIsDirty(true)
  }

  function handleDragCancel() {
    setActiveSessionId(null)
    setActiveHoverKey(null)
  }

  function renderCanvas() {
    if (isLoading) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading rooms…
          </p>
        </div>
      )
    }

    if (isError) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--state-error)' }}>
            {(error as Error)?.message ?? 'Failed to load rooms.'}
          </p>
        </div>
      )
    }

    if (!rooms || rooms.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <CalendarDays
            className="h-8 w-8"
            style={{ color: 'var(--text-muted)' }}
          />
          <div className="text-center">
            <p
              className="text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              No rooms available
            </p>
            <p
              className="text-sm max-w-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              The timetable canvas requires at least one room.{' '}
              <Link
                to="/rooms"
                className="underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                Create rooms
              </Link>{' '}
              before scheduling sessions.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <GridViewControls
            extended={gridView.extended}
            onToggleExtended={gridView.toggleExtended}
            visibleDays={gridView.visibleDays}
            onToggleDay={gridView.toggleDay}
          />
        </div>
        <TimetableGrid
          rooms={rooms}
          assignments={draft}
          blockedCells={blockedCellMap}
          isBlockInteractive={!blockEditingDisabled && !blockMode}
          onBlockClick={handleBlockClick}
          pendingSessionId={pendingSessionId}
          warningSessionIds={warningSessionIds}
          editingDisabled={editingDisabled}
          hoverHighlightKeys={hoverHighlightKeys}
          blockSelectionMode={blockMode}
          blockSelectionKeys={blockSelectionKeys}
          onBlockCellSelect={handleBlockCellSelect}
          onCellClick={handleCellClick}
          onUnschedule={handleUnschedule}
          onMoveSelect={handleSelectSession}
          onMetricsChange={handleMetricsChange}
          visibleDays={gridView.visibleDays}
          extended={gridView.extended}
        />
        <UnscheduledPool
          sessions={unscheduledSessions}
          units={units}
          totalSchedulableCount={schedulableSessions?.length}
          isLoading={sessionsLoading}
          isError={sessionsIsError}
          error={sessionsError as Error | null}
          pendingSessionId={pendingSessionId}
          editingDisabled={editingDisabled}
          onSelectSession={handleSelectSession}
        />
      </div>
    )
  }

  return (
    <AppFrame>
      {/* Visible page header/description intentionally removed (Unit 81); the
          sticky action bar is the first major element below the navbar. An
          sr-only heading preserves the page landmark for assistive tech. */}
      <h1 className="sr-only">Timetable</h1>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerSlotCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-col gap-4">
          <TimetableActionBar
            isDirty={isDirty}
            isSaving={saveMutation.isPending}
            hasDraftAssignments={draft.length > 0}
            saveError={saveError}
            blockingError={blockingError}
            violationMessages={blockingViolations.map((v) => v.message)}
            warningMessages={warningIssues.map((i) => i.message)}
            canRunSolver={canRunSolver}
            solverDisabledReason={solverDisabledReason}
            editingDisabled={editingDisabled}
            onClearAll={handleClearAll}
            onSave={handleSave}
            onRunSolver={handleRunSolver}
            isPendingPlacement={!!pendingSessionId}
            blockMode={blockMode}
            canAddBlock={canAddBlock}
            addBlockDisabledReason={addBlockDisabledReason}
            hasBlockSelection={blockSelectionKeys.size > 0}
            onStartBlockMode={handleStartBlockMode}
            onCancelBlockMode={handleCancelBlockMode}
            onCreateBlock={handleOpenCreateBlock}
            canDownload={canDownload}
            downloadDisabledReason={downloadDisabledReason}
            isExporting={exportMutation.isPending}
            onDownloadTimetable={handleOpenDownload}
            solverRunStatus={solver.runStatus}
            isSolverStarting={solver.isStarting}
            solverStartError={solver.startError}
            solverStatusError={solver.statusError}
            onDismissSolver={solver.dismiss}
            assignmentsError={
              assignmentsIsError
                ? getErrorMessage(
                    assignmentsError,
                    'The saved timetable data could not be loaded.'
                  )
                : null
            }
            onRetryAssignments={() => refetchAssignments()}
            blocksError={
              blocksIsError
                ? getErrorMessage(
                    blocksError,
                    'Timetable blocks could not be loaded.'
                  )
                : null
            }
            onRetryBlocks={() => refetchBlocks()}
            notice={notice}
            onDismissNotice={() => setNotice(null)}
            draftNotice={draftNotice}
            onDismissDraftNotice={() => setDraftNotice(null)}
          />
          {renderCanvas()}
        </div>
        <DragOverlay dropAnimation={null} modifiers={[pointerAlignModifier]}>
          {activeSession ? (
            <DragPreviewCard session={activeSession} metrics={gridMetrics} />
          ) : null}
        </DragOverlay>
      </DndContext>
      <BlockEditDialog
        key={editingBlock?.id ?? 'none'}
        block={editingBlock}
        open={blockDialogOpen}
        onOpenChange={(open) => {
          setBlockDialogOpen(open)
          if (!open) {
            setEditingBlock(null)
            setBlockMutationError(null)
          }
        }}
        onSave={({ name, colour }) => {
          if (!editingBlock) return
          setBlockMutationError(null)
          updateBlockMutation.mutate({
            blockId: editingBlock.id,
            name,
            colour,
            cells: editingBlock.cells,
          })
        }}
        onDelete={() => {
          if (!editingBlock) return
          setBlockMutationError(null)
          deleteBlockMutation.mutate(editingBlock.id)
        }}
        isSaving={updateBlockMutation.isPending}
        isDeleting={deleteBlockMutation.isPending}
        error={blockMutationError}
      />
      <BlockCreateDialog
        // Remount per distinct selection so name/colour reset between blocks.
        key={[...blockSelectionKeys].sort().join('|') || 'none'}
        open={blockCreateOpen}
        cells={blockSelectionCells}
        rooms={rooms ?? []}
        onOpenChange={(open) => {
          setBlockCreateOpen(open)
          if (!open) setBlockCreateError(null)
        }}
        onCreate={handleCreateBlock}
        isSaving={createBlockMutation.isPending}
        error={blockCreateError}
      />
      <TimetableDownloadDialog
        open={downloadDialogOpen}
        onOpenChange={(open) => {
          setDownloadDialogOpen(open)
          if (!open) setExportError(null)
        }}
        onDownload={handleDownload}
        isExporting={exportMutation.isPending}
        error={exportError}
      />
    </AppFrame>
  )
}
