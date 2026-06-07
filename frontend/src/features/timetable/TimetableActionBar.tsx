export function TimetableActionBar() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Validation status and solver controls will appear here.
      </p>
    </div>
  )
}
