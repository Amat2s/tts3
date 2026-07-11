import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  BookOpen,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
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
import { listUnits, createUnit, updateUnit, deleteUnit, deleteAllUnits } from '@/lib/api/units'
import type { Unit, UnitUpdate } from '@/lib/api/units'
import { listLecturers } from '@/lib/api/lecturers'
import type { Lecturer } from '@/lib/api/lecturers'
import { LecturerUnitUpload } from '@/features/lecturers/LecturerUnitUpload'
import { listStudents } from '@/lib/api/students'
import type { Student, YearLevel } from '@/lib/api/students'
import {
  listUnitSessions,
  createUnitSession,
  updateSession as apiUpdateSession,
  deleteSession as apiDeleteSession,
} from '@/lib/api/sessions'
import type { Session, SessionType } from '@/lib/api/sessions'
import { deleteBlockedMessage } from '@/lib/api/deleteErrorMessage'
import {
  parseUnitCode,
  SUBJECTS,
  SUBJECT_PREFIXES,
} from '@/lib/unit-code-parser'
import type { SubjectPrefix } from '@/lib/unit-code-parser'
import {
  EMPTY_UNIT_FILTERS,
  filterUnits,
  unitFiltersActive,
} from '@/features/units/filters'
import type { UnitFilters } from '@/features/units/filters'

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'tutorial', label: 'Tutorial' },
]

const MIN_DURATION = 1
const MAX_DURATION = 4

const YEAR_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All years' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
]

interface ShellSession {
  id: string // local key for React
  backendId?: string // set when loaded from backend; absent for new sessions
  session_type: SessionType
  duration: number
  // Per-session teaching lecturer (Unit 59/63). '' means none chosen yet.
  // Must be one of the unit's teaching-team lecturers before the unit can save.
  lecturer_id: string
}

interface UnitFormState {
  code: string
  name: string
  // Unit 63: a unit is taught by a team of lecturers.
  lecturer_ids: string[]
  student_ids: string[]
  // Once the admin manually toggles students, default year selection no longer
  // overrides their choice when the code (and thus derived year) changes.
  studentSelectionTouched: boolean
  sessions: ShellSession[]
}

const EMPTY_FORM: UnitFormState = {
  code: '',
  name: '',
  lecturer_ids: [],
  student_ids: [],
  studentSelectionTouched: false,
  sessions: [],
}

type FormUpdater = Partial<UnitFormState> | ((prev: UnitFormState) => UnitFormState)

function sessionLecturerInvalid(session: ShellSession, teamIds: string[]): boolean {
  return session.lecturer_id === '' || !teamIds.includes(session.lecturer_id)
}

function isFormValid(f: UnitFormState): boolean {
  if (!parseUnitCode(f.code).valid) return false
  if (f.name.trim().length === 0) return false
  if (f.lecturer_ids.length === 0) return false
  if (f.sessions.some((s) => sessionLecturerInvalid(s, f.lecturer_ids))) return false
  return true
}

// New sessions default to the sole teaching lecturer when the team has exactly
// one; otherwise the admin must pick one explicitly.
function makeSession(teamIds: string[]): ShellSession {
  return {
    id: crypto.randomUUID(),
    session_type: 'lecture',
    duration: 1,
    lecturer_id: teamIds.length === 1 ? teamIds[0] : '',
  }
}

function toShellSession(s: Session): ShellSession {
  return {
    id: crypto.randomUUID(),
    backendId: s.id,
    session_type: s.session_type,
    duration: s.duration,
    lecturer_id: s.lecturer_id ?? '',
  }
}

// Accepts both the full `Lecturer` DTO and the lightweight `LecturerSummary`
// carried on `Unit.lecturers` — both share the name fields.
function lecturerLabel(l: Pick<Lecturer, 'title' | 'first_name' | 'last_name'>): string {
  return `${l.title} ${l.first_name} ${l.last_name}`
}

function studentLabel(s: Student): string {
  return `${s.first_name} ${s.last_name}`
}

function DurationStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center rounded-md border"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-r-none"
          onClick={() => onChange(Math.max(MIN_DURATION, value - 1))}
          disabled={value <= MIN_DURATION}
          aria-label="Decrease duration"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span
          className="w-9 text-center text-sm tabular-nums"
          style={{ color: 'var(--text-primary)' }}
          aria-live="polite"
        >
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-l-none"
          onClick={() => onChange(Math.min(MAX_DURATION, value + 1))}
          disabled={value >= MAX_DURATION}
          aria-label="Increase duration"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {value === 1 ? 'hour' : 'hours'}
      </span>
    </div>
  )
}

function SessionBox({
  session,
  teamLecturers,
  onUpdate,
  onDelete,
}: {
  session: ShellSession
  teamLecturers: Lecturer[]
  onUpdate: (id: string, patch: Partial<ShellSession>) => void
  onDelete: (id: string) => void
}) {
  const teamIds = teamLecturers.map((l) => l.id)
  const invalid = sessionLecturerInvalid(session, teamIds)

  return (
    <div
      className="rounded-md border p-3 grid gap-3"
      style={{
        borderColor: invalid ? 'var(--state-error)' : 'var(--border-default)',
        backgroundColor: 'var(--bg-muted)',
      }}
    >
      <div className="flex gap-3 items-start">
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
              <SelectTrigger className="h-8 w-full text-sm">
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
            <DurationStepper
              value={session.duration}
              onChange={(d) => onUpdate(session.id, { duration: d })}
            />
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

      <div className="grid gap-1">
        <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Lecturer
        </Label>
        {teamLecturers.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Add a teaching lecturer to this unit before assigning sessions.
          </p>
        ) : (
          <Select
            value={session.lecturer_id}
            onValueChange={(v) => onUpdate(session.id, { lecturer_id: v ?? '' })}
            items={teamLecturers.map((l) => ({ value: l.id, label: lecturerLabel(l) }))}
          >
            <SelectTrigger className="h-8 w-full text-sm">
              <SelectValue placeholder="Select a lecturer" />
            </SelectTrigger>
            <SelectContent>
              {teamLecturers.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {lecturerLabel(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {invalid && teamLecturers.length > 0 && (
          <p
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--state-error)' }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {session.lecturer_id === ''
              ? 'Select a lecturer from the teaching team.'
              : 'This lecturer is no longer on the teaching team. Reassign before saving.'}
          </p>
        )}
      </div>
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
  const lecturerNames = unit.lecturers.map(lecturerLabel).join(', ')

  return (
    <TableRow>
      <TableCell className="px-4">{unit.code}</TableCell>
      <TableCell className="px-4">{unit.name}</TableCell>
      <TableCell className="px-4">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Year {unit.year_level}
        </span>
      </TableCell>
      <TableCell className="px-4">
        <span
          className="text-sm"
          style={{ color: lecturerNames ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          {lecturerNames || '—'}
        </span>
      </TableCell>
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
  mode,
  values,
  onChange,
  error,
  lecturers,
  students,
  sessionsLoading,
}: {
  mode: 'create' | 'edit'
  values: UnitFormState
  onChange: (update: FormUpdater) => void
  error?: string | null
  lecturers: Lecturer[]
  students: Student[]
  sessionsLoading?: boolean
}) {
  const [studentSearch, setStudentSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')

  const parseResult = parseUnitCode(values.code)
  const derivedYear: YearLevel | null = parseResult.valid ? parseResult.yearLevel : null

  const teamLecturers = useMemo(
    () => lecturers.filter((l) => values.lecturer_ids.includes(l.id)),
    [lecturers, values.lecturer_ids]
  )

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    return students.filter((s) => {
      if (yearFilter !== 'all' && String(s.year_level) !== yearFilter) return false
      if (q.length === 0) return true
      return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    })
  }, [students, studentSearch, yearFilter])

  function handleCodeChange(raw: string) {
    const code = raw.toUpperCase()
    onChange((prev) => {
      const next = { ...prev, code }
      // On create, keep the default student selection in sync with the derived
      // year until the admin manually edits the selection.
      if (mode === 'create' && !prev.studentSelectionTouched) {
        const parsed = parseUnitCode(code)
        next.student_ids = parsed.valid
          ? students.filter((s) => s.year_level === parsed.yearLevel).map((s) => s.id)
          : []
      }
      return next
    })
  }

  function selectAllInDerivedYear() {
    if (derivedYear === null) return
    onChange((prev) => ({
      ...prev,
      student_ids: students.filter((s) => s.year_level === derivedYear).map((s) => s.id),
      studentSelectionTouched: true,
    }))
  }

  // Clears the student selection only. Teaching team, sessions, and every other
  // form field are left untouched (Unit 82).
  function clearAllStudents() {
    onChange((prev) => ({
      ...prev,
      student_ids: [],
      studentSelectionTouched: true,
    }))
  }

  function toggleStudent(studentId: string) {
    onChange((prev) => {
      const ids = prev.student_ids.includes(studentId)
        ? prev.student_ids.filter((id) => id !== studentId)
        : [...prev.student_ids, studentId]
      return { ...prev, student_ids: ids, studentSelectionTouched: true }
    })
  }

  function toggleLecturer(lecturerId: string) {
    onChange((prev) => {
      const ids = prev.lecturer_ids.includes(lecturerId)
        ? prev.lecturer_ids.filter((id) => id !== lecturerId)
        : [...prev.lecturer_ids, lecturerId]
      return { ...prev, lecturer_ids: ids }
    })
  }

  function addSession() {
    onChange((prev) => ({
      ...prev,
      sessions: [...prev.sessions, makeSession(prev.lecturer_ids)],
    }))
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

  return (
    <div className="grid gap-4">
      {error && (
        <p
          className="text-sm flex items-start gap-1.5"
          style={{ color: 'var(--state-error)' }}
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        {/* Left column: unit identity, teaching team, and students */}
        <div className="grid gap-4 content-start">
          <div className="grid gap-1.5">
            <Label htmlFor="unit-code">Unit code</Label>
            <Input
              id="unit-code"
              value={values.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. HIS101"
              autoComplete="off"
            />
            {parseResult.valid ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {parseResult.subjectName} · {parseResult.colourName} · Year {parseResult.yearLevel}
              </p>
            ) : values.code.trim().length > 0 ? (
              <p
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--state-error)' }}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Invalid unit code. Use three letters and three numbers, e.g. HIS101, with a supported subject prefix and year 1–3.
              </p>
            ) : null}
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

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Teaching team</Label>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {values.lecturer_ids.length} selected
              </span>
            </div>
            {lecturers.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No lecturers found. Add lecturers on the Lecturers page first.
              </p>
            ) : (
              <div
                className="rounded-md border overflow-y-auto max-h-44"
                style={{ borderColor: 'var(--border-default)' }}
              >
                {lecturers.map((l, i) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer"
                    style={{
                      borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined,
                      backgroundColor: values.lecturer_ids.includes(l.id)
                        ? 'var(--bg-muted)'
                        : undefined,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={values.lecturer_ids.includes(l.id)}
                      onChange={() => toggleLecturer(l.id)}
                      className="h-4 w-4 shrink-0"
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {lecturerLabel(l)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {lecturers.length > 0 && values.lecturer_ids.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Select at least one teaching lecturer.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Students</Label>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {values.student_ids.length} selected
              </span>
            </div>
            {students.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No students found. Add students on the Students page first.
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
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search students"
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
                  {filteredStudents.length === 0 ? (
                    <p className="text-xs px-3 py-3" style={{ color: 'var(--text-muted)' }}>
                      No students match the current search or filter.
                    </p>
                  ) : (
                    filteredStudents.map((s, i) => (
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
                        <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                          {studentLabel(s)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Year {s.year_level}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="text-xs text-left w-fit underline-offset-2 hover:underline disabled:no-underline disabled:cursor-not-allowed"
                    style={{
                      color:
                        derivedYear === null
                          ? 'var(--disabled-text)'
                          : 'var(--accent-primary)',
                    }}
                    onClick={selectAllInDerivedYear}
                    disabled={derivedYear === null}
                  >
                    {derivedYear !== null
                      ? `Select Year ${derivedYear} Students`
                      : 'Select Year Students'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-left w-fit underline-offset-2 hover:underline"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={clearAllStudents}
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right column: live session management in both create and edit
            modals (Unit 82). Created sessions are persisted right after the unit
            on save. */}
        <div className="grid gap-3 content-start">
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
                  teamLecturers={teamLecturers}
                  onUpdate={updateSession}
                  onDelete={removeSession}
                />
              ))}
            </div>
          )}
        </div>
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

  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null)

  const [filters, setFilters] = useState<UnitFilters>(EMPTY_UNIT_FILTERS)

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: listUnits })
  const lecturersQuery = useQuery({ queryKey: ['lecturers'], queryFn: listLecturers })
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: listStudents })

  const lecturers = lecturersQuery.data ?? []
  const students = studentsQuery.data ?? []

  // Teaching-lecturer filter options: every loaded lecturer, by display name.
  const lecturerFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All lecturers' },
      ...lecturers.map((l) => ({ value: l.id, label: lecturerLabel(l) })),
    ],
    [lecturers]
  )

  // Subject filter options derived from loaded units. Only valid subject codes
  // appear — units with unknown or structurally invalid codes are ignored.
  const subjectFilterOptions = useMemo(() => {
    const seen = new Set<SubjectPrefix>()
    for (const u of unitsQuery.data ?? []) {
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
  }, [unitsQuery.data])

  const filteredUnits = useMemo(
    () => filterUnits(unitsQuery.data ?? [], filters),
    [unitsQuery.data, filters]
  )

  // After saving a unit/session, dependent server state may change: the unit
  // list, the lecturer list (teaching-team membership), the schedulable-session
  // pool, and any saved timetable assignments.
  function invalidateDependentQueries(unitId: string) {
    queryClient.invalidateQueries({ queryKey: ['units'] })
    queryClient.invalidateQueries({ queryKey: ['lecturers'] })
    queryClient.invalidateQueries({ queryKey: ['unit-sessions', unitId] })
    queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
    queryClient.invalidateQueries({ queryKey: ['assignments'] })
  }

  const createMutation = useMutation({
    // The create modal supports inline session management (Unit 82): sessions are
    // held in form state and persisted right after the unit itself is created.
    mutationFn: async (form: UnitFormState) => {
      const unit = await createUnit({
        code: form.code,
        name: form.name,
        lecturer_ids: form.lecturer_ids,
        student_ids: form.student_ids,
      })
      if (form.sessions.length > 0) {
        await Promise.all(
          form.sessions.map((s) =>
            createUnitSession(unit.id, {
              session_type: s.session_type,
              duration: s.duration,
              lecturer_id: s.lecturer_id || null,
            })
          )
        )
      }
      return unit
    },
    onSuccess: (unit) => {
      invalidateDependentQueries(unit.id)
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
            apiUpdateSession(s.backendId!, {
              session_type: s.session_type,
              duration: s.duration,
              lecturer_id: s.lecturer_id || null,
            })
          ),
        // create sessions newly added in the form
        ...sessions
          .filter((s) => !s.backendId)
          .map((s) =>
            createUnitSession(id, {
              session_type: s.session_type,
              duration: s.duration,
              lecturer_id: s.lecturer_id || null,
            })
          ),
      ])

      return id
    },
    onSuccess: (id) => {
      invalidateDependentQueries(id)
      setEditOpen(false)
    },
    onError: (err: Error, variables) => {
      setEditError(err.message)
      // A failed save (e.g. a session removal blocked by Unit 111) must not
      // leave a pending removal looking permanent: reconcile the form against
      // the backend's actual session list so anything that didn't really
      // delete reappears rather than staying silently missing.
      listUnitSessions(variables.id)
        .then((backendSessions) => {
          setEditForm((prev) => {
            const presentBackendIds = new Set(
              prev.sessions.filter((s) => s.backendId).map((s) => s.backendId)
            )
            const missing = backendSessions.filter((s) => !presentBackendIds.has(s.id))
            if (missing.length === 0) return prev
            return { ...prev, sessions: [...prev.sessions, ...missing.map(toShellSession)] }
          })
        })
        .catch(() => {
          // Best-effort reconciliation; the edit error message above still stands.
        })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['lecturers'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      setDeleteOpen(false)
    },
    onError: (err: unknown) => setDeleteError(deleteBlockedMessage(err)),
  })

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllUnits,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['lecturers'] })
      queryClient.invalidateQueries({ queryKey: ['schedulable-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      setDeleteAllOpen(false)
    },
    onError: (err: unknown) => setDeleteAllError(deleteBlockedMessage(err)),
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
      lecturer_ids: unit.lecturers.map((l) => l.id),
      student_ids: unit.students.map((s) => s.id),
      // Existing units load a real selection; treat it as already chosen so a
      // code edit never silently replaces it.
      studentSelectionTouched: true,
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
        lecturer_ids: editForm.lecturer_ids,
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

  function openDeleteAll() {
    setDeleteAllError(null)
    deleteAllMutation.reset()
    setDeleteAllOpen(true)
  }

  function handleDeleteAll() {
    setDeleteAllError(null)
    deleteAllMutation.mutate()
  }

  function renderTableBody() {
    if (unitsQuery.isLoading) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={6} className="py-16 text-center">
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
          <TableCell colSpan={6} className="py-16 text-center">
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
          <TableCell colSpan={6} className="py-16 text-center">
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

    if (filteredUnits.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={6} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No units match the current filters.
            </p>
          </TableCell>
        </TableRow>
      )
    }

    return filteredUnits.map((unit) => (
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
          <div className="flex items-center gap-2">
            <LecturerUnitUpload />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create unit
            </Button>
          </div>
        }
      />

      {unitsQuery.data && unitsQuery.data.length > 0 && (
        <FilterBar
          isActive={unitFiltersActive(filters)}
          onClear={() => setFilters(EMPTY_UNIT_FILTERS)}
          trailing={
            <Button variant="destructive" size="sm" onClick={openDeleteAll}>
              <Trash2 className="h-4 w-4" />
              Delete all
            </Button>
          }
        >
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((f) => ({ ...f, search }))}
            label="Search units by code or name"
            placeholder="Search by code or name"
          />
          <FilterSelect
            value={filters.year}
            onChange={(year) => setFilters((f) => ({ ...f, year }))}
            options={YEAR_FILTERS}
            label="Filter by year level"
            className="h-9 text-sm w-36"
          />
          <FilterSelect
            value={filters.lecturerId}
            onChange={(lecturerId) => setFilters((f) => ({ ...f, lecturerId }))}
            options={lecturerFilterOptions}
            label="Filter by teaching lecturer"
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
              <TableHead className="px-4">Code</TableHead>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Year</TableHead>
              <TableHead className="px-4">Teaching team</TableHead>
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
        <DialogContent className="sm:max-w-5xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create unit</DialogTitle>
            <DialogDescription>
              Add a new course unit, its teaching team, students, and sessions.
            </DialogDescription>
          </DialogHeader>
          <UnitFormFields
            mode="create"
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
        <DialogContent className="sm:max-w-5xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
            <DialogDescription>
              Update the details, teaching team, students, and sessions for this unit.
            </DialogDescription>
          </DialogHeader>
          <UnitFormFields
            mode="edit"
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
            <p
              className="text-sm px-1 flex items-start gap-1.5"
              style={{ color: 'var(--state-error)' }}
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
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

      {/* Delete all confirmation dialog */}
      <Dialog
        open={deleteAllOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteAllOpen(false)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all units</DialogTitle>
            <DialogDescription>
              Delete all {unitsQuery.data?.length ?? 0} units? All units and their sessions
              will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteAllError && (
            <p
              className="text-sm px-1 flex items-start gap-1.5"
              style={{ color: 'var(--state-error)' }}
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{deleteAllError}</span>
            </p>
          )}
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Deleting…' : 'Delete all units'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
