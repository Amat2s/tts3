import { useDraggable } from '@dnd-kit/core'
import { AlertTriangle, X } from 'lucide-react'
import type { TimetableAssignment } from './assignment'
import type { UnitColorTokens } from './unitColors'
import { slotSpanHeight } from './slots'
import { getLecturerInitials } from '@/lib/lecturerInitials'

interface ScheduledSessionCardProps {
  assignment: TimetableAssignment
  colorTokens: UnitColorTokens
  // Excel-export-style order letter ("Tutorial A" / "Seminar A"); undefined
  // for lectures or when this is the only tutorial/seminar in its unit.
  // Tutorial and seminar letters are independent per-unit series (Unit 116)
  // computed by the caller and merged into one map since a session is never
  // both types at once.
  orderLetter?: string
  isPending?: boolean
  hasWarning?: boolean
  // Unit 108: fade this card when it does not match the active session search.
  // A view-only focus aid — the card keeps its place and stays interactive.
  isDimmed?: boolean
  editingDisabled?: boolean
  onUnschedule?: () => void
  onMoveSelect?: () => void
}

// Matches the Unit 93 Excel export's session label format exactly
// ("HIS101 Lecture (SC)" / "THE202 Tutorial A (LH)") so the grid and the
// exported timetable read the same way. See `_session_label` in
// services/timetable_excel_export.py. Seminars (Unit 116) follow the
// identical "Seminar{ letter} (initials)" pattern as tutorials.
function sessionTypeLabel(assignment: TimetableAssignment, orderLetter?: string): string {
  const initials = getLecturerInitials(assignment.lecturer_display_name)
  if (assignment.session_type === 'tutorial') {
    const suffix = orderLetter ? ` ${orderLetter}` : ''
    return `Tutorial${suffix} (${initials})`
  }
  if (assignment.session_type === 'seminar') {
    const suffix = orderLetter ? ` ${orderLetter}` : ''
    return `Seminar${suffix} (${initials})`
  }
  return `Lecture (${initials})`
}

export function ScheduledSessionCard({
  assignment,
  colorTokens,
  orderLetter,
  isPending = false,
  hasWarning = false,
  isDimmed = false,
  editingDisabled = false,
  onUnschedule,
  onMoveSelect,
}: ScheduledSessionCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: assignment.session_id,
    data: { sessionId: assignment.session_id },
    disabled: editingDisabled,
  })

  function handleUnschedule(e: React.MouseEvent) {
    e.stopPropagation()
    onUnschedule?.()
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="absolute inset-x-0 top-0 rounded-md border overflow-hidden z-10 px-1.5 py-1 flex flex-col gap-0.5 select-none"
      style={{
        height: slotSpanHeight(assignment.duration),
        backgroundColor: colorTokens.background,
        borderColor: hasWarning ? 'var(--state-warning)' : colorTokens.border,
        borderLeftWidth: '4px',
        outline: isPending ? `2px solid ${colorTokens.border}` : undefined,
        outlineOffset: isPending ? '1px' : undefined,
        // Dragging and pending states keep their existing emphasis; otherwise a
        // non-matching (dimmed) card fades to de-emphasise it without hiding it.
        opacity: isDragging ? 0.3 : isPending ? 0.8 : isDimmed ? 0.4 : 1,
        cursor: editingDisabled ? 'default' : 'pointer',
      }}
      onClick={editingDisabled ? undefined : onMoveSelect}
    >
      <div className="flex items-start justify-between gap-0.5 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
          <span
            className="text-[0.65rem] font-semibold shrink-0"
            style={{ color: colorTokens.text }}
          >
            {assignment.unit_code}
          </span>
          <span
            className="text-[0.65rem] truncate"
            style={{ color: 'var(--text-muted)' }}
          >
            {sessionTypeLabel(assignment, orderLetter)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {!editingDisabled && (
            <button
              className="flex items-center justify-center h-4 w-4 rounded-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleUnschedule}
              title="Unschedule"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      {assignment.duration > 1 && (
        <span
          className="text-[0.6rem]"
          style={{ color: 'var(--text-muted)' }}
        >
          {assignment.student_count} student{assignment.student_count !== 1 ? 's' : ''}
        </span>
      )}
      {/* Warning marker sits at the bottom of the card so it never overlaps the
          top-right unschedule (✕) button. */}
      {hasWarning && (
        <AlertTriangle
          className="absolute bottom-1 right-1 h-3 w-3"
          style={{ color: 'var(--state-warning)' }}
          aria-label="Scheduling warning"
        />
      )}
    </div>
  )
}
