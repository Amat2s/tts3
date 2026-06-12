import { apiRequest, ApiRequestError } from '@/lib/api/client'

/**
 * Frontend solver API client (Unit 47).
 *
 * Surfaces the protected backend solver start/status endpoints (Unit 46) to
 * frontend code without integrating any solver UI, polling, or draft state yet.
 * The solver always runs against the *saved* timetable state on the backend, so
 * these functions never send frontend draft assignment payloads.
 */

/** Discriminating run status, mirrored from backend `SolverRunStatus`. */
export type SolverRunStatus = 'pending' | 'running' | 'succeeded' | 'failed'

/** Backend-issued identifier for a single solver run. */
export type SolverRunId = string

/**
 * Solver run status DTO. Field names match the backend
 * `SolverRunStatusResponse` JSON shape exactly (Unit 46).
 */
export interface SolverRunStatusResponse {
  solver_run_id: SolverRunId
  status: SolverRunStatus
  job_id: string | null
  created_at: string
  updated_at: string
  scheduled_count: number | null
  unscheduled_count: number | null
  partial_success: boolean
  failure_message: string | null
}

/** Structured error codes the backend solver service can return (Unit 46). */
export type SolverErrorCode =
  | 'solver_run_active'
  | 'solver_integrity_failed'
  | 'solver_no_rooms'
  | 'solver_job_trigger_failed'
  | 'solver_run_not_found'

/**
 * Reads the structured `{ error: { code, message } }` envelope the backend
 * `AppError` handler returns. The base client stores the full parsed body on
 * `ApiRequestError.detail`, so the structured code lives there.
 */
function readSolverError(err: ApiRequestError): { code?: string; message?: string } {
  const body =
    typeof err.detail === 'object' && err.detail !== null
      ? (err.detail as { error?: { code?: unknown; message?: unknown } }).error
      : undefined

  const code = typeof body?.code === 'string' ? body.code : undefined
  const message = typeof body?.message === 'string' ? body.message : undefined
  return { code, message }
}

const SOLVER_ERROR_MESSAGES: Record<SolverErrorCode, string> = {
  solver_run_active:
    'A solver run is already in progress. Wait for it to finish before starting another.',
  solver_integrity_failed:
    'The saved timetable could not be used by the solver. Resolve the reported issues and save the timetable before running the solver.',
  solver_no_rooms: 'Add at least one room before running the solver.',
  solver_job_trigger_failed:
    'The solver job could not be started. Please try again in a moment.',
  solver_run_not_found: 'That solver run could not be found.',
}

/**
 * Maps backend solver failures onto specific, user-facing messages. Unknown
 * errors are re-thrown unchanged so nothing is swallowed silently.
 */
function parseSolverError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const { code, message } = readSolverError(err)

    if (code && code in SOLVER_ERROR_MESSAGES) {
      throw new ApiRequestError({
        status: err.status,
        message: SOLVER_ERROR_MESSAGES[code as SolverErrorCode],
        detail: err.detail,
      })
    }

    // Backend defensive checks may surface other structured messages; prefer
    // the backend-provided message over the generic status fallback.
    if (message) {
      throw new ApiRequestError({ status: err.status, message, detail: err.detail })
    }
  }
  throw err
}

/**
 * Starts a solver run against the saved timetable state.
 *
 * Sends no request body — the backend solves the persisted timetable, so no
 * frontend draft assignment payload is ever transmitted. The shared
 * authenticated base client attaches the Supabase auth token.
 */
export async function startSolverRun(): Promise<SolverRunStatusResponse> {
  try {
    return await apiRequest<SolverRunStatusResponse>('/solver/start', {
      method: 'POST',
    })
  } catch (err) {
    parseSolverError(err)
  }
}

/**
 * Reads the current status of a solver run by id. Uses the shared authenticated
 * base client for token attachment and consistent error normalization.
 */
export async function getSolverRunStatus(
  runId: SolverRunId
): Promise<SolverRunStatusResponse> {
  try {
    return await apiRequest<SolverRunStatusResponse>(
      `/solver/status/${encodeURIComponent(runId)}`
    )
  } catch (err) {
    parseSolverError(err)
  }
}
