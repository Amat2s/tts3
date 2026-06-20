import { Loader2, Lock } from 'lucide-react'
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
import type {
  BlockCellInput,
  TimetableBlockColour,
} from '@/lib/api/timetableBlocks'
import { slotLabel } from '@/lib/slot-label'
import { SLOT_INDEX } from '@/lib/validation/slot-helpers'
import { getBlockColorTokens } from './blocks'
import type { RoomColumn } from './TimetableGrid'

interface BlockCreateDialogProps {
  open: boolean
  // The cells the admin selected to reserve. Always at least one when the dialog
  // is open; saved individually as `{ day, slot, room_id }`.
  cells: BlockCellInput[]
  rooms: RoomColumn[]
  onOpenChange: (open: boolean) => void
  onCreate: (input: {
    name: string | null
    colour: TimetableBlockColour | null
  }) => void
  isSaving: boolean
  error: string | null
}

const COLOUR_OPTIONS: { value: TimetableBlockColour; label: string }[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'light_blue', label: 'Light blue' },
  { value: 'light_pink', label: 'Light pink' },
]

// A concise day/time/room summary built from human slot labels — never raw slot
// IDs. Distinct slots are sorted in timetable order; distinct rooms keep their
// column order.
function buildSummary(cells: BlockCellInput[], rooms: RoomColumn[]) {
  const day = cells[0]?.day ?? ''

  const slotSet = new Set(cells.map((c) => c.slot))
  const slots = [...slotSet]
    .sort((a, b) => SLOT_INDEX[a] - SLOT_INDEX[b])
    .map((s) => slotLabel(s))

  const roomNameById = new Map(rooms.map((r) => [r.id, r.name]))
  const roomIds = new Set(cells.map((c) => c.room_id))
  const roomNames = rooms
    .filter((r) => roomIds.has(r.id))
    .map((r) => roomNameById.get(r.id) ?? r.id)

  return { day, slots, roomNames }
}

/**
 * Create a new timetable block from the selected cells (Unit 86). The name is
 * optional; the colour selector appears only when a name is entered. A blank
 * name persists an unnamed (colourless) block; a named block defaults to gold.
 */
export function BlockCreateDialog({
  open,
  cells,
  rooms,
  onOpenChange,
  onCreate,
  isSaving,
  error,
}: BlockCreateDialogProps) {
  const [name, setName] = useState('')
  const [colour, setColour] = useState<TimetableBlockColour>('gold')

  const trimmedName = name.trim()
  const isNamed = trimmedName.length > 0

  const { day, slots, roomNames } = buildSummary(cells, rooms)

  function handleCreate() {
    if (isSaving) return
    onCreate({
      name: isNamed ? trimmedName : null,
      colour: isNamed ? colour : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block selected slots</DialogTitle>
          <DialogDescription>
            Reserve the selected cells so no session can be scheduled there. Leave
            the name blank for an unnamed block; named blocks can be coloured.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Selected day/time/room summary */}
          <div
            className="flex flex-col gap-1.5 rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--text-secondary)',
            }}
          >
            <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {cells.length} cell{cells.length !== 1 ? 's' : ''} selected
            </div>
            <div>
              <span className="font-medium">Day:</span> {day}
            </div>
            <div>
              <span className="font-medium">Time:</span> {slots.join(', ')}
            </div>
            <div>
              <span className="font-medium">
                Room{roomNames.length !== 1 ? 's' : ''}:
              </span>{' '}
              {roomNames.join(', ')}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-create-name">Name</Label>
            <Input
              id="block-create-name"
              value={name}
              placeholder="Leave blank for an unnamed block"
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
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
                      disabled={isSaving}
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

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving}
            onClick={handleCreate}
            className="bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-primary-hover)]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              'Create block'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
