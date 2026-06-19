import { Lock } from 'lucide-react'
import { getBlockColorTokens, type BlockedCell } from './blocks'

interface BlockCellCardProps {
  block: BlockedCell
  // When interactive, the whole cell is clickable (opens the block editor).
  interactive?: boolean
  onClick?: (blockId: string) => void
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
