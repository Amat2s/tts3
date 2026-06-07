import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="rounded-lg border py-16 flex flex-col items-center text-center"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      {icon && (
        <div className="mb-4" style={{ color: 'var(--text-muted)' }}>
          {icon}
        </div>
      )}
      <p
        className="text-sm font-medium mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </p>
      {description && (
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
