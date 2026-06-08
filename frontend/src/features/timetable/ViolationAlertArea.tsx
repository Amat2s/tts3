import { useState } from 'react'
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import type { ConstraintViolation } from './violations'

interface ViolationAlertAreaProps {
  violations: ConstraintViolation[]
}

export function ViolationAlertArea({ violations }: ViolationAlertAreaProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  if (violations.length === 0) return null

  const errors = violations.filter(v => v.severity === 'error')
  const warnings = violations.filter(v => v.severity === 'warning')

  return (
    <div className="flex flex-col gap-2" role="alert" aria-live="polite">
      {/* Error summary */}
      {errors.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg border"
          style={{
            borderColor: 'var(--state-error)',
            backgroundColor: 'var(--state-error-bg)',
          }}
        >
          <TriangleAlert
            className="h-4 w-4 shrink-0 mt-0.5"
            style={{ color: 'var(--state-error)' }}
            aria-hidden="true"
          />
          <p className="text-sm font-medium" style={{ color: 'var(--state-error)' }}>
            {errors.length} constraint error{errors.length !== 1 ? 's' : ''} — some sessions cannot be placed in their current positions.
          </p>
        </div>
      )}

      {/* Warning summary */}
      {warnings.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-lg border"
          style={{
            borderColor: 'var(--state-warning)',
            backgroundColor: 'var(--state-warning-bg)',
          }}
        >
          <TriangleAlert
            className="h-4 w-4 shrink-0 mt-0.5"
            style={{ color: 'var(--state-warning)' }}
            aria-hidden="true"
          />
          <p className="text-sm font-medium" style={{ color: 'var(--state-warning)' }}>
            {warnings.length} constraint warning{warnings.length !== 1 ? 's' : ''} — some scheduling preferences are not satisfied.
          </p>
        </div>
      )}

      {/* Violation details panel */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          onClick={() => setDetailsExpanded(v => !v)}
          aria-expanded={detailsExpanded}
          aria-controls="violation-details"
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Violation details ({violations.length})
          </span>
          {detailsExpanded ? (
            <ChevronDown
              className="h-4 w-4"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="h-4 w-4"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
          )}
        </button>

        {detailsExpanded && (
          <div
            id="violation-details"
            className="border-t px-4 py-3 flex flex-col gap-2"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {violations.map((v, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <TriangleAlert
                  className="h-3.5 w-3.5 shrink-0 mt-0.5"
                  style={{
                    color: v.severity === 'error' ? 'var(--state-error)' : 'var(--state-warning)',
                  }}
                  aria-hidden="true"
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="sr-only">{v.severity === 'error' ? 'Error: ' : 'Warning: '}</span>
                  {v.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
