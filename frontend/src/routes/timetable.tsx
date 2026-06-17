import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/error/ErrorState'
import { SolverStatusPanel } from '@/features/timetable/SolverStatusPanel'
import { TimetableActionBar } from '@/features/timetable/TimetableActionBar'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { UnscheduledPool } from '@/features/timetable/UnscheduledPool'
import { UnscheduledSessionCardPreview } from '@/features/timetable/UnscheduledSessionCard'
import { useSolverRun } from '@/features/timetable/useSolverRun'
import type { TimetableAssignment } from '@/features/timetable/assignment'
import { getSubjectTokens } from '@/features/timetable/unitColors'
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

function DragPreviewCard({ session }: { session: SchedulableSession }) {
  return (
    <UnscheduledSessionCardPreview
      session={session}
      colorTokens={getSubjectTokens(session.unit_code)}
    />
  )
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

  const [draft, setDraft] = useState<TimetableAssignment[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  // Keep a ref of the latest draft so data-change effects can read it without
  // adding draft to their dependency arrays (which would cause validation loops).
  const draftRef = useRef<TimetableAssignment[]>([])
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (savedAssignments !== undefined) {
      setDraft(savedAssignments.map(toTimetableAssignment))
      setIsDirty(false)
      setSaveError(null)
      setBlockingError(null)
      setPendingSessionId(null)
    }
  }, [savedAssignments])

  // Auto-unschedule any draft assignments that now violate blocking rules after
  // room or session data changes (e.g. room capacity reduced, student count increased).
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

    const violators = getBlockingViolatorIds(validationDraft, rooms)
    if (violators.size > 0) {
      setDraft((prev) => prev.filter((a) => !violators.has(a.session_id)))
      setIsDirty(true)
    }
  }, [rooms, schedulableSessions])

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
  })

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

  // Sessions not currently placed in the draft.
  const scheduledIds = new Set(draft.map((a) => a.session_id))
  const unscheduledSessions = schedulableSessions?.filter(
    (s) => !scheduledIds.has(s.session_id)
  ) ?? []

  const warningIssues = checkDraftForWarnings(draft, lecturers)
  const warningSessionIds = new Set(
    warningIssues.flatMap((i) => i.affected_session_ids)
  )
  const blockingViolations = rooms ? checkDraftForBlockingViolations(draft, rooms) : []

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
  const activeSession = activeSessionId
    ? schedulableSessions?.find((s) => s.session_id === activeSessionId)
    : null

  function handleSelectSession(sessionId: string) {
    if (editingDisabled) return
    setBlockingError(null)
    setPendingSessionId((prev) => (prev === sessionId ? null : sessionId))
  }

  function handleCellClick(day: string, slotId: string, roomId: string) {
    if (editingDisabled) return
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

    const issues = checkProposedPlacement(proposed, draft, rooms ?? [])
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
    setSaveError(null)
    saveMutation.mutate()
  }

  function handleRunSolver() {
    if (!canRunSolver) return
    solver.start()
  }

  function handleDragStart(event: DragStartEvent) {
    if (editingDisabled) return
    const sessionId = event.active.id as string
    setActiveSessionId(sessionId)
    // Cancel any pending click-based selection when drag starts.
    setPendingSessionId(null)
    setBlockingError(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveSessionId(null)
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

    const issues = checkProposedPlacement(proposed, draft, rooms ?? [])
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
        <TimetableGrid
          rooms={rooms}
          assignments={draft}
          pendingSessionId={pendingSessionId}
          warningSessionIds={warningSessionIds}
          editingDisabled={editingDisabled}
          onCellClick={handleCellClick}
          onUnschedule={handleUnschedule}
          onMoveSelect={handleSelectSession}
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
      <PageHeader
        title="Timetable"
        description="Weekly scheduling workspace. Assign sessions to rooms and time slots, or run the constraint solver."
      />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
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
          />
          <SolverStatusPanel
            runStatus={solver.runStatus}
            isStarting={solver.isStarting}
            startError={solver.startError}
            statusError={solver.statusError}
            onDismiss={solver.dismiss}
          />
          {assignmentsIsError && (
            <ErrorState
              title="Saved timetable could not be loaded"
              message={getErrorMessage(
                assignmentsError,
                'The saved timetable data could not be loaded. Any unsaved changes are based on an empty timetable until this is resolved.'
              )}
              onRetry={() => refetchAssignments()}
            />
          )}
          {renderCanvas()}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeSession ? (
            <DragPreviewCard session={activeSession} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </AppFrame>
  )
}
