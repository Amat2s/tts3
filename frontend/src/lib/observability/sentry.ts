import * as Sentry from '@sentry/react'

/**
 * Frontend Sentry setup (Unit 50).
 *
 * Captures unexpected frontend exceptions only. This is intentionally defensive:
 * when `VITE_SENTRY_DSN` is absent Sentry stays disabled and the app runs
 * normally, and no setup or capture call is ever allowed to throw.
 *
 * Validation results (blocking/warning) and expected API errors are product
 * state, not crashes, so they are never reported here — only render-time
 * exceptions caught by the app error boundary and explicit capture calls.
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
const environment =
  (import.meta.env.VITE_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE

let sentryEnabled = false

export function initSentry(): void {
  if (!dsn) {
    // No DSN configured — Sentry stays disabled; the app runs normally.
    return
  }
  try {
    Sentry.init({
      dsn,
      environment,
      // v1 is crash reporting only: no performance tracing, no session replay,
      // and no personally identifiable information.
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
    sentryEnabled = true
  } catch {
    // Observability setup must never break application startup.
    sentryEnabled = false
  }
}

export function isSentryEnabled(): boolean {
  return sentryEnabled
}

/**
 * Report an unexpected frontend exception. No-op when Sentry is disabled and
 * never throws, so call sites can use it freely from error boundaries.
 */
export function captureUnexpectedError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!sentryEnabled) return
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined)
  } catch {
    // Capturing must never throw.
  }
}
