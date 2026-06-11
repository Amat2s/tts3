import { CheckCircle, Loader2, TriangleAlert } from 'lucide-react'
import type { ConstraintViolation } from './violations'

interface TimetableActionBarProps {
  violations?: ConstraintViolation[]
  validationLoading?: boolean
  validationError?: string
  solverBlocked?: string
}

export function TimetableActionBar({
  violations = [],
  validationLoading,
  validationError,
  solverBlocked,
}: TimetableActionBarProps) {
  const errorCount = violations.filter(v => v.severity === 'error').length
  const warningCount = violations.filter(v => v.severity === 'warning').length
  const hasViolations = violations.length > 0

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        {/* Compact validation status */}
        <div className="flex items-center gap-2" role="status" aria-label="Validation status">
          {validationLoading ? (
            <>
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin"
                style={{ color: 'var(--text-muted)' }}
                aria-hidden="true"
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Validating…
              </span>
            </>
          ) : validationError ? (
            <>
              <TriangleAlert
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--state-warning)' }}
                aria-hidden="true"
              />
              <span className="text-sm" style={{ color: 'var(--state-warning)' }}>
                Validation unavailable
              </span>
            </>
          ) : hasViolations ? (
            <>
              <TriangleAlert
                className="h-4 w-4 shrink-0"
                style={{ color: errorCount > 0 ? 'var(--state-error)' : 'var(--state-warning)' }}
                aria-hidden="true"
              />
              <span
                className="text-sm font-medium"
                style={{ color: errorCount > 0 ? 'var(--state-error)' : 'var(--state-warning)' }}
              >
                {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                {errorCount > 0 && warningCount > 0 && ', '}
                {warningCount > 0 && `${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              </span>
            </>
          ) : (
            <>
              <CheckCircle
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--state-success)' }}
                aria-hidden="true"
              />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No violations
              </span>
            </>
          )}
        </div>

        {/* Solver controls area — reserved for Unit 37+ */}
        <div className="shrink-0" />
      </div>

      {/* Solver-blocked message area — reserved for Unit 37+ */}
      {solverBlocked && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg border"
          style={{
            borderColor: 'var(--state-warning)',
            backgroundColor: 'var(--state-warning-bg)',
          }}
          role="alert"
        >
          <TriangleAlert
            className="h-4 w-4 shrink-0 mt-0.5"
            style={{ color: 'var(--state-warning)' }}
            aria-hidden="true"
          />
          <p className="text-sm" style={{ color: 'var(--state-warning)' }}>
            {solverBlocked}
          </p>
        </div>
      )}
    </div>
  )
}
