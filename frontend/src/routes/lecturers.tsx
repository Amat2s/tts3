import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
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
import { AvailabilityEditor } from '@/features/lecturers/AvailabilityEditor'
import {
  listLecturers,
  createLecturer,
  updateLecturer,
  deleteLecturer,
  setLecturerAvailability,
} from '@/lib/api/lecturers'
import type { Lecturer, LecturerTitle, LecturerUpdate, AvailabilityEntry } from '@/lib/api/lecturers'

const LECTURER_TITLES: LecturerTitle[] = ['Dr.', 'Prof.', 'A/Prof.', 'Mr.', 'Ms.']

interface LecturerFormState {
  title: LecturerTitle | ''
  first_name: string
  last_name: string
}

const EMPTY_FORM: LecturerFormState = { title: '', first_name: '', last_name: '' }

function isFormValid(f: LecturerFormState): boolean {
  return f.title !== '' && f.first_name.trim().length > 0 && f.last_name.trim().length > 0
}

function LecturerFormFields({
  values,
  onChange,
  error,
}: {
  values: LecturerFormState
  onChange: (update: Partial<LecturerFormState>) => void
  error?: string | null
}) {
  return (
    <div className="grid gap-4 py-2">
      {error && (
        <p className="text-sm" style={{ color: 'var(--state-error)' }}>{error}</p>
      )}
      <div className="grid gap-1.5">
        <Label>Title</Label>
        <Select
          value={values.title}
          onValueChange={(v) => onChange({ title: v as LecturerTitle })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a title" />
          </SelectTrigger>
          <SelectContent>
            {LECTURER_TITLES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lecturer-first-name">First name</Label>
        <Input
          id="lecturer-first-name"
          value={values.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          placeholder="e.g. Jane"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="lecturer-last-name">Last name</Label>
        <Input
          id="lecturer-last-name"
          value={values.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          placeholder="e.g. Smith"
          autoComplete="off"
        />
      </div>
    </div>
  )
}

export default function LecturersPage() {
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<LecturerFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [lecturerToEdit, setLecturerToEdit] = useState<Lecturer | null>(null)
  const [editForm, setEditForm] = useState<LecturerFormState>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [lecturerToDelete, setLecturerToDelete] = useState<Lecturer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [lecturerForAvailability, setLecturerForAvailability] = useState<Lecturer | null>(null)
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([])
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  const {
    data: lecturers,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ['lecturers'],
    queryFn: listLecturers,
  })

  const createMutation = useMutation({
    mutationFn: createLecturer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      setCreateError(null)
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LecturerUpdate }) =>
      updateLecturer(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] })
      setLecturerToEdit(null)
      setEditError(null)
    },
    onError: (err: Error) => {
      setEditError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLecturer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] })
      setLecturerToDelete(null)
      setDeleteError(null)
    },
    onError: (err: Error) => {
      setDeleteError(err.message)
    },
  })

  const availabilityMutation = useMutation({
    mutationFn: ({ lecturerId, entries }: { lecturerId: string; entries: AvailabilityEntry[] }) =>
      setLecturerAvailability(lecturerId, { unavailable: entries }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] })
      setLecturerForAvailability(null)
      setAvailabilityEntries([])
      setAvailabilityError(null)
    },
    onError: (err: Error) => {
      setAvailabilityError(err.message)
    },
  })

  function openEdit(lecturer: Lecturer) {
    setLecturerToEdit(lecturer)
    setEditForm({
      title: lecturer.title,
      first_name: lecturer.first_name,
      last_name: lecturer.last_name,
    })
    setEditError(null)
  }

  function openDelete(lecturer: Lecturer) {
    setLecturerToDelete(lecturer)
    setDeleteError(null)
  }

  function openAvailability(lecturer: Lecturer) {
    setLecturerForAvailability(lecturer)
    setAvailabilityEntries(lecturer.unavailable_slots)
    setAvailabilityError(null)
  }

  function handleCreate() {
    if (!isFormValid(createForm)) return
    createMutation.mutate({
      title: createForm.title as LecturerTitle,
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
    })
  }

  function handleEdit() {
    if (!lecturerToEdit || !isFormValid(editForm)) return
    editMutation.mutate({
      id: lecturerToEdit.id,
      data: {
        title: editForm.title as LecturerTitle,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
      },
    })
  }

  function handleDelete() {
    if (!lecturerToDelete) return
    deleteMutation.mutate(lecturerToDelete.id)
  }

  function handleSaveAvailability() {
    if (!lecturerForAvailability) return
    availabilityMutation.mutate({
      lecturerId: lecturerForAvailability.id,
      entries: availabilityEntries,
    })
  }

  function renderTableBody() {
    if (isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading lecturers…
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
              {(listError as Error)?.message ?? 'Failed to load lecturers.'}
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (!lecturers || lecturers.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <UserCheck className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No lecturers yet
                </p>
                <p
                  className="text-sm max-w-xs mx-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Add lecturers and set their weekly availability to enable scheduling conflict detection.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )
    }

    return lecturers.map((lecturer) => (
      <TableRow key={lecturer.id}>
        <TableCell className="px-4">{lecturer.title}</TableCell>
        <TableCell className="px-4">{lecturer.first_name}</TableCell>
        <TableCell className="px-4 font-medium">{lecturer.last_name}</TableCell>
        <TableCell className="px-4 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(lecturer)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAvailability(lecturer)}
            >
              <CalendarDays className="h-4 w-4" />
              Availability
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDelete(lecturer)}
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
        title="Lecturers"
        description="Manage lecturers and their weekly availability. Availability is used as a hard scheduling constraint."
        action={
          <Button
            onClick={() => {
              setCreateOpen(true)
              setCreateForm(EMPTY_FORM)
              setCreateError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            Add lecturer
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
              <TableHead className="px-4">Title</TableHead>
              <TableHead className="px-4">First name</TableHead>
              <TableHead className="px-4">Last name</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </div>

      {/* Create lecturer dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) { setCreateForm(EMPTY_FORM); setCreateError(null) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add lecturer</DialogTitle>
            <DialogDescription>
              Enter the lecturer's details. You can set their availability after adding them.
            </DialogDescription>
          </DialogHeader>
          <LecturerFormFields
            values={createForm}
            onChange={(update) => setCreateForm(f => ({ ...f, ...update }))}
            error={createError}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleCreate}
              disabled={!isFormValid(createForm) || createMutation.isPending}
            >
              {createMutation.isPending ? 'Adding…' : 'Add lecturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit lecturer dialog */}
      <Dialog
        open={lecturerToEdit !== null}
        onOpenChange={(open) => {
          if (!open) { setLecturerToEdit(null); setEditError(null) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit lecturer</DialogTitle>
            <DialogDescription>
              Update the lecturer's details.
            </DialogDescription>
          </DialogHeader>
          <LecturerFormFields
            values={editForm}
            onChange={(update) => setEditForm(f => ({ ...f, ...update }))}
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
        open={lecturerToDelete !== null}
        onOpenChange={(open) => {
          if (!open) { setLecturerToDelete(null); setDeleteError(null) }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete lecturer</DialogTitle>
            <DialogDescription>
              <strong>
                {lecturerToDelete
                  ? `${lecturerToDelete.title} ${lecturerToDelete.first_name} ${lecturerToDelete.last_name}`
                  : ''}
              </strong>{' '}
              will be permanently removed, along with their availability settings.
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
              {deleteMutation.isPending ? 'Deleting…' : 'Delete lecturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability editor dialog */}
      <Dialog
        open={lecturerForAvailability !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLecturerForAvailability(null)
            setAvailabilityEntries([])
            setAvailabilityError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lecturerForAvailability
                ? `${lecturerForAvailability.title} ${lecturerForAvailability.first_name} ${lecturerForAvailability.last_name} — Availability`
                : 'Availability'}
            </DialogTitle>
            <DialogDescription>
              Mark time slots when this lecturer is unavailable. These slots will be excluded from scheduling.
            </DialogDescription>
          </DialogHeader>
          <AvailabilityEditor
            value={availabilityEntries}
            onChange={setAvailabilityEntries}
          />
          {availabilityError && (
            <p className="text-sm px-1" style={{ color: 'var(--state-error)' }}>
              {availabilityError}
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button
              onClick={handleSaveAvailability}
              disabled={availabilityMutation.isPending}
            >
              {availabilityMutation.isPending ? 'Saving…' : 'Save availability'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
