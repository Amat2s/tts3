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
  // Unit 103: whether the grid is rendered in the wider extended layout. The
  // contracted (default) layout halves the coloured left border so it stays
  // proportional in the narrower cells.
  extended?: boolean
  onUnschedule?: () => void
  onMoveSelect?: () => void
}

// Abbreviated session-type line for the stacked card layout: LEC / TUT / SEM
// plus the Unit 93/116 order letter when present ("TUT A", "SEM B"). The full
// export label ("Tutorial A (SC)") still lives in the Excel export; the on-card
// text is condensed so it fits the narrow grid cell across three stacked lines.
function sessionTypeAbbrev(assignment: TimetableAssignment, orderLetter?: string): string {
  const base =
    assignment.session_type === 'tutorial'
      ? 'TUT'
      : assignment.session_type === 'seminar'
        ? 'SEM'
        : 'LEC'
  return orderLetter ? `${base} ${orderLetter}` : base
}

export function ScheduledSessionCard({
  assignment,
  colorTokens,
  orderLetter,
  isPending = false,
  hasWarning = false,
  isDimmed = false,
  editingDisabled = false,
  extended = false,
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
      className="group absolute inset-x-0 top-0 rounded-md border overflow-hidden z-10 px-1 py-0.5 flex flex-col gap-0 items-center text-center select-none"
      style={{
        height: slotSpanHeight(assignment.duration),
        backgroundColor: colorTokens.background,
        borderColor: hasWarning ? 'var(--state-warning)' : colorTokens.border,
        // Contracted view halves the coloured left accent so it stays in
        // proportion with the narrower cells; extended keeps the full 4px.
        borderLeftWidth: extended ? '4px' : '2px',
        outline: isPending ? `2px solid ${colorTokens.border}` : undefined,
        outlineOffset: isPending ? '1px' : undefined,
        // Dragging and pending states keep their existing emphasis; otherwise a
        // non-matching (dimmed) card fades to de-emphasise it without hiding it.
        opacity: isDragging ? 0.3 : isPending ? 0.8 : isDimmed ? 0.4 : 1,
        cursor: editingDisabled ? 'default' : 'pointer',
        // Make the card its own query container so the stacked text below can be
        // sized in `cqw` (percent of cell width). The font then auto-shrinks in
        // the contracted grid and grows (capped) in the extended grid, so the
        // 6-char unit code always fits at any column width — no `extended` prop.
        containerType: 'inline-size',
      }}
      onClick={editingDisabled ? undefined : onMoveSelect}
    >
      {/* Three stacked lines: unit code / type (LEC·TUT·SEM [letter]) /
          (initials). Sized in cqw so they scale with the cell width; the unit
          code is the widest line, so sizing it to fit guarantees the rest fit.
          The unschedule cross is absolutely positioned (below), so at rest the
          text spans the full width and is never pushed aside by it. */}
      <span
        className="max-w-full font-semibold leading-tight truncate"
        style={{
          color: colorTokens.text,
          fontSize: 'clamp(0.3rem, 19cqw, 0.72rem)',
        }}
      >
        {assignment.unit_code}
      </span>
      <span
        className="max-w-full leading-tight truncate"
        style={{
          color: 'var(--text-muted)',
          fontSize: 'clamp(0.28rem, 16cqw, 0.6rem)',
        }}
      >
        {sessionTypeAbbrev(assignment, orderLetter)}
      </span>
      <span
        className="max-w-full leading-tight truncate"
        style={{
          color: 'var(--text-muted)',
          fontSize: 'clamp(0.28rem, 16cqw, 0.6rem)',
        }}
      >
        ({getLecturerInitials(assignment.lecturer_display_name)})
      </span>
      {assignment.duration > 1 && (
        <span
          className="max-w-full leading-tight truncate"
          style={{
            color: 'var(--text-muted)',
            fontSize: 'clamp(0.28rem, 15cqw, 0.58rem)',
          }}
        >
          {assignment.student_count} student{assignment.student_count !== 1 ? 's' : ''}
        </span>
      )}
      {!editingDisabled && (
        <button
          // The unschedule cross stays hidden until the card is hovered,
          // keyboard-focused, or selected for a move (isPending), so resting
          // cards read cleanly. opacity (not display) keeps it focusable.
          // Absolutely positioned so it overlays the corner instead of
          // reserving layout width — the text keeps the full width when hidden.
          className={`absolute top-0.5 right-0.5 z-20 flex items-center justify-center h-4 w-4 rounded-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${
            isPending ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            color: 'var(--text-muted)',
            backgroundColor: colorTokens.background,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleUnschedule}
          title="Unschedule"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {/* Warning marker sits at the bottom-right so it never overlaps the
          top-right unschedule (✕) button or the left-aligned text lines. */}
      {hasWarning && (
        <AlertTriangle
          className="absolute bottom-0.5 right-0.5 h-3 w-3"
          style={{ color: 'var(--state-warning)' }}
          aria-label="Scheduling warning"
        />
      )}
    </div>
  )
}
