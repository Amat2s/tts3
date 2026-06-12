import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getSolverRunStatus,
  startSolverRun,
  type SolverRunId,
  type SolverRunStatus,
  type SolverRunStatusResponse,
} from '@/lib/api/solver'

/**
 * Async solver run lifecycle hook (Unit 48).
 *
 * Owns the full solver run lifecycle for the timetable page: starting a run
 * against the saved timetable state (Unit 47 client → Unit 46 backend), polling
 * its status only while it is active, and firing terminal callbacks exactly once
 * so the page can refresh saved assignments / reset the draft.
 *
 * This hook never sends frontend draft state to the backend — the solver always
 * runs against the persisted timetable.
 */

// Poll cadence while a run is pending/running. Kept moderate to avoid excessive
// request frequency while still feeling responsive.
const POLL_INTERVAL_MS = 2000

const SOLVER_STATUS_KEY = 'solver-status'

function isActiveStatus(status: SolverRunStatus): boolean {
  return status === 'pending' || status === 'running'
}

interface UseSolverRunOptions {
  /** Fired once when a run reaches `succeeded`. */
  onSucceeded?: (status: SolverRunStatusResponse) => void
  /** Fired once when a run reaches `failed`. */
  onFailed?: (status: SolverRunStatusResponse) => void
}

export interface SolverRunController {
  /** Latest status for the tracked run, or null when no run is tracked. */
  runStatus: SolverRunStatusResponse | null
  /** True while the run is pending or running. */
  isActive: boolean
  /** True while the start request itself is in flight. */
  isStarting: boolean
  /** User-facing error from a failed start request, or null. */
  startError: string | null
  /** Start a new solver run against the saved timetable state. */
  start: () => void
  /** Clear the tracked run and any start error (dismiss terminal UI). */
  dismiss: () => void
}

export function useSolverRun(
  options: UseSolverRunOptions = {}
): SolverRunController {
  const queryClient = useQueryClient()
  const [activeRunId, setActiveRunId] = useState<SolverRunId | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  // Guards the terminal completion effect so each run's callback fires once.
  const handledRunRef = useRef<SolverRunId | null>(null)

  // Keep the latest callbacks in refs so the completion effect can stay
  // dependent only on the run status, not on caller-provided closures.
  const onSucceededRef = useRef(options.onSucceeded)
  const onFailedRef = useRef(options.onFailed)
  useEffect(() => {
    onSucceededRef.current = options.onSucceeded
    onFailedRef.current = options.onFailed
  }, [options.onSucceeded, options.onFailed])

  const statusQuery = useQuery({
    queryKey: [SOLVER_STATUS_KEY, activeRunId],
    queryFn: () => getSolverRunStatus(activeRunId as SolverRunId),
    enabled: activeRunId !== null,
    // Poll only while the run is active; stop on success or failure. TanStack
    // Query tears the interval down automatically when the component unmounts.
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return POLL_INTERVAL_MS
      return isActiveStatus(data.status) ? POLL_INTERVAL_MS : false
    },
  })

  const runStatus = statusQuery.data ?? null

  const startMutation = useMutation({
    mutationFn: startSolverRun,
    onSuccess: (response) => {
      setStartError(null)
      handledRunRef.current = null
      // Seed the status cache so the initial run state is shown immediately,
      // before the first poll resolves.
      queryClient.setQueryData(
        [SOLVER_STATUS_KEY, response.solver_run_id],
        response
      )
      setActiveRunId(response.solver_run_id)
    },
    onError: (err: Error) => {
      setStartError(
        err.message || 'Failed to start the solver. Please try again.'
      )
    },
  })

  // Fire the terminal callback exactly once per run when it stops being active.
  useEffect(() => {
    if (!runStatus) return
    if (isActiveStatus(runStatus.status)) return
    if (handledRunRef.current === runStatus.solver_run_id) return
    handledRunRef.current = runStatus.solver_run_id
    if (runStatus.status === 'succeeded') {
      onSucceededRef.current?.(runStatus)
    } else if (runStatus.status === 'failed') {
      onFailedRef.current?.(runStatus)
    }
  }, [runStatus])

  const start = useCallback(() => {
    setStartError(null)
    startMutation.mutate()
  }, [startMutation])

  const dismiss = useCallback(() => {
    setActiveRunId(null)
    setStartError(null)
    handledRunRef.current = null
  }, [])

  return {
    runStatus,
    isActive: runStatus !== null && isActiveStatus(runStatus.status),
    isStarting: startMutation.isPending,
    startError,
    start,
    dismiss,
  }
}
