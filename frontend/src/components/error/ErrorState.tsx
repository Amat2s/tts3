import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Shared inline error display for API/load failures (Unit 50).
 *
 * Standardizes how query/load errors surface across the app: an actionable,
 * non-technical message with a warning icon (never color alone) and an optional
 * retry action. Token-driven so it matches the calm academic visual language.
 *
 * This is for *system/API* errors. Validation warnings and blocking validation
 * feedback are product state and must not be rendered through this component.
 */
interface ErrorStateProps {
  /** Short, actionable explanation of what failed. */
  message: string
  /** Optional bold lead-in shown before the message. */
  title?: string
  /** Optional retry handler — renders a "Try again" action when provided. */
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  message,
  title,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${className ?? ''}`}
      style={{
        borderColor: 'var(--state-error)',
        backgroundColor: 'var(--state-error-bg)',
      }}
      role="alert"
    >
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--state-error)' }}>
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && (
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--state-error)' }}
          >
            {title}
          </p>
        )}
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          className="shrink-0 flex items-center gap-1 text-sm underline"
          style={{ color: 'var(--state-error)' }}
          onClick={onRetry}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  )
}
