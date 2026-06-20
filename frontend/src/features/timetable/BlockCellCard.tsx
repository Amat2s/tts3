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
 * Passive render of a reserved (blocked) timetable cell. Unnamed blocks read
 * as grey/disabled; named blocks show the name and block colour. Blocks are
 * visually distinguished from session cards by the absence of a left border
 * accent and by their dedicated `--block-*` colour tokens.
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

  // Each GridCell has `border-right: 1px` with `box-sizing: border-box`, so
  // `100%` for an absolutely positioned child equals the cell content width
  // (total width W minus 1 px). For N rooms the needed visual span is
  // N*W - 1px, but N*100% = N*(W-1px) = N*W - N*px, leaving a (N-1)px gap.
  // Adding (roomSpan - 1)px corrects for the internal cell borders.
  const widthStyle =
    roomSpan > 1
      ? { width: `calc(${roomSpan * 100}% + ${roomSpan - 1}px)`, right: 'auto' as const }
      : undefined

  return (
    <div
      className="absolute inset-0 z-10 flex items-center overflow-hidden rounded-none border px-1.5 select-none"
      data-block-cell="true"
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        color: tokens.text,
        cursor: interactive ? 'pointer' : 'default',
        ...widthStyle,
      }}
      title={block.name ?? 'Blocked'}
      onClick={handleClick}
    >
      {block.name ? (
        <span className="truncate text-xs font-medium">{block.name}</span>
      ) : (
        <span className="sr-only">Blocked</span>
      )}
    </div>
  )
}
