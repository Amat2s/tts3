import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { FilterBar } from '@/components/filters/FilterBar'
import { SearchInput } from '@/components/filters/SearchInput'
import { FilterSelect } from '@/components/filters/FilterSelect'
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
  uploadStudentCsv,
} from '@/lib/api/students'
import type { Student, YearLevel, StudentImportResult } from '@/lib/api/students'
import { listUnits, updateUnit } from '@/lib/api/units'
import type { Unit } from '@/lib/api/units'
import {
  EMPTY_STUDENT_FILTERS,
  filterStudents,
  studentFiltersActive,
} from '@/features/students/filters'
import type { StudentFilters } from '@/features/students/filters'
import {
  parseUnitCode,
  SUBJECTS,
  SUBJECT_PREFIXES,
} from '@/lib/unit-code-parser'
import type { SubjectPrefix } from '@/lib/unit-code-parser'

// Post-v1: students belong to one of three year levels only (Unit 58/62).
const YEAR_LEVELS = [1, 2, 3]

const YEAR_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All years' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
]

// Unit 89/91: the student number must be exactly 8 digits. Validated on the
// frontend so create/save is disabled and an inline error is shown for invalid
// values, mirroring the backend contract.
const STUDENT_NUMBER_PATTERN = /^\d{8}$/
const STUDENT_NUMBER_ERROR = 'Student number must be exactly 8 digits.'

function isStudentNumberValid(value: string): boolean {
  return STUDENT_NUMBER_PATTERN.test(value.trim())
}

interface StudentFormState {
  // Unit 89/91: canonical institutional identifier (exactly 8 digits).
  student_number: string
  first_name: string
  last_name: string
  year_level: string
  // Enrolled unit ids — the same unit-student relationship the /units page edits
  // (Unit 64). No separate enrolment model: saving reconciles this against the
  // units endpoint's student lists.
  unit_ids: string[]
  // Once the admin manually toggles units, default year-based selection no
  // longer overwrites their choice when the year level changes (create only).
  unitSelectionTouched: boolean
}

const EMPTY_FORM: StudentFormState = {
  student_number: '',
  first_name: '',
  last_name: '',
  year_level: '',
  unit_ids: [],
  unitSelectionTouched: false,
}

type FormUpdater =
  | Partial<StudentFormState>
  | ((prev: StudentFormState) => StudentFormState)

function isFormValid(f: StudentFormState): boolean {
  return (
    isStudentNumberValid(f.student_number) &&
    f.first_name.trim().length > 0 &&
    f.last_name.trim().length > 0 &&
    YEAR_LEVELS.includes(Number(f.year_level))
  )
}

function unitLabel(u: Pick<Unit, 'code' | 'name'>): string {
  return `${u.code} — ${u.name}`
}

function enrolledLabel(count: number): string {
  return `${count} unit${count === 1 ? '' : 's'}`
}

/**
 * Aggregate counts shown in the CSV-import success summary. The past-census skip
 * count is intentionally excluded from the primary summary (spec); invalid rows
 * only appear when nonzero.
 */
function importSummaryItems(
  r: StudentImportResult
): { label: string; value: number }[] {
  const items: { label: string; value: number }[] = [
    { label: 'Created students', value: r.created_students },
    { label: 'Updated students', value: r.updated_students },
    { label: 'Added enrolments', value: r.added_enrolments },
    { label: 'Skipped unknown-unit rows', value: r.skipped_unknown_unit_rows },
  ]
  if (r.skipped_invalid_rows > 0) {
    items.push({ label: 'Skipped invalid rows', value: r.skipped_invalid_rows })
  }
  return items
}

/**
 * Reconcile a student's desired enrolment against the shared unit-student
 * relationship by editing the affected units' student lists. This is the same
 * source of truth the /units page writes to — there is no student-side
 * enrolment endpoint, so we never add a second enrolment model.
 *
 * Failures propagate to the caller's mutation (no partial hiding).
 */
async function reconcileEnrolment(
  studentId: string,
  desiredUnitIds: string[],
  currentUnitIds: string[],
  allUnits: Unit[]
): Promise<void> {
  const desired = new Set(desiredUnitIds)
  const current = new Set(currentUnitIds)
  const toAdd = desiredUnitIds.filter((id) => !current.has(id))
  const toRemove = currentUnitIds.filter((id) => !desired.has(id))

  const unitById = new Map(allUnits.map((u) => [u.id, u]))

  function studentIdsFor(unitId: string, include: boolean): string[] {
    const unit = unitById.get(unitId)
    if (!unit) {
      throw new Error('A unit changed while saving. Refresh and try again.')
    }
    const base = unit.students.map((s) => s.id).filter((id) => id !== studentId)
    return include ? [...base, studentId] : base
  }

  await Promise.all([
    ...toAdd.map((unitId) =>
      updateUnit(unitId, { student_ids: studentIdsFor(unitId, true) })
    ),
    ...toRemove.map((unitId) =>
      updateUnit(unitId, { student_ids: studentIdsFor(unitId, false) })
    ),
  ])
}

function StudentFormFields({
  mode,
  values,
  onChange,
  error,
  units,
}: {
  mode: 'create' | 'edit'
  values: StudentFormState
  onChange: (update: FormUpdater) => void
  error?: string | null
  units: Unit[]
}) {
  const [unitSearch, setUnitSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')

  const selectedYear = values.year_level ? Number(values.year_level) : null

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase()
    return units.filter((u) => {
      if (yearFilter !== 'all' && String(u.year_level) !== yearFilter) return false
      if (q.length === 0) return true
      return `${u.code} ${u.name}`.toLowerCase().includes(q)
    })
  }, [units, unitSearch, yearFilter])

  function handleYearChange(value: string) {
    onChange((prev) => {
      const next = { ...prev, year_level: value }
      // On create, keep the default unit selection in sync with the chosen
      // year until the admin manually edits the selection.
      if (mode === 'create' && !prev.unitSelectionTouched) {
        const year = Number(value)
        next.unit_ids = units.filter((u) => u.year_level === year).map((u) => u.id)
      }
      return next
    })
  }

  function toggleUnit(unitId: string) {
    onChange((prev) => {
      const ids = prev.unit_ids.includes(unitId)
        ? prev.unit_ids.filter((id) => id !== unitId)
        : [...prev.unit_ids, unitId]
      return { ...prev, unit_ids: ids, unitSelectionTouched: true }
    })
  }

  function selectAllForYear() {
    if (selectedYear === null) return
    onChange((prev) => ({
      ...prev,
      unit_ids: units.filter((u) => u.year_level === selectedYear).map((u) => u.id),
      unitSelectionTouched: true,
    }))
  }

  // Show the inline format error only once the admin has typed something
  // invalid, so an untouched empty field is not pre-flagged (the create/save
  // button stays disabled regardless).
  const studentNumberInvalid =
    values.student_number.trim().length > 0 &&
    !isStudentNumberValid(values.student_number)

  return (
    <div className="grid gap-4 py-2">
      {error && (
        <p className="text-sm" style={{ color: 'var(--state-error)' }}>{error}</p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="student-number">Student number</Label>
        <Input
          id="student-number"
          value={values.student_number}
          onChange={(e) => onChange({ student_number: e.target.value })}
          placeholder="e.g. 20251234"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={studentNumberInvalid}
        />
        {studentNumberInvalid && (
          <p className="text-xs" style={{ color: 'var(--state-error)' }}>
            {STUDENT_NUMBER_ERROR}
          </p>
        )}
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
          onValueChange={(v) => handleYearChange(v ?? '')}
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

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label>Enrolled units</Label>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {values.unit_ids.length} selected
          </span>
        </div>
        {units.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No units found. Add units on the Units page first.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: 'var(--text-muted)' }}
                />
                <Input
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="Search by code or name"
                  autoComplete="off"
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Select
                value={yearFilter}
                onValueChange={(v) => setYearFilter(v ?? 'all')}
                items={YEAR_FILTERS}
              >
                <SelectTrigger className="h-8 text-sm w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_FILTERS.map((y) => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className="rounded-md border overflow-y-auto max-h-44"
              style={{ borderColor: 'var(--border-default)' }}
            >
              {filteredUnits.length === 0 ? (
                <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>
                  No units match the current search or filter.
                </p>
              ) : (
                filteredUnits.map((u, i) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                      backgroundColor: values.unit_ids.includes(u.id)
                        ? 'var(--bg-muted)'
                        : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={values.unit_ids.includes(u.id)}
                      onChange={() => toggleUnit(u.id)}
                      className="h-4 w-4 shrink-0"
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                      {unitLabel(u)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Year {u.year_level}
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedYear !== null && (
              <button
                type="button"
                className="text-xs text-left w-fit underline-offset-2 hover:underline"
                style={{ color: 'var(--accent-primary)' }}
                onClick={selectAllForYear}
              >
                Select all Year {selectedYear} units
              </button>
            )}
          </>
        )}
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

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<StudentImportResult | null>(null)
  // Force-remount the native file input after a successful upload so its
  // displayed filename clears (an input's value cannot be set programmatically).
  const [fileInputKey, setFileInputKey] = useState(0)

  const [filters, setFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS)

  const {
    data: students,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ['students'],
    queryFn: listStudents,
  })

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: listUnits })
  const units = unitsQuery.data ?? []

  // Enrolled-unit filter options: every loaded unit, sorted by code.
  const unitFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All units' },
      ...[...units]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((u) => ({ value: u.id, label: unitLabel(u) })),
    ],
    [units]
  )

  // Subject filter options derived from loaded units. Only valid subject codes
  // appear — units with unknown or structurally invalid codes are ignored.
  const subjectFilterOptions = useMemo(() => {
    const seen = new Set<SubjectPrefix>()
    for (const u of units) {
      const r = parseUnitCode(u.code)
      if (r.valid) seen.add(r.prefix)
    }
    return [
      { value: 'all', label: 'All subjects' },
      ...SUBJECT_PREFIXES.filter((p) => seen.has(p)).map((p) => ({
        value: p as string,
        label: SUBJECTS[p].subjectName,
      })),
    ]
  }, [units])

  const filteredStudents = useMemo(
    () => filterStudents(students ?? [], filters),
    [students, filters]
  )

  // Enrolment changes ripple through unit student lists, the schedulable-session
  // pool (hidden allocations), and any saved assignment validation data.
  function invalidateDependentQueries() {
    qc.invalidateQueries({ queryKey: ['students'] })
    qc.invalidateQueries({ queryKey: ['units'] })
    qc.invalidateQueries({ queryKey: ['schedulable-sessions'] })
    qc.invalidateQueries({ queryKey: ['assignments'] })
  }

  const createMutation = useMutation({
    mutationFn: async (form: StudentFormState) => {
      // The backend auto-enrols a new student into every matching-year unit; the
      // returned `units` is the actual starting enrolment we reconcile against.
      const created = await createStudent({
        student_number: form.student_number.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        year_level: Number(form.year_level) as YearLevel,
      })
      await reconcileEnrolment(
        created.id,
        form.unit_ids,
        created.units.map((u) => u.id),
        units
      )
      return created
    },
    onSuccess: () => {
      invalidateDependentQueries()
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      setCreateError(null)
    },
    onError: (err: Error) => {
      setCreateError(err.message)
    },
  })

  const editMutation = useMutation({
    mutationFn: async ({
      student,
      form,
    }: {
      student: Student
      form: StudentFormState
    }) => {
      await updateStudent(student.id, {
        student_number: form.student_number.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        year_level: Number(form.year_level) as YearLevel,
      })
      await reconcileEnrolment(
        student.id,
        form.unit_ids,
        student.units.map((u) => u.id),
        units
      )
      return student.id
    },
    onSuccess: () => {
      invalidateDependentQueries()
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
      invalidateDependentQueries()
      setStudentToDelete(null)
      setDeleteError(null)
    },
    onError: (err: Error) => {
      setDeleteError(err.message)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadStudentCsv(file),
    onSuccess: (result) => {
      // A CSV import can create/update students, add enrolments, and rebalance
      // hidden session allocations, so the same dependent queries the manual
      // CRUD path refreshes must be invalidated.
      invalidateDependentQueries()
      setUploadResult(result)
      setUploadError(null)
      setUploadFile(null)
      setFileInputKey((k) => k + 1)
    },
    onError: (err: Error) => {
      setUploadError(err.message)
      setUploadResult(null)
    },
  })

  function openCreate() {
    setCreateOpen(true)
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    createMutation.reset()
  }

  function openEdit(student: Student) {
    setStudentToEdit(student)
    setEditForm({
      student_number: student.student_number,
      first_name: student.first_name,
      last_name: student.last_name,
      year_level: String(student.year_level),
      unit_ids: student.units.map((u) => u.id),
      // Existing enrolment is a real selection; treat it as already chosen so a
      // year-level change never silently replaces it.
      unitSelectionTouched: true,
    })
    setEditError(null)
    editMutation.reset()
  }

  function openDelete(student: Student) {
    setStudentToDelete(student)
    setDeleteError(null)
    deleteMutation.reset()
  }

  function resetUploadState() {
    setUploadFile(null)
    setUploadError(null)
    setUploadResult(null)
    uploadMutation.reset()
  }

  function openUpload() {
    setUploadOpen(true)
    resetUploadState()
  }

  function handleUpload() {
    if (!uploadFile || uploadMutation.isPending) return
    setUploadError(null)
    uploadMutation.mutate(uploadFile)
  }

  function handleCreate() {
    if (!isFormValid(createForm)) return
    // Saving reconciles enrolment against the loaded units; without resolved
    // unit data we could create the student then fail mid-reconcile (partial
    // write), so block until the units query has settled.
    if (!unitsQuery.isSuccess) {
      setCreateError('Units are still loading. Please wait and try again.')
      return
    }
    setCreateError(null)
    createMutation.mutate(createForm)
  }

  function handleEdit() {
    if (!studentToEdit || !isFormValid(editForm)) return
    if (!unitsQuery.isSuccess) {
      setEditError('Units are still loading. Please wait and try again.')
      return
    }
    setEditError(null)
    editMutation.mutate({ student: studentToEdit, form: editForm })
  }

  function handleDelete() {
    if (!studentToDelete) return
    setDeleteError(null)
    deleteMutation.mutate(studentToDelete.id)
  }

  function applyUpdate(
    setter: React.Dispatch<React.SetStateAction<StudentFormState>>,
    update: FormUpdater
  ) {
    if (typeof update === 'function') {
      setter(update)
    } else {
      setter((prev) => ({ ...prev, ...update }))
    }
  }

  function renderTableBody() {
    if (isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={6} className="py-16 text-center">
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
          <TableCell colSpan={6} className="py-16 text-center">
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
          <TableCell colSpan={6} className="py-16 text-center">
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
                  Add students and enrol them in units to enable conflict constraint detection.
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )
    }

    if (filteredStudents.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={6} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No students match the current filters.
            </p>
          </TableCell>
        </TableRow>
      )
    }

    return filteredStudents.map((student) => (
      <TableRow key={student.id}>
        <TableCell className="px-4 font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {student.student_number}
        </TableCell>
        <TableCell className="px-4">{student.first_name}</TableCell>
        <TableCell className="px-4 font-medium">{student.last_name}</TableCell>
        <TableCell className="px-4">Year {student.year_level}</TableCell>
        <TableCell className="px-4">
          <span
            className="text-sm"
            style={{
              color: student.unit_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {enrolledLabel(student.unit_count)}
          </span>
        </TableCell>
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
        description="Manage students and their unit enrolments. Enrolments drive scheduling conflict constraints."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openUpload}>
              <Upload className="h-4 w-4" />
              Upload student information
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add student
            </Button>
          </div>
        }
      />

      {students && students.length > 0 && (
        <FilterBar
          isActive={studentFiltersActive(filters)}
          onClear={() => setFilters(EMPTY_STUDENT_FILTERS)}
        >
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((f) => ({ ...f, search }))}
            label="Search students by name or student number"
            placeholder="Search students"
          />
          <FilterSelect
            value={filters.year}
            onChange={(year) => setFilters((f) => ({ ...f, year }))}
            options={YEAR_FILTERS}
            label="Filter by year level"
            className="h-9 text-sm w-36"
          />
          <FilterSelect
            value={filters.unitId}
            onChange={(unitId) => setFilters((f) => ({ ...f, unitId }))}
            options={unitFilterOptions}
            label="Filter by enrolled unit"
          />
          <FilterSelect
            value={filters.subject}
            onChange={(subject) => setFilters((f) => ({ ...f, subject }))}
            options={subjectFilterOptions}
            label="Filter by subject"
          />
        </FilterBar>
      )}

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
              <TableHead className="px-4">Student number</TableHead>
              <TableHead className="px-4">First name</TableHead>
              <TableHead className="px-4">Last name</TableHead>
              <TableHead className="px-4">Year level</TableHead>
              <TableHead className="px-4">Enrolled units</TableHead>
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
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>
              Enter the student's details and choose their unit enrolments.
            </DialogDescription>
          </DialogHeader>
          <StudentFormFields
            mode="create"
            values={createForm}
            onChange={(update) => applyUpdate(setCreateForm, update)}
            error={createError}
            units={units}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleCreate}
              disabled={
                !isFormValid(createForm) ||
                createMutation.isPending ||
                !unitsQuery.isSuccess
              }
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
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
            <DialogDescription>
              Update the student's details and unit enrolments.
            </DialogDescription>
          </DialogHeader>
          <StudentFormFields
            mode="edit"
            values={editForm}
            onChange={(update) => applyUpdate(setEditForm, update)}
            error={editError}
            units={units}
          />
          <DialogFooter showCloseButton>
            <Button
              onClick={handleEdit}
              disabled={
                !isFormValid(editForm) ||
                editMutation.isPending ||
                !unitsQuery.isSuccess
              }
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
                  ? `${studentToDelete.first_name} ${studentToDelete.last_name}`
                  : ''}
              </strong>{' '}
              will be permanently removed, along with any unit enrolments and session allocations.
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

      {/* Upload student information dialog (Unit 91) */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open)
          if (!open) resetUploadState()
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Upload student information</DialogTitle>
            <DialogDescription>
              Import current student-unit enrolments from a CSV file. Students are
              matched or created by student number; only existing units are enrolled.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div
              className="rounded-md border px-3 py-2.5 text-xs"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
              }}
            >
              <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Expected CSV columns
              </p>
              <p className="font-mono break-words">
                Student number, first name, last name, scheduled unit code, dest census date
              </p>
              <p className="mt-1.5">
                Dates use <span className="font-mono">dd/mm/yyyy</span> format.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="student-csv-file">CSV file</Label>
              <Input
                key={fileInputKey}
                id="student-csv-file"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] ?? null)
                  // Picking a new file clears any prior outcome so the summary
                  // always reflects the most recent upload attempt.
                  setUploadResult(null)
                  setUploadError(null)
                }}
              />
            </div>

            {uploadError && (
              <div
                className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
                style={{
                  borderColor: 'var(--state-error)',
                  backgroundColor: 'var(--state-error-bg)',
                  color: 'var(--state-error)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadResult && (
              <div
                className="rounded-md border px-3 py-2.5"
                style={{
                  borderColor: 'var(--state-success)',
                  backgroundColor: 'var(--state-success-bg)',
                }}
              >
                <div
                  className="flex items-center gap-2 mb-2 text-sm font-medium"
                  style={{ color: 'var(--state-success)' }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Import complete</span>
                </div>
                <dl
                  className="grid gap-y-1 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {importSummaryItems(uploadResult).map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <dt>{item.label}</dt>
                      <dd
                        className="font-medium tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <DialogFooter showCloseButton>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
