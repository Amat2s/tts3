import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TimetableActionBarProps {
  isDirty: boolean
  isSaving: boolean
  hasDraftAssignments: boolean
  saveError: string | null
  blockingError?: string | null
  violationMessages?: string[]
  warningMessages?: string[]
  canRunSolver: boolean
  /** Full reason the solver cannot run, or null when it can. */
  solverDisabledReason: string | null
  /** True while a solver run is starting or active. */
  editingDisabled?: boolean
  onClearAll: () => void
  onSave: () => void
  onRunSolver?: () => void
  isPendingPlacement?: boolean
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
}: TimetableActionBarProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const violationCount = violationMessages.length
  const warningCount = warningMessages.length
  const totalIssues = violationCount + warningCount
  const hasIssues = totalIssues > 0
  const reasonColor =
    violationCount > 0
      ? 'var(--state-error)'
      : warningCount > 0
        ? 'var(--state-warning)'
        : 'var(--text-muted)'
  const reasonHasValidationIssue = violationCount > 0 || warningCount > 0

  function handleConfirmClear() {
    onClearAll()
    setClearDialogOpen(false)
  }

  return (
    <>
      <div
        data-testid="timetable-action-bar"
        className="sticky top-4 z-30 rounded-lg border shadow-sm"
        style={{
          borderColor: 'var(--border-strong)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div
              className="min-w-0"
              role={saveError ? 'alert' : 'status'}
              aria-live={saveError ? 'assertive' : 'polite'}
            >
              {saveError ? (
                <p className="text-sm" style={{ color: 'var(--state-error)' }}>
                  {saveError}
                </p>
              ) : blockingError ? (
                <p className="text-sm" style={{ color: 'var(--state-error)' }}>
                  Cannot place session: {blockingError}
                </p>
              ) : editingDisabled ? (
                <span
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: 'var(--solver-accent)' }}
                >
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  Editing is disabled while the solver runs.
                </span>
              ) : isPendingPlacement ? (
                <p
                  className="text-sm"
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Session selected - click an empty cell to place it, or click
                  the session again to cancel.
                </p>
              ) : !canRunSolver && solverDisabledReason ? (
                <span
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: reasonColor }}
                >
                  {reasonHasValidationIssue && (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {solverDisabledReason}
                </span>
              ) : isDirty ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Unsaved changes
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No issues - timetable is ready.
                </p>
              )}
            </div>

            {hasIssues && (
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 text-xs underline"
                style={{ color: 'var(--text-muted)' }}
                aria-expanded={showDetails}
                aria-controls="timetable-validation-details"
                onClick={() => setShowDetails((value) => !value)}
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

        {showDetails && hasIssues && (
          <div
            id="timetable-validation-details"
            className="flex h-36 flex-col gap-3 overflow-y-auto border-t px-4 py-3"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-muted)',
            }}
          >
            {violationCount > 0 && (
              <div className="flex flex-col gap-1.5">
                <p
                  className="text-xs font-semibold"
                  style={{ color: 'var(--state-error)' }}
                >
                  Blocking violations - {violationCount}
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
                  Scheduling warnings - {warningCount}
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
