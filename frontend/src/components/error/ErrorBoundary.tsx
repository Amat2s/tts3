import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureUnexpectedError } from '@/lib/observability/sentry'
import { AppErrorFallback } from './AppErrorFallback'

/**
 * App-level error boundary (Unit 50).
 *
 * Catches unexpected render-time exceptions anywhere inside the app shell,
 * reports them to Sentry (no-op when Sentry is disabled), and shows a safe
 * fallback screen instead of a blank page. This is for *unexpected* crashes
 * only — validation warnings and expected API errors are product state handled
 * inline and never reach this boundary.
 */
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureUnexpectedError(error, { componentStack: info.componentStack })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <AppErrorFallback onReload={this.handleReload} />
    }
    return this.props.children
  }
}
