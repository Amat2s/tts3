import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import type { TimetableAssignment } from './assignment'
import type { BlockedCell } from './blocks'
import { BlockCellCard } from './BlockCellCard'
import { ScheduledSessionCard } from './ScheduledSessionCard'
import { getSubjectTokens } from './unitColors'

interface GridCellProps {
  slotId: string
  day: string
  roomId: string
  isDayBoundary?: boolean
  assignment?: TimetableAssignment
  // Excel-export-style tutorial order letter ("Tutorial A") for this cell's
  // assignment, if it is a tutorial. Undefined for lectures.
  tutorialLetter?: string
  // Unit 85: a reserved (blocked) cell, rendered passively below the session
  // layer. Placement validation against blocks lives in lib/validation/blocking.
  blockedCell?: BlockedCell | null
  // Anchor cell: roomSpan > 1 → merged card covering adjacent room columns;
  // slotSpan > 1 → merged card covering consecutive slot rows (like sessions).
  // Non-anchor cells in the same rectangle receive suppressBlockVisual=true.
  blockRoomSpan?: number
  blockSlotSpan?: number
  suppressBlockVisual?: boolean
  isBlockInteractive?: boolean
  onBlockClick?: (blockId: string) => void
  isOccupied?: boolean
  pendingSessionId?: string | null
  hasWarning?: boolean
  // Unit 108: dim this cell's scheduled card (non-matching for the active
  // search). View-only de-emphasis — the card stays in place.
  isDimmed?: boolean
  editingDisabled?: boolean
  isHoverHighlighted?: boolean
  // Unit 86/110: block-selection mode. When active, clicking any cell toggles
  // its membership in the block selection (neutral <-> selected) instead of
  // placing a session; selected cells get a temporary token-based highlight.
  blockSelectionMode?: boolean
  isBlockSelected?: boolean
  onBlockCellSelect?: () => void
  onCellClick?: () => void
  onUnschedule?: (sessionId: string) => void
  onMoveSelect?: (sessionId: string) => void
}

export function GridCell({
  slotId,
  day,
  roomId,
  isDayBoundary = false,
  assignment,
  tutorialLetter,
  blockedCell,
  blockRoomSpan,
  blockSlotSpan,
  suppressBlockVisual = false,
  isBlockInteractive = false,
  onBlockClick,
  isOccupied = !!assignment,
  pendingSessionId,
  hasWarning = false,
  isDimmed = false,
  editingDisabled = false,
  isHoverHighlighted = false,
  blockSelectionMode = false,
  isBlockSelected = false,
  onBlockCellSelect,
  onCellClick,
  onUnschedule,
  onMoveSelect,
}: GridCellProps) {
  const [hovered, setHovered] = useState(false)

  // Droppable ID format matches buildAssignmentMap key: "${day}:${roomId}:${slotId}"
  // isOccupied covers all slots spanned by a multi-slot session, not just the start slot.
  // Drops are also disabled while a solver run is in progress or in block mode.
  const { setNodeRef } = useDroppable({
    id: `${day}:${roomId}:${slotId}`,
    disabled: isOccupied || editingDisabled || blockSelectionMode,
  })

  const isClickDropTarget =
    !blockSelectionMode && !!pendingSessionId && !isOccupied && !editingDisabled
  // Hover highlight is driven by the parent-computed hoverHighlightKeys (valid
  // drag proposals only). Click-based hover uses local mouse state.
  const showDropHighlight = isHoverHighlighted || (isClickDropTarget && hovered)

  function handleClick() {
    if (blockSelectionMode) {
      onBlockCellSelect?.()
      return
    }
    if (isClickDropTarget) {
      onCellClick?.()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className="relative h-14 flex-1 border-r rounded-none"
      data-grid-cell="true"
      data-slot={slotId}
      data-day={day}
      data-room={roomId}
      style={{
        borderRightColor: isDayBoundary
          ? 'var(--grid-line-strong)'
          : 'var(--grid-line)',
        borderBottomColor: 'var(--grid-line)',
        backgroundColor: showDropHighlight
          ? 'var(--grid-cell-hover)'
          : 'var(--bg-surface)',
        cursor:
          isClickDropTarget || blockSelectionMode ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Blocked cell renders below the session layer; a session card (if any)
          stays visually on top via its own higher stacking. In block-selection
          mode the block is non-interactive so clicks fall through to the cell.
          suppressBlockVisual=true means this cell is covered by the merged card
          rendered in the anchor cell to the left; no card is rendered here, but
          the cell remains functionally blocked for validation purposes. */}
      {blockedCell && !assignment && !suppressBlockVisual && (
        <BlockCellCard
          block={blockedCell}
          roomSpan={blockRoomSpan}
          slotSpan={blockSlotSpan}
          // While a session is pending placement (or in block-selection mode),
          // the block overlay lets clicks fall through to the cell so a blocked
          // placement attempt surfaces its reason instead of opening the editor.
          interactive={
            isBlockInteractive && !blockSelectionMode && !pendingSessionId
          }
          onClick={onBlockClick}
        />
      )}
      {assignment && (
        <ScheduledSessionCard
          assignment={assignment}
          tutorialLetter={tutorialLetter}
          colorTokens={getSubjectTokens(assignment.unit_code)}
          isPending={pendingSessionId === assignment.session_id}
          hasWarning={hasWarning}
          isDimmed={isDimmed}
          // In block mode the card must not absorb clicks or drags — block
          // selection over an occupied cell is allowed (it unschedules on save).
          editingDisabled={editingDisabled || blockSelectionMode}
          onUnschedule={() => onUnschedule?.(assignment.session_id)}
          onMoveSelect={() => onMoveSelect?.(assignment.session_id)}
        />
      )}
      {/* Temporary block-selection highlight, above any card and click-through. */}
      {blockSelectionMode && isBlockSelected && (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          data-block-selected="true"
          style={{
            backgroundColor: 'var(--accent-primary-soft)',
            outline: '2px solid var(--accent-primary)',
            outlineOffset: '-2px',
            opacity: 0.65,
          }}
        />
      )}
    </div>
  )
}
