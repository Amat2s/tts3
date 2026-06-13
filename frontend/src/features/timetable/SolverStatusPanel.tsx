import { AlertTriangle, CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import type { SolverRunStatusResponse } from '@/lib/api/solver'

/**
 * Solver run status banner (Unit 48).
 *
 * Renders the running, success, partial-success, and failure UI states for the
 * async solver run, plus start-request errors. Counts come straight from the
 * backend run status so partial-success warnings show real numbers.
 */

interface SolverStatusPanelProps {
  runStatus: SolverRunStatusResponse | null
  isStarting: boolean
  startError: string | null
  /** Set when polling an active run's status fails; retries automatically. */
  statusError?: string | null
  onDismiss: () => void
}

function sessionLabel(count: number): string {
  return `${count} session${count !== 1 ? 's' : ''}`
}

function Banner({
  background,
  textColor,
  icon,
  title,
  detail,
  onDismiss,
}: {
  background: string
  textColor: string
  icon: React.ReactNode
  title: string
  detail?: React.ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      className="rounded-lg border flex items-start gap-3 px-4 py-3"
      style={{ backgroundColor: background, borderColor: 'var(--border-default)' }}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0 mt-0.5" style={{ color: textColor }}>
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: textColor }}>
          {title}
        </p>
        {detail && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {detail}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          className="shrink-0 flex items-center justify-center h-5 w-5 rounded-sm"
          style={{ color: 'var(--text-muted)' }}
          onClick={onDismiss}
          title="Dismiss"
          aria-label="Dismiss solver status"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function SolverStatusPanel({
  runStatus,
  isStarting,
  startError,
  statusError,
  onDismiss,
}: SolverStatusPanelProps) {
  // Start request in flight — treat as a running state.
  if (isStarting) {
    return (
      <Banner
        background="var(--solver-running-bg)"
        textColor="var(--solver-accent)"
        icon={<Loader2 className="h-4 w-4 animate-spin" />}
        title="Starting solver run…"
        detail="Preparing the saved timetable for the solver."
      />
    )
  }

  // Start request failed before a run was created.
  if (startError) {
    return (
      <Banner
        background="var(--solver-failure-bg)"
        textColor="var(--state-error)"
        icon={<XCircle className="h-4 w-4" />}
        title="Could not start the solver"
        detail={startError}
        onDismiss={onDismiss}
      />
    )
  }

  // Polling an active run failed (transient). The run is still in progress on
  // the backend; we keep editing locked and retry automatically.
  if (statusError) {
    return (
      <Banner
        background="var(--solver-partial-bg)"
        textColor="var(--state-warning)"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Solver status could not be refreshed"
        detail={`${statusError} The solver is still running — editing stays disabled until it finishes.`}
      />
    )
  }

  if (!runStatus) return null

  if (runStatus.status === 'pending' || runStatus.status === 'running') {
    return (
      <Banner
        background="var(--solver-running-bg)"
        textColor="var(--solver-accent)"
        icon={<Loader2 className="h-4 w-4 animate-spin" />}
        title="Solver is running…"
        detail="Editing is disabled until the solver finishes. This may take a moment."
      />
    )
  }

  if (runStatus.status === 'failed') {
    return (
      <Banner
        background="var(--solver-failure-bg)"
        textColor="var(--state-error)"
        icon={<XCircle className="h-4 w-4" />}
        title="Solver run failed"
        detail={
          runStatus.failure_message ||
          'The solver could not complete. Your saved timetable is unchanged — you can adjust it and try again.'
        }
        onDismiss={onDismiss}
      />
    )
  }

  // succeeded — distinguish full success from a partial result.
  const scheduled = runStatus.scheduled_count ?? 0
  const unscheduled = runStatus.unscheduled_count ?? 0
  const isPartial = runStatus.partial_success || unscheduled > 0

  if (isPartial) {
    return (
      <Banner
        background="var(--solver-partial-bg)"
        textColor="var(--state-warning)"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Solver finished with a partial result"
        detail={`Scheduled ${sessionLabel(scheduled)}. ${sessionLabel(
          unscheduled
        )} could not be placed and ${
          unscheduled === 1 ? 'remains' : 'remain'
        } in the unscheduled pool.`}
        onDismiss={onDismiss}
      />
    )
  }

  return (
    <Banner
      background="var(--solver-success-bg)"
      textColor="var(--state-success)"
      icon={<CheckCircle2 className="h-4 w-4" />}
      title="Solver finished successfully"
      detail={`Scheduled ${sessionLabel(scheduled)}. The saved timetable has been updated.`}
      onDismiss={onDismiss}
    />
  )
}
