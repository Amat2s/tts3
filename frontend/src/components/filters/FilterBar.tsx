import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Layout row for management-page search + filter controls. Renders its children
 * inline and shows a `Clear filters` action only when at least one filter is
 * active. An optional `trailing` node is pinned to the far right of the row
 * (e.g. a `Delete all` action). Does not own any filter state — callers pass
 * `isActive`/`onClear`.
 */
export function FilterBar({
  children,
  isActive,
  onClear,
  trailing,
}: {
  children: ReactNode
  isActive: boolean
  onClear: () => void
  trailing?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {children}
      {isActive && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  )
}
