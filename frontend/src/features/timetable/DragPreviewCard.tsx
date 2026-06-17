import type { SchedulableSession } from '@/lib/api/sessions'
import { GRID_ROW_HEIGHT_PX, type TimetableGridMetrics } from './hoverHighlight'
import { getSubjectTokens } from './unitColors'

const SESSION_TYPE_LABEL: Record<string, string> = {
  lecture: 'Lec',
  tutorial: 'Tut',
}

const FALLBACK_CELL_WIDTH = 200

interface DragPreviewCardProps {
  session: SchedulableSession
  metrics: TimetableGridMetrics | null
}

/**
 * Drag preview card rendered in the DragOverlay.
 * Matches the visual shape of a scheduled session card — same dimensions,
 * subject colours, and compact content density.
 */
export function DragPreviewCard({ session, metrics }: DragPreviewCardProps) {
  const colorTokens = getSubjectTokens(session.unit_code)
  const cellWidth = metrics?.cellWidth ?? FALLBACK_CELL_WIDTH
  const rowHeight = metrics?.rowHeight ?? GRID_ROW_HEIGHT_PX

  return (
    <div
      data-testid="drag-preview-card"
      className="rounded-md border overflow-hidden px-1.5 py-1 flex flex-col gap-0.5 select-none shadow-lg"
      style={{
        width: `${cellWidth}px`,
        height: `${rowHeight * session.duration}px`,
        backgroundColor: colorTokens.background,
        borderColor: colorTokens.border,
        borderLeftWidth: '4px',
        opacity: 0.92,
      }}
    >
      <div className="flex items-start justify-between gap-0.5 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
          <span
            className="text-xs font-semibold shrink-0"
            style={{ color: colorTokens.text }}
          >
            {session.unit_code}
          </span>
          <span
            className="text-xs shrink-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {SESSION_TYPE_LABEL[session.session_type] ?? session.session_type}
          </span>
        </div>
      </div>
      <span
        className="text-xs truncate"
        style={{ color: 'var(--text-secondary)' }}
      >
        {session.lecturer_display_name}
      </span>
      {session.duration > 1 && (
        <span
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {session.student_count} student{session.student_count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}
