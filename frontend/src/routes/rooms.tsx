import { useState } from 'react'
import { DoorOpen, Plus } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROOM_TYPES = [
  { value: 'lecture_theatre', label: 'Lecture Theatre' },
  { value: 'seminar_room', label: 'Seminar Room' },
  { value: 'computer_lab', label: 'Computer Lab' },
  { value: 'laboratory', label: 'Laboratory' },
] as const

function RoomForm() {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-1.5">
        <Label htmlFor="room-name">Name</Label>
        <Input id="room-name" placeholder="e.g. Room 101" autoComplete="off" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="room-capacity">Capacity</Label>
        <Input
          id="room-capacity"
          type="number"
          min={1}
          placeholder="e.g. 30"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Room type</Label>
        <Select>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default function RoomsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <AppFrame>
      <PageHeader
        title="Rooms"
        description="Manage teaching rooms. Rooms define the timetable canvas and set capacity constraints."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create room
          </Button>
        }
      />

      <div
        className="rounded-lg border overflow-hidden"
        style={{
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Capacity</TableHead>
              <TableHead className="px-4">Type</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell colSpan={4} className="py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  <DoorOpen
                    className="h-8 w-8"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <div>
                    <p
                      className="text-sm font-medium mb-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      No rooms yet
                    </p>
                    <p
                      className="text-sm max-w-xs mx-auto"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Rooms define the timetable canvas. Add at least one room
                      to display the scheduling grid.
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Create room dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create room</DialogTitle>
            <DialogDescription>
              Add a new teaching room. Rooms define where sessions can be
              scheduled.
            </DialogDescription>
          </DialogHeader>
          <RoomForm />
          <DialogFooter showCloseButton>
            <Button disabled>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit room dialog — row-level trigger wired when real data exists */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>
              Update the details for this room.
            </DialogDescription>
          </DialogHeader>
          <RoomForm />
          <DialogFooter showCloseButton>
            <Button disabled>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog — row-level trigger wired when real data exists */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete room</DialogTitle>
            <DialogDescription>
              This room will be permanently removed. Any sessions scheduled in
              this room will become unscheduled and will need to be
              rescheduled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" disabled>
              Delete room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
