import { getBlockColorTokens, type BlockedCell } from './blocks'

interface BlockCellCardProps {
  block: BlockedCell
  // When interactive, the whole cell is clickable (opens the block editor).
  interactive?: boolean
  onClick?: (blockId: string) => void
  // Number of adjacent room columns this card should visually span (horizontal).
  roomSpan?: number
  // Number of consecutive slot rows this card should visually span (vertical),
  // mirroring the height mechanism used by ScheduledSessionCard.
  slotSpan?: number
}

/**
 * Passive render of a reserved (blocked) timetable cell. Unnamed blocks read
 * as grey/disabled; named blocks show the name and block colour. Blocks are
 * visually distinguished from session cards by the absence of a left border
 * accent and by their dedicated `--block-*` colour tokens.
 */
// Must match the h-14 (3.5rem) used in GridCell, same as ScheduledSessionCard.
const CELL_HEIGHT_REM = 3.5

export function BlockCellCard({
  block,
  interactive = false,
  onClick,
  roomSpan = 1,
  slotSpan = 1,
}: BlockCellCardProps) {
  const tokens = getBlockColorTokens(block.colour)

  function handleClick(e: React.MouseEvent) {
    if (!interactive) return
    e.stopPropagation()
    onClick?.(block.blockId)
  }

  // Horizontal span: each GridCell has border-right: 1px (border-box), so
  // 100% = cell content width = W - 1px. For N rooms the visual span is
  // N*W - 1px, but N*100% = N*(W-1px) = N*W - N*px → (N-1)px short.
  // Adding (roomSpan - 1)px corrects for the internal cell borders.
  //
  // Vertical span: row borders live on the row flex-div, not on GridCell,
  // so 100% = full cell height = 3.5rem. calc(N * 3.5rem) matches the span
  // used by ScheduledSessionCard and is correct without a pixel correction.
  const spanStyle: React.CSSProperties = {
    ...(roomSpan > 1 && {
      width: `calc(${roomSpan * 100}% + ${roomSpan - 1}px)`,
      right: 'auto',
    }),
    ...(slotSpan > 1 && {
      height: `calc(${slotSpan} * ${CELL_HEIGHT_REM}rem)`,
      bottom: 'auto',
    }),
  }

  return (
    <div
      className="absolute inset-0 z-10 flex items-center overflow-hidden rounded-none border px-1.5 select-none"
      data-block-cell="true"
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
        color: tokens.text,
        cursor: interactive ? 'pointer' : 'default',
        ...spanStyle,
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
