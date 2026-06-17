import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  Save,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SolverRunStatusResponse } from '@/lib/api/solver'

interface TimetableActionBarProps {
  isDirty: boolean
  isSaving: boolean
  hasDraftAssignments: boolean
  saveError: string | null
  blockingError?: string | null
  violationMessages?: string[]
  warningMessages?: string[]
  canRunSolver: boolean
  solverDisabledReason: string | null
  editingDisabled?: boolean
  onClearAll: () => void
  onSave: () => void
  onRunSolver?: () => void
  isPendingPlacement?: boolean
  // Solver lifecycle (merged from SolverStatusPanel)
  solverRunStatus: SolverRunStatusResponse | null
  isSolverStarting: boolean
  solverStartError: string | null
  solverStatusError?: string | null
  onDismissSolver: () => void
  // Assignment load error
  assignmentsError?: string | null
  onRetryAssignments?: () => void
  // Local draft-persistence notice (Unit 79)
  draftNotice?: 'restored' | 'discarded' | null
  onDismissDraftNotice?: () => void
}

interface MessageState {
  text: string
  color: string
  icon: React.ReactNode
  isAlert: boolean
  dismissible: boolean
  retryable: boolean
  // Optional override for the dismiss action; defaults to onDismissSolver.
  onDismiss?: () => void
}

function sessionLabel(count: number): string {
  return `${count} session${count !== 1 ? 's' : ''}`
}

export function TimetableActionBar({
  isDirty,
  isSaving,
  hasDraftAssignments,
  saveError,
  blockingError,
  violationMessages = [],
  warningMessages = [],
  canRunSolver,
  solverDisabledReason,
  editingDisabled = false,
  onClearAll,
  onSave,
  onRunSolver,
  isPendingPlacement = false,
  solverRunStatus,
  isSolverStarting,
  solverStartError,
  solverStatusError,
  onDismissSolver,
  assignmentsError,
  onRetryAssignments,
  draftNotice = null,
  onDismissDraftNotice,
}: TimetableActionBarProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const detailsRef = useRef<HTMLDivElement>(null)

  const violationCount = violationMessages.length
  const warningCount = warningMessages.length
  const totalIssues = violationCount + warningCount
  const hasIssues = totalIssues > 0

  // Close overlay on Escape key
  useEffect(() => {
    if (!showDetails) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowDetails(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showDetails])

  // Close overlay if issues disappear
  useEffect(() => {
    if (!hasIssues) setShowDetails(false)
  }, [hasIssues])

  function getMessageState(): MessageState {
    // Priority 1: assignment-load / save system error
    if (assignmentsError) {
      return {
        text: assignmentsError,
        color: 'var(--state-error)',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: false,
        retryable: true,
      }
    }
    if (saveError) {
      return {
        text: saveError,
        color: 'var(--state-error)',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: false,
        retryable: false,
      }
    }

    // Priority 2: solver running / status error
    if (isSolverStarting) {
      return {
        text: 'Starting solver run…',
        color: 'var(--solver-accent)',
        icon: <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }
    if (solverStatusError) {
      return {
        text: 'Solver status could not be refreshed — retrying.',
        color: 'var(--state-warning)',
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }
    if (solverStartError) {
      return {
        text: `Could not start the solver: ${solverStartError}`,
        color: 'var(--state-error)',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: true,
        retryable: false,
      }
    }
    if (
      solverRunStatus?.status === 'pending' ||
      solverRunStatus?.status === 'running'
    ) {
      return {
        text: 'Solver is running…',
        color: 'var(--solver-accent)',
        icon: <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }
    if (solverRunStatus?.status === 'failed') {
      const detail =
        solverRunStatus.failure_message ||
        'The solver could not complete. Your saved timetable is unchanged.'
      return {
        text: `Solver run failed — ${detail}`,
        color: 'var(--state-error)',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: true,
        retryable: false,
      }
    }
    if (solverRunStatus?.status === 'succeeded') {
      const scheduled = solverRunStatus.scheduled_count ?? 0
      const unscheduled = solverRunStatus.unscheduled_count ?? 0
      const isPartial = solverRunStatus.partial_success || unscheduled > 0
      if (isPartial) {
        return {
          text: `Solver finished with a partial result — scheduled ${sessionLabel(scheduled)}, ${sessionLabel(unscheduled)} could not be placed.`,
          color: 'var(--state-warning)',
          icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
          isAlert: false,
          dismissible: true,
          retryable: false,
        }
      }
      return {
        text: `Solver finished — scheduled ${sessionLabel(scheduled)}.`,
        color: 'var(--state-success)',
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
        isAlert: false,
        dismissible: true,
        retryable: false,
      }
    }

    // Priority 2.5: local draft-persistence notice (dismissible, one-time)
    if (draftNotice === 'restored') {
      return {
        text: 'Unsaved draft restored.',
        color: 'var(--accent-primary)',
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />,
        isAlert: false,
        dismissible: true,
        retryable: false,
        onDismiss: onDismissDraftNotice,
      }
    }
    if (draftNotice === 'discarded') {
      return {
        text: 'Old unsaved draft was discarded because saved timetable data changed.',
        color: 'var(--state-warning)',
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: false,
        dismissible: true,
        retryable: false,
        onDismiss: onDismissDraftNotice,
      }
    }

    // Priority 3: blocking placement failure after attempted drop/place
    if (blockingError) {
      return {
        text: `Cannot place session: ${blockingError}`,
        color: 'var(--state-error)',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: false,
        retryable: false,
      }
    }

    // Priority 4: blocking validation summary
    if (violationCount > 0) {
      return {
        text: `${violationCount} blocking violation${violationCount !== 1 ? 's' : ''} must be resolved before saving or running the solver.`,
        color: 'var(--state-error)',
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: true,
        dismissible: false,
        retryable: false,
      }
    }

    // Priority 5: warning validation summary
    if (warningCount > 0) {
      return {
        text: `${warningCount} scheduling warning${warningCount !== 1 ? 's' : ''} must be resolved before running the solver.`,
        color: 'var(--state-warning)',
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }

    // Editing disabled (solver active, no run status yet available)
    if (editingDisabled) {
      return {
        text: 'Editing is disabled while the solver runs.',
        color: 'var(--solver-accent)',
        icon: <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }

    // Pending placement hint
    if (isPendingPlacement) {
      return {
        text: 'Session selected — click an empty cell to place it, or click the session again to cancel.',
        color: 'var(--accent-primary)',
        icon: null,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }

    // Priority 6: unsaved changes / saved state
    if (isDirty) {
      return {
        text: 'Unsaved changes',
        color: 'var(--text-muted)',
        icon: null,
        isAlert: false,
        dismissible: false,
        retryable: false,
      }
    }

    // Priority 7: neutral ready state
    return {
      text: 'No issues — timetable is ready.',
      color: 'var(--text-muted)',
      icon: null,
      isAlert: false,
      dismissible: false,
      retryable: false,
    }
  }

  const msgState = getMessageState()

  function handleConfirmClear() {
    onClearAll()
    setClearDialogOpen(false)
  }

  return (
    <>
      {/* Outer wrapper: sticky positioning + relative anchor for the overlay */}
      <div
        data-testid="timetable-action-bar"
        className="sticky top-4 z-30 relative"
      >
        {/* Visually styled bar */}
        <div
          className="rounded-lg border shadow-sm"
          style={{
            borderColor: 'var(--border-strong)',
            backgroundColor: 'var(--bg-elevated)',
            minHeight: '3.25rem',
          }}
        >
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: message + details trigger */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <div
                className="flex min-w-0 items-center gap-1.5 text-sm"
                role={msgState.isAlert ? 'alert' : 'status'}
                aria-live={msgState.isAlert ? 'assertive' : 'polite'}
                style={{ color: msgState.color }}
              >
                {msgState.icon}
                <span className="min-w-0">{msgState.text}</span>
                {msgState.retryable && onRetryAssignments && (
                  <button
                    type="button"
                    className="ml-1 shrink-0 text-xs underline"
                    style={{ color: msgState.color }}
                    onClick={onRetryAssignments}
                  >
                    Try again
                  </button>
                )}
                {msgState.dismissible && (
                  <button
                    type="button"
                    className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-70 hover:opacity-100"
                    aria-label="Dismiss message"
                    style={{ color: msgState.color }}
                    onClick={msgState.onDismiss ?? onDismissSolver}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {hasIssues && (
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 text-xs underline"
                  style={{ color: 'var(--text-muted)' }}
                  aria-expanded={showDetails}
                  aria-controls="timetable-validation-details"
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showDetails ? 'Hide' : 'View'} details ({totalIssues})
                </button>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasDraftAssignments || editingDisabled || isSaving}
                onClick={() => setClearDialogOpen(true)}
                className="border-[var(--state-error)] text-[var(--state-error)] hover:bg-[var(--state-error-bg)] hover:text-[var(--state-error)]"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear all
              </Button>

              <Button
                size="sm"
                disabled={!canRunSolver}
                title={solverDisabledReason ?? undefined}
                onClick={onRunSolver}
                className={
                  canRunSolver
                    ? 'border-[var(--solver-accent)] bg-[var(--solver-accent)] text-[var(--text-inverse)] hover:bg-[var(--solver-accent-hover)]'
                    : 'border-[var(--solver-accent)] bg-[var(--solver-accent-soft)] text-[var(--solver-accent)] disabled:opacity-70'
                }
              >
                {editingDisabled ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Solving...
                  </>
                ) : (
                  <>
                    <Cpu className="mr-1.5 h-3.5 w-3.5" />
                    Generate Timetable
                  </>
                )}
              </Button>

              <Button
                size="sm"
                disabled={!isDirty || isSaving || editingDisabled}
                onClick={onSave}
                className={
                  isDirty && !isSaving && !editingDisabled
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-primary-hover)]'
                    : undefined
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : isDirty ? (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Save Timetable
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Saved
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Details overlay — absolutely positioned, does not add layout height */}
        {showDetails && hasIssues && (
          <div
            ref={detailsRef}
            id="timetable-validation-details"
            role="region"
            aria-label="Validation details"
            className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-lg"
            style={{
              top: '100%',
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <div className="flex flex-col gap-3 px-4 py-3">
              {violationCount > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: 'var(--state-error)' }}
                  >
                    Blocking violations — {violationCount}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {violationMessages.map((message, index) => (
                      <li
                        key={`${message}-${index}`}
                        className="flex items-start gap-1.5 text-xs"
                        style={{ color: 'var(--state-error)' }}
                      >
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: 'var(--state-warning)' }}
                  >
                    Scheduling warnings — {warningCount}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {warningMessages.map((message, index) => (
                      <li
                        key={`${message}-${index}`}
                        className="flex items-start gap-1.5 text-xs"
                        style={{ color: 'var(--state-warning)' }}
                      >
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear current timetable draft?</DialogTitle>
            <DialogDescription>
              This clears every assignment from the current timetable draft
              and returns those sessions to the unscheduled pool. The saved
              timetable will not change until you click Save Timetable.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setClearDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={handleConfirmClear}
            >
              Clear timetable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
