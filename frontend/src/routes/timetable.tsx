import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ArrowRight, CalendarDays, Loader2, MoveHorizontal, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { TimetableActionBar } from '@/features/timetable/TimetableActionBar'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { UnscheduledPool } from '@/features/timetable/UnscheduledPool'
import { ViolationAlertArea } from '@/features/timetable/ViolationAlertArea'
import type { ConstraintViolation } from '@/features/timetable/violations'
import { getUnitColor } from '@/features/timetable/unitColors'
import type { UnitColorVariant } from '@/features/timetable/unitColors'
import { listRooms } from '@/lib/api/rooms'
import { listSchedulableSessions } from '@/lib/api/sessions'
import type { SchedulableSession } from '@/lib/api/sessions'
import {
  listAssignments,
  scheduleSession,
  moveAssignment,
  unscheduleAssignment,
} from '@/lib/api/assignments'
import type { Assignment, AssignmentDay, AssignmentSlot, AssignmentMove } from '@/lib/api/assignments'
import { validateTimetable } from '@/lib/api/constraints'
import type { TimetableAssignment, SlotId } from '@/features/timetable/assignment'
import type { Day } from '@/features/timetable/slots'

type SchedulingMode =
  | { type: 'idle' }
  | { type: 'placing'; sessionId: string; sessionLabel: string }
  | { type: 'moving'; assignmentId: string; assignmentLabel: string }

type ActiveDragInfo =
  | { kind: 'unscheduled'; session: SchedulableSession }
  | { kind: 'scheduled'; assignment: TimetableAssignment }

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  lab: 'Lab',
  workshop: 'Workshop',
}

const SESSION_TYPE_ABBREV: Record<string, string> = {
  lecture: 'Lec',
  tutorial: 'Tut',
  lab: 'Lab',
  workshop: 'Wksp',
}

const PREVIEW_BG: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-bg)',
  gold: 'var(--unit-gold-bg)',
  blue: 'var(--unit-blue-bg)',
  green: 'var(--unit-green-bg)',
  purple: 'var(--unit-purple-bg)',
  stone: 'var(--unit-stone-bg)',
}

const PREVIEW_BORDER: Record<UnitColorVariant, string> = {
  maroon: 'var(--unit-maroon-border)',
  gold: 'var(--unit-gold-border)',
  blue: 'var(--unit-blue-border)',
  green: 'var(--unit-green-border)',
  purple: 'var(--unit-purple-border)',
  stone: 'var(--unit-stone-border)',
}

function DragPreview({ activeDrag, cellWidth }: { activeDrag: ActiveDragInfo; cellWidth: number }) {
  let unitId: string, unitCode: string, sessionType: string, duration: number
  let lecturerDisplayName: string, studentCount: number

  if (activeDrag.kind === 'unscheduled') {
    const s = activeDrag.session
    unitId = s.unit_id
    unitCode = s.unit_code
    sessionType = s.session_type
    duration = s.duration
    lecturerDisplayName = s.lecturer_display_name
    studentCount = s.student_count
  } else {
    const a = activeDrag.assignment
    unitId = a.unit_id
    unitCode = a.unit_code
    sessionType = a.session_type
    duration = a.duration
    lecturerDisplayName = a.lecturer_display_name
    studentCount = a.student_count
  }

  const color = getUnitColor(unitId)

  return (
    <div
      className="rounded-md border overflow-hidden px-1.5 py-1 flex flex-col gap-0.5 select-none shadow-lg"
      style={{
        width: `${cellWidth}px`,
        height: `calc(${duration} * 3.5rem)`,
        backgroundColor: PREVIEW_BG[color],
        borderColor: PREVIEW_BORDER[color],
        borderLeftWidth: '4px',
        pointerEvents: 'none',
        opacity: 0.95,
        transition: 'none',
        willChange: 'transform',
      }}
    >
      <div className="flex items-baseline gap-1 min-w-0">
        <span
          className="text-xs font-semibold shrink-0"
          style={{ color: PREVIEW_BORDER[color] }}
        >
          {unitCode}
        </span>
        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
          {SESSION_TYPE_ABBREV[sessionType] ?? sessionType}
        </span>
      </div>
      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
        {lecturerDisplayName}
      </span>
      {duration > 1 && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {studentCount} student{studentCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

function toTimetableAssignment(a: Assignment): TimetableAssignment {
  return {
    assignment_id: a.id,
    session_id: a.session_id,
    unit_id: a.unit.id,
    unit_code: a.unit.code,
    unit_name: a.unit.name,
    session_type: a.session.session_type,
    duration: a.session.duration,
    lecturer_display_name: a.session.lecturer_display_name,
    student_count: a.session.student_count,
    day: a.day as Day,
    start_slot: a.start_slot as SlotId,
    room_id: a.room_id,
  }
}

export default function TimetablePage() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<SchedulingMode>({ type: 'idle' })
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDragInfo | null>(null)
  const [cellWidth, setCellWidth] = useState(128)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsIsError,
    error: roomsError,
  } = useQuery({ queryKey: ['rooms'], queryFn: listRooms })

  const {
    data: schedulableSessions,
    isLoading: sessionsLoading,
    isError: sessionsIsError,
    error: sessionsError,
  } = useQuery({ queryKey: ['schedulable-sessions'], queryFn: listSchedulableSessions })

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    isError: assignmentsIsError,
    error: assignmentsError,
  } = useQuery({ queryKey: ['assignments'], queryFn: listAssignments })

  const scheduleMutation = useMutation({
    mutationFn: scheduleSession,
    onMutate: async (input) => {
      const previousAssignments = queryClient.getQueryData<Assignment[]>(['assignments'])
      const previousSchedulableSessions = queryClient.getQueryData<SchedulableSession[]>(['schedulable-sessions'])

      const session = previousSchedulableSessions?.find(s => s.session_id === input.session_id)
      if (session) {
        const optimisticAssignment: Assignment = {
          id: `optimistic_${Date.now()}`,
          session_id: input.session_id,
          room_id: input.room_id,
          day: input.day,
          start_slot: input.start_slot,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          session: {
            id: input.session_id,
            unit_id: session.unit_id,
            session_type: session.session_type,
            duration: session.duration,
            lecturer_id: session.lecturer_id,
            lecturer_display_name: session.lecturer_display_name,
            student_count: session.student_count,
          },
          unit: {
            id: session.unit_id,
            code: session.unit_code,
            name: session.unit_name,
          },
          room: { id: input.room_id, name: '' },
        }
        // Apply cache updates synchronously before any await so React batches them
        // with other synchronous state changes (e.g. clearing activeDrag) — no flicker gap
        queryClient.setQueryData<Assignment[]>(['assignments'], old => [
          ...(old ?? []),
          optimisticAssignment,
        ])
        queryClient.setQueryData<SchedulableSession[]>(['schedulable-sessions'], old =>
          (old ?? []).filter(s => s.session_id !== input.session_id)
        )
      }

      // Cancel after updating so in-flight queries don't overwrite the optimistic state
      await queryClient.cancelQueries({ queryKey: ['assignments'] })
      await queryClient.cancelQueries({ queryKey: ['schedulable-sessions'] })

      return { previousAssignments, previousSchedulableSessions }
    },
    onError: (err: Error, _input, context) => {
      if (context?.previousAssignments !== undefined) {
        queryClient.setQueryData(['assignments'], context.previousAssignments)
      }
      if (context?.previousSchedulableSessions !== undefined) {
        queryClient.setQueryData(['schedulable-sessions'], context.previousSchedulableSessions)
      }
      setActionError(err.message)
      // Mode stays as 'placing' so the user can retry with a different slot
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Assignment[]>(['assignments'], old => {
        if (!old) return [data]
        return old.map(a =>
          a.id.startsWith('optimistic_') && a.session_id === data.session_id ? data : a
        )
      })
      setMode({ type: 'idle' })
      setActionError(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['validation'] })
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AssignmentMove }) =>
      moveAssignment(id, input),
    onMutate: async ({ id, input }) => {
      const previousAssignments = queryClient.getQueryData<Assignment[]>(['assignments'])

      // Apply synchronously before any await to avoid a render gap
      queryClient.setQueryData<Assignment[]>(['assignments'], old =>
        (old ?? []).map(a =>
          a.id === id
            ? { ...a, room_id: input.room_id, day: input.day, start_slot: input.start_slot }
            : a
        )
      )

      await queryClient.cancelQueries({ queryKey: ['assignments'] })

      return { previousAssignments }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAssignments !== undefined) {
        queryClient.setQueryData(['assignments'], context.previousAssignments)
      }
      setActionError(err.message)
      // Reset to idle on move failure; grid reflects rolled-back backend state
      setMode({ type: 'idle' })
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Assignment[]>(['assignments'], old => {
        if (!old) return [data]
        return old.map(a => a.id === data.id ? data : a)
      })
      setMode({ type: 'idle' })
      setActionError(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['validation'] })
    },
  })

  const unscheduleMutation = useMutation({
    mutationFn: (assignmentId: string) => unscheduleAssignment(assignmentId),
    onMutate: async (assignmentId) => {
      const previousAssignments = queryClient.getQueryData<Assignment[]>(['assignments'])
      const previousSchedulableSessions = queryClient.getQueryData<SchedulableSession[]>(['schedulable-sessions'])

      const assignment = previousAssignments?.find(a => a.id === assignmentId)

      // Optimistically remove from grid immediately
      queryClient.setQueryData<Assignment[]>(['assignments'], old =>
        (old ?? []).filter(a => a.id !== assignmentId)
      )

      // Optimistically restore session to the pool
      if (assignment) {
        const restoredSession: SchedulableSession = {
          session_id: assignment.session_id,
          unit_id: assignment.unit.id,
          unit_code: assignment.unit.code,
          unit_name: assignment.unit.name,
          session_type: assignment.session.session_type,
          duration: assignment.session.duration,
          lecturer_id: assignment.session.lecturer_id,
          lecturer_display_name: assignment.session.lecturer_display_name,
          student_count: assignment.session.student_count,
        }
        queryClient.setQueryData<SchedulableSession[]>(['schedulable-sessions'], old =>
          [...(old ?? []), restoredSession]
        )
      }

      await queryClient.cancelQueries({ queryKey: ['assignments'] })
      await queryClient.cancelQueries({ queryKey: ['schedulable-sessions'] })

      return { previousAssignments, previousSchedulableSessions }
    },
    onError: (err: Error, _assignmentId, context) => {
      if (context?.previousAssignments !== undefined) {
        queryClient.setQueryData(['assignments'], context.previousAssignments)
      }
      if (context?.previousSchedulableSessions !== undefined) {
        queryClient.setQueryData(['schedulable-sessions'], context.previousSchedulableSessions)
      }
      setActionError(err.message)
    },
    onSuccess: () => {
      setActionError(null)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['validation'] })
    },
  })

  const isMutating =
    scheduleMutation.isPending || moveMutation.isPending || unscheduleMutation.isPending

  const {
    data: validationData,
    isLoading: validationLoading,
    isError: validationIsError,
    error: validationError,
  } = useQuery({ queryKey: ['validation'], queryFn: validateTimetable })

  const violations = useMemo(
    (): ConstraintViolation[] => validationData?.violations ?? [],
    [validationData]
  )
  const invalidSessionIds = useMemo(
    () => new Set(violations.flatMap(v => v.affected_session_ids)),
    [violations]
  )

  const timetableAssignments = useMemo(
    () => (assignments ?? []).map(toTimetableAssignment),
    [assignments]
  )

  // Per-card frozen set: only the specific card being operated on is locked,
  // leaving all other cards immediately interactive.
  const frozenAssignmentIds = useMemo(() => {
    const ids = new Set<string>()
    if (moveMutation.isPending && moveMutation.variables?.id) {
      ids.add(moveMutation.variables.id)
    }
    if (unscheduleMutation.isPending && unscheduleMutation.variables) {
      ids.add(unscheduleMutation.variables)
    }
    if (scheduleMutation.isPending) {
      for (const a of timetableAssignments) {
        if (a.assignment_id?.startsWith('optimistic_')) ids.add(a.assignment_id)
      }
    }
    return ids
  }, [
    moveMutation.isPending, moveMutation.variables,
    unscheduleMutation.isPending, unscheduleMutation.variables,
    scheduleMutation.isPending, timetableAssignments,
  ])

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (!data) return
    if (data.type === 'unscheduled') {
      setActiveDrag({ kind: 'unscheduled', session: data.session as SchedulableSession })
    } else if (data.type === 'scheduled') {
      setActiveDrag({ kind: 'scheduled', assignment: data.assignment as TimetableAssignment })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event
    setActiveDrag(null)

    if (!over || isMutating || !activeDrag) return

    const [day, roomId, slotId] = (over.id as string).split(':')
    if (!day || !roomId || !slotId) return

    if (activeDrag.kind === 'unscheduled') {
      scheduleMutation.mutate({
        session_id: activeDrag.session.session_id,
        room_id: roomId,
        day: day as AssignmentDay,
        start_slot: slotId as AssignmentSlot,
      })
    } else if (activeDrag.kind === 'scheduled') {
      const assignmentId = activeDrag.assignment.assignment_id
      // Prevent moving an optimistic card before the schedule round-trip completes
      if (!assignmentId || assignmentId.startsWith('optimistic_')) return
      moveMutation.mutate({
        id: assignmentId,
        input: {
          room_id: roomId,
          day: day as AssignmentDay,
          start_slot: slotId as AssignmentSlot,
        },
      })
    }
  }

  function handleDragCancel() {
    setActiveDrag(null)
  }

  function handleSelectSession(session: SchedulableSession) {
    if (isMutating) return
    setActionError(null)
    if (mode.type === 'placing' && mode.sessionId === session.session_id) {
      setMode({ type: 'idle' })
      return
    }
    setMode({
      type: 'placing',
      sessionId: session.session_id,
      sessionLabel: `${session.unit_code} ${SESSION_TYPE_LABEL[session.session_type] ?? session.session_type}`,
    })
  }

  const handleMoveStart = useCallback((assignmentId: string) => {
    if (frozenAssignmentIds.has(assignmentId)) return
    setActionError(null)
    if (mode.type === 'moving' && mode.assignmentId === assignmentId) {
      setMode({ type: 'idle' })
      return
    }
    const assignment = timetableAssignments.find((a) => a.assignment_id === assignmentId)
    setMode({
      type: 'moving',
      assignmentId,
      assignmentLabel: assignment
        ? `${assignment.unit_code} ${SESSION_TYPE_LABEL[assignment.session_type] ?? assignment.session_type}`
        : 'session',
    })
  }, [frozenAssignmentIds, mode, timetableAssignments])

  const handleCellClick = useCallback((day: string, roomId: string, slotId: string) => {
    if (isMutating) return
    if (mode.type === 'placing') {
      scheduleMutation.mutate({
        session_id: mode.sessionId,
        room_id: roomId,
        day: day as AssignmentDay,
        start_slot: slotId as AssignmentSlot,
      })
    } else if (mode.type === 'moving') {
      moveMutation.mutate({
        id: mode.assignmentId,
        input: {
          room_id: roomId,
          day: day as AssignmentDay,
          start_slot: slotId as AssignmentSlot,
        },
      })
    }
  }, [isMutating, mode, scheduleMutation, moveMutation])

  const handleCellWidthChange = useCallback((w: number) => setCellWidth(w), [])

  const handleUnschedule = useCallback((assignmentId: string) => {
    if (frozenAssignmentIds.has(assignmentId)) return
    setActionError(null)
    unscheduleMutation.mutate(assignmentId)
  }, [frozenAssignmentIds, unscheduleMutation])

  const selectedSessionId = mode.type === 'placing' ? mode.sessionId : null
  const movingAssignmentId = mode.type === 'moving' ? mode.assignmentId : null
  const unschedulingAssignmentId =
    unscheduleMutation.isPending ? (unscheduleMutation.variables ?? null) : null
  const isInteractive = mode.type !== 'idle' && !isMutating

  function renderCanvas() {
    if (roomsLoading) {
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

    if (roomsIsError) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--state-error)' }}>
            {(roomsError as Error)?.message ?? 'Failed to load rooms.'}
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
      <div className="flex flex-col gap-3">
        {/* Scheduling mode banner */}
        {mode.type !== 'idle' && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border"
            style={{
              borderColor: 'var(--accent-primary)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {mode.type === 'placing' ? (
                <ArrowRight
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--accent-primary)' }}
                />
              ) : (
                <MoveHorizontal
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--accent-primary)' }}
                />
              )}
              <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {mode.type === 'placing'
                  ? `Placing ${mode.sessionLabel} — click a time slot to schedule`
                  : `Moving ${mode.assignmentLabel} — click a target slot`}
              </p>
              {(scheduleMutation.isPending || moveMutation.isPending) && (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin"
                  style={{ color: 'var(--accent-primary)' }}
                />
              )}
            </div>
            <button
              className="shrink-0 text-xs px-2.5 py-1 rounded border"
              style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)',
                opacity: isMutating ? 0.4 : 1,
                cursor: isMutating ? 'not-allowed' : 'pointer',
              }}
              onClick={() => setMode({ type: 'idle' })}
              disabled={isMutating}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Mutation/query error banner */}
        {actionError && (
          <div
            className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border"
            style={{
              borderColor: 'var(--state-error)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {actionError}
            </p>
            <button
              className="shrink-0 p-1 rounded"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" style={{ color: 'var(--state-error)' }} />
            </button>
          </div>
        )}

        {/* Assignments query error */}
        {assignmentsIsError && (
          <div
            className="flex items-center justify-center py-3 rounded-lg border"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {(assignmentsError as Error)?.message ?? 'Failed to load assignments.'}
            </p>
          </div>
        )}

        {/* Constraint violation alerts */}
        <ViolationAlertArea violations={violations} />

        {/* Assignments loading indicator */}
        {assignmentsLoading && (
          <div className="flex items-center gap-2 px-1">
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              style={{ color: 'var(--text-muted)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading assignments…
            </span>
          </div>
        )}

        <TimetableGrid
          rooms={rooms}
          assignments={timetableAssignments}
          onCellClick={handleCellClick}
          isInteractive={isInteractive}
          movingAssignmentId={movingAssignmentId}
          unschedulingAssignmentId={unschedulingAssignmentId}
          onMoveStart={handleMoveStart}
          onUnschedule={handleUnschedule}
          frozenAssignmentIds={frozenAssignmentIds}
          invalidSessionIds={invalidSessionIds}
          onCellWidthChange={handleCellWidthChange}
        />
        <UnscheduledPool
          sessions={schedulableSessions}
          isLoading={sessionsLoading}
          isError={sessionsIsError}
          error={sessionsError as Error | null}
          selectedSessionId={selectedSessionId}
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
            violations={violations}
            validationLoading={validationLoading}
            validationError={validationIsError ? ((validationError as Error)?.message ?? 'Validation failed') : undefined}
          />
          {renderCanvas()}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDrag ? <DragPreview activeDrag={activeDrag} cellWidth={cellWidth} /> : null}
        </DragOverlay>
      </DndContext>
    </AppFrame>
  )
}
