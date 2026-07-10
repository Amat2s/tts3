import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TimetableBlockColour } from '@/lib/api/timetableBlocks'
import { getBlockColorTokens } from './blocks'
import type { DraftBlock } from './draftBlocks'

interface BlockEditDialogProps {
  // Unit 109: the block being edited now lives in the unsaved draft, not the
  // backend. Only its name/colour are edited here; cells are preserved by the
  // parent and the change is persisted with the rest of the draft on Save.
  block: DraftBlock | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { name: string | null; colour: TimetableBlockColour | null }) => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
  error: string | null
}

const COLOUR_OPTIONS: { value: TimetableBlockColour; label: string }[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'light_blue', label: 'Light blue' },
  { value: 'light_pink', label: 'Light pink' },
]

/**
 * Basic existing-block management (Unit 85): edit a block's name/colour or
 * delete it. Cell re-selection is intentionally not offered here — the saved
 * cells are preserved on update by the parent. A named block requires a colour;
 * clearing the name makes the block unnamed and drops its colour.
 */
export function BlockEditDialog({
  block,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  error,
}: BlockEditDialogProps) {
  // Seeded from the block prop. The parent remounts this dialog via a `key` on
  // the block id, so each opened block gets fresh form state without an effect.
  const [name, setName] = useState(block?.name ?? '')
  const [colour, setColour] = useState<TimetableBlockColour>(
    block?.colour ?? 'gold'
  )

  const trimmedName = name.trim()
  const isNamed = trimmedName.length > 0
  const busy = isSaving || isDeleting

  function handleSave() {
    if (busy) return
    onSave({
      name: isNamed ? trimmedName : null,
      colour: isNamed ? colour : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit timetable block</DialogTitle>
          <DialogDescription>
            Rename or recolour this reserved block, or remove it to free its
            cells. An unnamed block renders grey.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-name">Name</Label>
            <Input
              id="block-name"
              value={name}
              placeholder="Leave blank for an unnamed block"
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>

          {isNamed && (
            <div className="flex flex-col gap-1.5">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLOUR_OPTIONS.map((option) => {
                  const tokens = getBlockColorTokens(option.value)
                  const selected = colour === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={busy}
                      onClick={() => setColour(option.value)}
                      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium"
                      style={{
                        backgroundColor: tokens.background,
                        borderColor: tokens.border,
                        color: tokens.text,
                        outline: selected ? `2px solid ${tokens.border}` : undefined,
                        outlineOffset: selected ? '1px' : undefined,
                      }}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: 'var(--state-error)' }} role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="border-[var(--state-error)] text-[var(--state-error)] hover:bg-[var(--state-error-bg)] hover:text-[var(--state-error)]"
          >
            {isDeleting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Delete block
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-primary-hover)]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
