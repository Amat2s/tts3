import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Pencil, Trash2 } from 'lucide-react'
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
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent as deleteStudentApi,
} from '@/lib/api/students'
import type { Student, StudentTitle, StudentUpdate } from '@/lib/api/students'

const STUDENT_TITLES: StudentTitle[] = ['Mr.', 'Ms.', 'Mx.']
const YEAR_LEVELS = [1, 2, 3, 4, 5]

interface StudentFormState {
  title: StudentTitle | ''
  first_name: string
  last_name: string
  year_level: string
}

const EMPTY_FORM: StudentFormState = {
  title: '',
  first_name: '',
  last_name: '',
  year_level: '',
}

function isFormValid(f: StudentFormState): boolean {
  return (
    f.title !== '' &&
    f.first_name.trim().length > 0 &&
    f.last_name.trim().length > 0 &&
    f.year_level !== ''
  )
}

function StudentFormFields({
  values,
  onChange,
  error,
}: {
  values: StudentFormState
  onChange: (update: Partial<StudentFormState>) => void
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
          onValueChange={(v) => onChange({ title: v as StudentTitle })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a title" />
          </SelectTrigger>
          <SelectContent>
            {STUDENT_TITLES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="student-first-name">First name</Label>
        <Input
          id="student-first-name"
          value={values.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          placeholder="e.g. Alex"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="student-last-name">Last name</Label>
        <Input
          id="student-last-name"
          value={values.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          placeholder="e.g. Johnson"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Year level</Label>
        <Select
          value={values.year_level}
          onValueChange={(v) => onChange({ year_level: v ?? '' })}
          items={YEAR_LEVELS.map((y) => ({ value: String(y), label: `Year ${y}` }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a year level" />
          </SelectTrigger>
          <SelectContent>
            {YEAR_LEVELS.map(y => (
              <SelectItem key={y} value={String(y)}>
                Year {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<StudentFormState>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState<StudentFormState>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const {
    data: students,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ['students'],
    queryFn: listStudents,
  })

  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      setCreateError(null)
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StudentUpdate }) =>
      updateStudent(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setStudentToEdit(null)
      setEditError(null)
    },
    onError: (err: Error) => {
      setEditError(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStudentApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setStudentToDelete(null)
      setDeleteError(null)
    },
    onError: (err: Error) => {
      setDeleteError(err.message)
    },
  })

  function openEdit(student: Student) {
    setStudentToEdit(student)
    setEditForm({
      title: student.title,
      first_name: student.first_name,
      last_name: student.last_name,
      year_level: String(student.year_level),
    })
    setEditError(null)
  }

  function openDelete(student: Student) {
    setStudentToDelete(student)
    setDeleteError(null)
  }

  function handleCreate() {
    if (!isFormValid(createForm)) return
    createMutation.mutate({
      title: createForm.title as StudentTitle,
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name.trim(),
      year_level: Number(createForm.year_level),
    })
  }

  function handleEdit() {
    if (!studentToEdit || !isFormValid(editForm)) return
    editMutation.mutate({
      id: studentToEdit.id,
      data: {
        title: editForm.title as StudentTitle,
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        year_level: Number(editForm.year_level),
      },
    })
  }

  function handleDelete() {
    if (!studentToDelete) return
    deleteMutation.mutate(studentToDelete.id)
  }

  function renderTableBody() {
    if (isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={5} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Loading students…
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (isError) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={5} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--state-error)' }}>
              {(listError as Error)?.message ?? 'Failed to load students.'}
            </p>
          </TableCell>
        </TableRow>
      )
    }

    if (!students || students.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={5} className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <Users className="h-8 w-8" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p
                  className="text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No students yet
                </p>
                <p
                  className="text-sm max-w-xs mx-auto"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Add students and enrol them in sessions to enable conflict constraint detection.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )
    }

    return students.map((student) => (
      <TableRow key={student.id}>
        <TableCell className="px-4">{student.title}</TableCell>
        <TableCell className="px-4">{student.first_name}</TableCell>
        <TableCell className="px-4 font-medium">{student.last_name}</TableCell>
        <TableCell className="px-4">Year {student.year_level}</TableCell>
        <TableCell className="px-4 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(student)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDelete(student)}
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
        title="Students"
        description="Manage students. Students assigned to sessions are used to derive scheduling conflict constraints."
        action={
          <Button
            onClick={() => {
              setCreateOpen(true)
              setCreateForm(EMPTY_FORM)
              setCreateError(null)
            }}
          >
            <Plus className="h-4 w-4" />
            Add student
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
              <TableHead className="px-4">Year level</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
        </Table>
      </div>

      {/* Create student dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) { setCreateForm(EMPTY_FORM); setCreateError(null) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>
              Enter the student's details.
            </DialogDescription>
          </DialogHeader>
          <StudentFormFields
            values={createForm}
            onChange={(update) => setCreateForm(f => ({ ...f, ...update }))}
            error={createError}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleCreate}
              disabled={!isFormValid(createForm) || createMutation.isPending}
            >
              {createMutation.isPending ? 'Adding…' : 'Add student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit student dialog */}
      <Dialog
        open={studentToEdit !== null}
        onOpenChange={(open) => {
          if (!open) { setStudentToEdit(null); setEditError(null) }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
            <DialogDescription>
              Update the student's details.
            </DialogDescription>
          </DialogHeader>
          <StudentFormFields
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
        open={studentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) { setStudentToDelete(null); setDeleteError(null) }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete student</DialogTitle>
            <DialogDescription>
              <strong>
                {studentToDelete
                  ? `${studentToDelete.title} ${studentToDelete.first_name} ${studentToDelete.last_name}`
                  : ''}
              </strong>{' '}
              will be permanently removed, along with any session enrolments.
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
              {deleteMutation.isPending ? 'Deleting…' : 'Delete student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
