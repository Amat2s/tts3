import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Safe fallback screen for unexpected frontend crashes (Unit 50).
 *
 * Explains that something unexpected happened without exposing technical stack
 * traces, offers a simple reload action, and preserves the app's calm academic
 * visual language using design tokens only.
 */
export function AppErrorFallback({ onReload }: { onReload: () => void }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-md flex flex-col items-center gap-5 rounded-lg border px-8 py-10 text-center"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: 'var(--state-error-bg)',
            color: 'var(--state-error)',
          }}
        >
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h1
            className="text-xl font-semibold"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-serif)',
            }}
          >
            Something went wrong
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            The application ran into an unexpected problem. Your saved timetable
            data is safe. Reloading the page usually resolves this.
          </p>
        </div>
        <Button
          onClick={onReload}
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
          }}
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Reload the page
        </Button>
      </div>
    </div>
  )
}
