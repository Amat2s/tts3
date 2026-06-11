import { AlertTriangle, ChevronDown, ChevronUp, Cpu, Loader2, Save, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface TimetableActionBarProps {
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  blockingError?: string | null
  violationMessages?: string[]
  warningMessages?: string[]
  canRunSolver?: boolean
  onSave: () => void
  onRunSolver?: () => void
  isPendingPlacement?: boolean
}

export function TimetableActionBar({
  isDirty,
  isSaving,
  saveError,
  blockingError,
  violationMessages = [],
  warningMessages = [],
  canRunSolver = true,
  onSave,
  onRunSolver,
  isPendingPlacement = false,
}: TimetableActionBarProps) {
  const [showDetails, setShowDetails] = useState(false)

  const violationCount = violationMessages.length
  const warningCount = warningMessages.length
  const totalIssues = violationCount + warningCount
  const hasIssues = totalIssues > 0

  function solverBlockedReason(): string | null {
    if (canRunSolver) return null
    const parts: string[] = []
    if (violationCount > 0) {
      parts.push(`${violationCount} blocking violation${violationCount !== 1 ? 's' : ''}`)
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} scheduling warning${warningCount !== 1 ? 's' : ''}`)
    }
    if (parts.length === 0) return null
    return `${parts.join(' and ')} must be resolved before running the solver`
  }

  const blockedReason = solverBlockedReason()

  return (
    <div
      className="rounded-lg border"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {saveError && (
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {saveError}
            </p>
          )}
          {!saveError && blockingError && (
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              Cannot place session: {blockingError}
            </p>
          )}
          {!saveError && !blockingError && isPendingPlacement && (
            <p className="text-sm" style={{ color: 'var(--accent-primary)' }}>
              Session selected — click an empty cell to place it, or click the session again to cancel.
            </p>
          )}
          {!saveError && !blockingError && !isPendingPlacement && !canRunSolver && blockedReason && (
            <span
              className="flex items-center gap-1.5 text-sm"
              style={{ color: violationCount > 0 ? 'var(--state-error)' : 'var(--state-warning)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {blockedReason}
            </span>
          )}
          {!saveError && !blockingError && !isPendingPlacement && canRunSolver && isDirty && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Unsaved changes
            </p>
          )}
          {!saveError && !blockingError && !isPendingPlacement && canRunSolver && !isDirty && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No issues — timetable is ready.
            </p>
          )}

          {hasIssues && (
            <button
              className="flex items-center gap-1 text-xs underline shrink-0"
              style={{ color: 'var(--text-muted)' }}
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

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            disabled={!canRunSolver}
            title={blockedReason ?? undefined}
            onClick={canRunSolver ? onRunSolver : undefined}
            style={
              canRunSolver
                ? {
                    backgroundColor: 'var(--solver-accent)',
                    color: 'var(--text-inverse)',
                  }
                : undefined
            }
          >
            <Cpu className="h-3.5 w-3.5 mr-1.5" />
            Run Solver
          </Button>

          <Button
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={onSave}
            style={
              isDirty && !isSaving
                ? {
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--text-inverse)',
                  }
                : undefined
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Timetable
              </>
            )}
          </Button>
        </div>
      </div>

      {showDetails && hasIssues && (
        <div
          className="border-t px-4 py-3 flex flex-col gap-3"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-muted)',
          }}
        >
          {violationCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--state-error)' }}>
                Blocking violations — {violationCount}
              </p>
              <ul className="flex flex-col gap-1">
                {violationMessages.map((msg, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs"
                    style={{ color: 'var(--state-error)' }}
                  >
                    <XCircle className="h-3 w-3 shrink-0 mt-0.5" />
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--state-warning)' }}>
                Scheduling warnings — {warningCount}
              </p>
              <ul className="flex flex-col gap-1">
                {warningMessages.map((msg, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs"
                    style={{ color: 'var(--state-warning)' }}
                  >
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
