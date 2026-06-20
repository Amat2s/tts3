import { Lock } from 'lucide-react'
import { getBlockColorTokens, type BlockedCell } from './blocks'

interface BlockCellCardProps {
  block: BlockedCell
  // When interactive, the whole cell is clickable (opens the block editor).
  interactive?: boolean
  onClick?: (blockId: string) => void
  // Number of adjacent room columns this card should visually span. When > 1
  // the card overflows its parent cell to cover the suppressed cells to the
  // right, creating a single connected merged block per slot row.
  roomSpan?: number
}

/**
 * Passive render of a reserved (blocked) timetable cell. Unnamed blocks read as
 * grey/disabled with just a lock icon; named blocks show the lock icon, the
 * name, and the block colour. Never relies on colour alone — the lock icon is
 * always present (Design Invariant 11).
 */
export function BlockCellCard({
  block,
  interactive = false,
  onClick,
  roomSpan = 1,
}: BlockCellCardProps) {
  const tokens = getBlockColorTokens(block.colour)

  function handleClick(e: React.MouseEvent) {
    if (!interactive) return
    e.stopPropagation()
    onClick?.(block.blockId)
  }

  return (
    <div
      className="absolute inset-0 z-10 flex items-center gap-1 overflow-hidden rounded-none border px-1.5 select-none"
      data-block-cell="true"
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        borderLeftWidth: '3px',
        color: tokens.text,
        cursor: interactive ? 'pointer' : 'default',
        // Span multiple room columns: override the right:0 from inset-0 by
        // setting an explicit width. CSS resolves the over-constrained case
        // (left + width + right all set) by ignoring `right` for LTR layouts.
        ...(roomSpan > 1 && { width: `${roomSpan * 100}%`, right: 'auto' }),
      }}
      title={block.name ?? 'Blocked'}
      onClick={handleClick}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {block.name ? (
        <span className="truncate text-xs font-medium">{block.name}</span>
      ) : (
        <span className="sr-only">Blocked</span>
      )}
    </div>
  )
}
