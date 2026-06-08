import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, Plus, Pencil, Trash2 } from 'lucide-react'
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
import {
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom as deleteRoomApi,
} from '@/lib/api/rooms'
import type { Room, RoomType, RoomUpdate } from '@/lib/api/rooms'

const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: 'lecture', label: 'Lecture Theatre' },
  { value: 'tutorial', label: 'Tutorial Room' },
]

interface RoomFormState {
  name: string
  capacity: string
  room_type: RoomType | ''
}

const EMPTY_FORM: RoomFormState = { name: '', capacity: '', room_type: '' }

function isFormValid(f: RoomFormState): boolean {
  return f.name.trim().length > 0 && f.capacity.length > 0 && Number(f.capacity) > 0 && f.room_type !== ''
}

function RoomFormFields({
  values,
  onChange,
  error,
}: {
  values: RoomFormState
  onChange: (update: Partial<RoomFormState>) => void
  error?: string | null
}) {
  return (
    <div className="grid gap-4 py-2">
      {error && (
        <p className="text-sm" style={{ color: 'var(--state-error)' }}>
          {error}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="room-name">Name</Label>
        <Input
          id="room-name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Room 101"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="room-capacity">Capacity</Label>
        <Input
          id="room-capacity"
          type="number"
          min={1}
          value={values.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
          placeholder="e.g. 30"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Room type</Label>
        <Select
          value={values.room_type}
          onValueChange={(v) => onChange({ room_type: v as RoomType })}
        >
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

function roomTypeLabel(type: RoomType): string {
  return ROOM_TYPES.find((t) => t.value === type)?.label ?? type
}

export default function RoomsPage() {
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<RoomFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [roomToEdit, setRoomToEdit] = useState<Room | null>(null)
  const [editForm, setEditForm] = useState<RoomFormState>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const {
    data: rooms,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
  })

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      setCreateError(null)
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RoomUpdate }) =>
      updateRoom(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setRoomToEdit(null)
      setEditError(null)
    },
    onError: (err: Error) => {
      setEditError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoomApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setRoomToDelete(null)
      setDeleteError(null)
    },
    onError: (err: Error) => {
      setDeleteError(err.message)
    },
  })

  function openEdit(room: Room) {
    setRoomToEdit(room)
    setEditForm({
      name: room.name,
      capacity: String(room.capacity),
      room_type: room.room_type,
    })
    setEditError(null)
  }

  function openDelete(room: Room) {
    setRoomToDelete(room)
    setDeleteError(null)
  }

  function handleCreate() {
    if (!isFormValid(createForm)) return
    createMutation.mutate({
      name: createForm.name.trim(),
      capacity: Number(createForm.capacity),
      room_type: createForm.room_type as RoomType,
    })
  }

  function handleEdit() {
    if (!roomToEdit || !isFormValid(editForm)) return
    editMutation.mutate({
      id: roomToEdit.id,
      data: {
        name: editForm.name.trim(),
        capacity: Number(editForm.capacity),
        room_type: editForm.room_type as RoomType,
      },
    })
  }

  function handleDelete() {
    if (!roomToDelete) return
    deleteMutation.mutate(roomToDelete.id)
  }

  function renderTableBody() {
    if (isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading rooms…
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (isError) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {(listError as Error)?.message ?? 'Failed to load rooms.'}
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (!rooms || rooms.length === 0) {
      return (
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
                  Rooms define the timetable canvas. Add at least one room to
                  display the scheduling grid.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )
    }

    return rooms.map((room) => (
      <TableRow key={room.id}>
        <TableCell className="px-4 font-medium">{room.name}</TableCell>
        <TableCell className="px-4">{room.capacity}</TableCell>
        <TableCell className="px-4">{roomTypeLabel(room.room_type)}</TableCell>
        <TableCell className="px-4 text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(room)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDelete(room)}
              style={{ color: 'var(--state-error)' }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }

  return (
    <AppFrame>
      <PageHeader
        title="Rooms"
        description="Manage teaching rooms. Rooms define the timetable canvas and set capacity constraints."
        action={
          <Button onClick={() => { setCreateOpen(true); setCreateForm(EMPTY_FORM); setCreateError(null) }}>
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
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </div>

      {/* Create room dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create room</DialogTitle>
            <DialogDescription>
              Add a new teaching room. Rooms define where sessions can be
              scheduled.
            </DialogDescription>
          </DialogHeader>
          <RoomFormFields
            values={createForm}
            onChange={(update) => setCreateForm((f) => ({ ...f, ...update }))}
            error={createError}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleCreate}
              disabled={!isFormValid(createForm) || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit room dialog */}
      <Dialog
        open={roomToEdit !== null}
        onOpenChange={(open) => { if (!open) { setRoomToEdit(null); setEditError(null) } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>
              Update the details for this room.
            </DialogDescription>
          </DialogHeader>
          <RoomFormFields
            values={editForm}
            onChange={(update) => setEditForm((f) => ({ ...f, ...update }))}
            error={editError}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleEdit}
              disabled={!isFormValid(editForm) || editMutation.isPending}
            >
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={roomToDelete !== null}
        onOpenChange={(open) => { if (!open) { setRoomToDelete(null); setDeleteError(null) } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete room</DialogTitle>
            <DialogDescription>
              <strong>{roomToDelete?.name}</strong> will be permanently removed.
              Any sessions scheduled in this room will need to be rescheduled.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm px-1" style={{ color: 'var(--state-error)' }}>
              {deleteError}
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
