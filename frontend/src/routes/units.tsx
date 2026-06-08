import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, X, Pencil, Trash2 } from 'lucide-react'
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
import { listUnits, createUnit, updateUnit, deleteUnit } from '@/lib/api/units'
import type { Unit, UnitUpdate } from '@/lib/api/units'
import { listLecturers } from '@/lib/api/lecturers'
import type { Lecturer } from '@/lib/api/lecturers'
import { listStudents } from '@/lib/api/students'
import type { Student } from '@/lib/api/students'
import {
  listUnitSessions,
  createUnitSession,
  updateSession as apiUpdateSession,
  deleteSession as apiDeleteSession,
} from '@/lib/api/sessions'
import type { Session, SessionType } from '@/lib/api/sessions'

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'lab', label: 'Lab' },
  { value: 'workshop', label: 'Workshop' },
]

const DURATION_OPTIONS = [
  { value: 1, label: '1 slot (~50 min)' },
  { value: 2, label: '2 slots (~100 min)' },
  { value: 3, label: '3 slots (~150 min)' },
  { value: 4, label: '4 slots (~200 min)' },
]

interface ShellSession {
  id: string          // local key for React
  backendId?: string  // set when loaded from backend; absent for new sessions
  session_type: SessionType
  duration: number
}

interface UnitFormState {
  code: string
  name: string
  lecturer_id: string
  student_ids: string[]
  sessions: ShellSession[]
}

const EMPTY_FORM: UnitFormState = {
  code: '',
  name: '',
  lecturer_id: '',
  student_ids: [],
  sessions: [],
}

type FormUpdater = Partial<UnitFormState> | ((prev: UnitFormState) => UnitFormState)

function isFormValid(f: UnitFormState): boolean {
  return f.code.trim().length > 0 && f.name.trim().length > 0 && f.lecturer_id.length > 0
}

function makeSession(): ShellSession {
  return { id: crypto.randomUUID(), session_type: 'lecture', duration: 1 }
}

function toShellSession(s: Session): ShellSession {
  return { id: crypto.randomUUID(), backendId: s.id, session_type: s.session_type, duration: s.duration }
}

function lecturerLabel(l: Lecturer): string {
  return `${l.title} ${l.first_name} ${l.last_name}`
}

function studentLabel(s: Student): string {
  return `${s.title} ${s.first_name} ${s.last_name} (Year ${s.year_level})`
}

function SessionBox({
  session,
  onUpdate,
  onDelete,
}: {
  session: ShellSession
  onUpdate: (id: string, patch: Partial<ShellSession>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="rounded-md border p-3 flex gap-3 items-start"
      style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-muted)' }}
    >
      <div className="flex-1 grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Session type
          </Label>
          <Select
            value={session.session_type}
            onValueChange={(v) => v && onUpdate(session.id, { session_type: v as SessionType })}
            items={SESSION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Duration
          </Label>
          <Select
            value={String(session.duration)}
            onValueChange={(v) => v && onUpdate(session.id, { duration: Number(v) })}
            items={DURATION_OPTIONS.map((d) => ({ value: String(d.value), label: d.label }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 mt-4 shrink-0"
        onClick={() => onDelete(session.id)}
        style={{ color: 'var(--text-muted)' }}
        aria-label="Remove session"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Table row with per-unit session count fetched via TanStack Query.
function UnitTableRow({
  unit,
  onEdit,
  onDelete,
}: {
  unit: Unit
  onEdit: () => void
  onDelete: () => void
}) {
  const sessionsQuery = useQuery({
    queryKey: ['unit-sessions', unit.id],
    queryFn: () => listUnitSessions(unit.id),
  })

  const count = sessionsQuery.data?.length ?? null

  return (
    <TableRow>
      <TableCell className="px-4">{unit.code}</TableCell>
      <TableCell className="px-4">{unit.name}</TableCell>
      <TableCell className="px-4">
        <span
          className="text-sm"
          style={{ color: count !== null ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          {count === null
            ? sessionsQuery.isLoading
              ? '…'
              : '—'
            : `${count} session${count !== 1 ? 's' : ''}`}
        </span>
      </TableCell>
      <TableCell className="px-4 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            style={{ color: 'var(--state-error)' }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function UnitFormFields({
  values,
  onChange,
  error,
  lecturers,
  students,
  sessionsLoading,
}: {
  values: UnitFormState
  onChange: (update: FormUpdater) => void
  error?: string | null
  lecturers: Lecturer[]
  students: Student[]
  sessionsLoading?: boolean
}) {
  function addSession() {
    onChange((prev) => ({ ...prev, sessions: [...prev.sessions, makeSession()] }))
  }

  function updateSession(id: string, patch: Partial<ShellSession>) {
    onChange((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }

  function removeSession(id: string) {
    onChange((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s.id !== id),
    }))
  }

  function toggleStudent(studentId: string) {
    onChange((prev) => {
      const ids = prev.student_ids.includes(studentId)
        ? prev.student_ids.filter((id) => id !== studentId)
        : [...prev.student_ids, studentId]
      return { ...prev, student_ids: ids }
    })
  }

  return (
    <div className="grid gap-4 py-2">
      {error && (
        <p className="text-sm" style={{ color: 'var(--state-error)' }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="unit-code">Unit code</Label>
          <Input
            id="unit-code"
            value={values.code}
            onChange={(e) => onChange({ code: e.target.value })}
            placeholder="e.g. HIS101"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="unit-name">Unit name</Label>
          <Input
            id="unit-name"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Ancient History"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="lecturer-select">Lecturer</Label>
        <Select
          value={values.lecturer_id}
          onValueChange={(v) => onChange({ lecturer_id: v ?? '' })}
          items={lecturers.map((l) => ({ value: l.id, label: lecturerLabel(l) }))}
        >
          <SelectTrigger id="lecturer-select" className="w-full">
            <SelectValue placeholder="Select a lecturer" />
          </SelectTrigger>
          <SelectContent>
            {lecturers.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {lecturerLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label>Students</Label>
        {students.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No students found. Add students on the Students page first.
          </p>
        ) : (
          <div
            className="rounded-md border overflow-y-auto max-h-36"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {students.map((s, i) => (
              <label
                key={s.id}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                style={{
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                  backgroundColor: values.student_ids.includes(s.id)
                    ? 'var(--bg-muted)'
                    : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={values.student_ids.includes(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: 'var(--accent-primary)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {studentLabel(s)}
                </span>
              </label>
            ))}
          </div>
        )}
        {values.student_ids.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {values.student_ids.length} student
            {values.student_ids.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }} />

      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Sessions
            </p>
            {sessionsLoading && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Loading sessions…
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={addSession}
            disabled={sessionsLoading}
          >
            <Plus className="h-4 w-4" />
            Add session
          </Button>
        </div>

        {!sessionsLoading && values.sessions.length === 0 && (
          <div
            className="rounded-md border border-dashed py-6 text-center"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No sessions yet. Add a session to schedule this unit.
            </p>
          </div>
        )}

        {values.sessions.length > 0 && (
          <div className="grid gap-2">
            {values.sessions.map((session) => (
              <SessionBox
                key={session.id}
                session={session}
                onUpdate={updateSession}
                onDelete={removeSession}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function UnitsPage() {
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<UnitFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<UnitFormState>(EMPTY_FORM)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSessionsLoading, setEditSessionsLoading] = useState(false)
  // tracks backend session IDs present when the edit dialog opened, for deletion diffing
  const [originalSessionIds, setOriginalSessionIds] = useState<string[]>([])

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: listUnits })
  const lecturersQuery = useQuery({ queryKey: ['lecturers'], queryFn: listLecturers })
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: listStudents })

  const lecturers = lecturersQuery.data ?? []
  const students = studentsQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: async (form: UnitFormState) => {
      const unit = await createUnit({
        code: form.code,
        name: form.name,
        lecturer_id: form.lecturer_id,
        student_ids: form.student_ids,
      })
      if (form.sessions.length > 0) {
        await Promise.all(
          form.sessions.map((s) =>
            createUnitSession(unit.id, { session_type: s.session_type, duration: s.duration })
          )
        )
      }
      return unit
    },
    onSuccess: (unit) => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['unit-sessions', unit.id] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      setCreateOpen(false)
    },
    onError: (err: Error) => setCreateError(err.message),
  })

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      sessions,
      origIds,
    }: {
      id: string
      data: UnitUpdate
      sessions: ShellSession[]
      origIds: string[]
    }) => {
      await updateUnit(id, data)

      const keptBackendIds = new Set(
        sessions.filter((s) => s.backendId).map((s) => s.backendId!)
      )
      await Promise.all([
        // delete sessions removed from the form
        ...origIds
          .filter((bid) => !keptBackendIds.has(bid))
          .map((bid) => apiDeleteSession(bid)),
        // update sessions still in the form
        ...sessions
          .filter((s) => s.backendId)
          .map((s) =>
            apiUpdateSession(s.backendId!, { session_type: s.session_type, duration: s.duration })
          ),
        // create sessions newly added in the form
        ...sessions
          .filter((s) => !s.backendId)
          .map((s) =>
            createUnitSession(id, { session_type: s.session_type, duration: s.duration })
          ),
      ])

      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['unit-sessions', id] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      setEditOpen(false)
    },
    onError: (err: Error) => setEditError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      setDeleteOpen(false)
    },
    onError: (err: Error) => setDeleteError(err.message),
  })

  function applyUpdate(
    setter: React.Dispatch<React.SetStateAction<UnitFormState>>,
    update: FormUpdater
  ) {
    if (typeof update === 'function') {
      setter(update)
    } else {
      setter((prev) => ({ ...prev, ...update }))
    }
  }

  function openCreate() {
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    createMutation.reset()
    setCreateOpen(true)
  }

  async function openEdit(unit: Unit) {
    setEditingUnit(unit)
    setEditForm({
      code: unit.code,
      name: unit.name,
      lecturer_id: unit.lecturer_id,
      student_ids: unit.students.map((s) => s.id),
      sessions: [],
    })
    setOriginalSessionIds([])
    setEditError(null)
    editMutation.reset()
    setEditSessionsLoading(true)
    setEditOpen(true)

    try {
      const sessions = await queryClient.fetchQuery({
        queryKey: ['unit-sessions', unit.id],
        queryFn: () => listUnitSessions(unit.id),
        staleTime: 30_000,
      })
      setOriginalSessionIds(sessions.map((s) => s.id))
      setEditForm((prev) => ({ ...prev, sessions: sessions.map(toShellSession) }))
    } catch {
      // sessions start empty; user can add manually
    } finally {
      setEditSessionsLoading(false)
    }
  }

  function openDelete(unit: Unit) {
    setDeletingUnit(unit)
    setDeleteError(null)
    deleteMutation.reset()
    setDeleteOpen(true)
  }

  function handleCreate() {
    setCreateError(null)
    createMutation.mutate({
      ...createForm,
      code: createForm.code.trim(),
      name: createForm.name.trim(),
    })
  }

  function handleEdit() {
    if (!editingUnit) return
    setEditError(null)
    editMutation.mutate({
      id: editingUnit.id,
      data: {
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        lecturer_id: editForm.lecturer_id,
        student_ids: editForm.student_ids,
      },
      sessions: editForm.sessions,
      origIds: originalSessionIds,
    })
  }

  function handleDelete() {
    if (!deletingUnit) return
    setDeleteError(null)
    deleteMutation.mutate(deletingUnit.id)
  }

  function renderTableBody() {
    if (unitsQuery.isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading units…
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (unitsQuery.isError) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {unitsQuery.error instanceof Error
                ? unitsQuery.error.message
                : 'Failed to load units.'}
            </p>
          </TableCell>
        </TableRow>
      )
    }

    const units = unitsQuery.data ?? []

    if (units.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={4} className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <BookOpen className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  No units yet
                </p>
                <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
                  Create a unit to start defining sessions for the timetable.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )
    }

    return units.map((unit) => (
      <UnitTableRow
        key={unit.id}
        unit={unit}
        onEdit={() => openEdit(unit)}
        onDelete={() => openDelete(unit)}
      />
    ))
  }

  return (
    <AppFrame>
      <PageHeader
        title="Units"
        description="Manage course units and their sessions. Sessions created here appear in the timetable scheduling pool."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create unit
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
              <TableHead className="px-4">Code</TableHead>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Sessions</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </div>

      {/* Create unit dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create unit</DialogTitle>
            <DialogDescription>
              Add a new course unit and define its sessions.
            </DialogDescription>
          </DialogHeader>
          <UnitFormFields
            values={createForm}
            onChange={(u) => applyUpdate(setCreateForm, u)}
            error={createError}
            lecturers={lecturers}
            students={students}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleCreate}
              disabled={!isFormValid(createForm) || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create unit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit unit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) setEditOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              Update the details and sessions for this unit.
            </DialogDescription>
          </DialogHeader>
          <UnitFormFields
            values={editForm}
            onChange={(u) => applyUpdate(setEditForm, u)}
            error={editError}
            lecturers={lecturers}
            students={students}
            sessionsLoading={editSessionsLoading}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleEdit}
              disabled={!isFormValid(editForm) || editMutation.isPending || editSessionsLoading}
            >
              {editMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete unit</DialogTitle>
            <DialogDescription>
              {deletingUnit
                ? `Delete "${deletingUnit.code} — ${deletingUnit.name}"? This unit and all of its sessions will be permanently removed.`
                : 'This unit and all of its sessions will be permanently removed.'}
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
              {deleteMutation.isPending ? 'Deleting…' : 'Delete unit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
