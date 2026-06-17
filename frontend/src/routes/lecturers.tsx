import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
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
import { AvailabilityEditor } from '@/features/lecturers/AvailabilityEditor'
import {
  listLecturers,
  createLecturer,
  updateLecturer,
  deleteLecturer,
  setLecturerAvailability,
} from '@/lib/api/lecturers'
import type { Lecturer, LecturerTitle, LecturerUpdate, AvailabilityEntry } from '@/lib/api/lecturers'
import { listUnits } from '@/lib/api/units'
import type { Unit } from '@/lib/api/units'
import {
  EMPTY_LECTURER_FILTERS,
  filterLecturers,
  lecturerFiltersActive,
} from '@/features/lecturers/filters'
import type { LecturerFilters } from '@/features/lecturers/filters'

const LECTURER_TITLES: LecturerTitle[] = ['Mr', 'Ms', 'Mrs', 'Dr', 'Fr', 'A/Prof.', 'Prof.']

// How many taught-unit chips to show inline before collapsing the rest into a
// single "+N more" chip (with the full list available on hover).
const MAX_VISIBLE_TAUGHT_UNITS = 3

function unitChipTitle(u: Pick<Unit, 'code' | 'name'>): string {
  return `${u.code} — ${u.name}`
}

function sortUnitsByCode(units: Unit[]): Unit[] {
  return [...units].sort((a, b) => a.code.localeCompare(b.code))
}

// A compact, token-styled chip carrying a unit code; the full "CODE — Name" is
// exposed via the native title tooltip.
function UnitChip({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-muted)',
        color: 'var(--text-secondary)',
      }}
    >
      {label}
    </span>
  )
}

// Read-only teaching visibility for the lecturer table. Teaching assignments are
// owned by the Units page; this only displays the derived relationship.
function TaughtUnitsCell({
  units,
  isLoading,
  isError,
}: {
  units: Unit[]
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return (
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        …
      </span>
    )
  }

  if (isError) {
    return (
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Unavailable
      </span>
    )
  }

  if (units.length === 0) {
    return (
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        No units assigned
      </span>
    )
  }

  const sorted = sortUnitsByCode(units)
  const visible = sorted.slice(0, MAX_VISIBLE_TAUGHT_UNITS)
  const overflow = sorted.slice(MAX_VISIBLE_TAUGHT_UNITS)

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((u) => (
        <UnitChip key={u.id} label={u.code} title={unitChipTitle(u)} />
      ))}
      {overflow.length > 0 && (
        <UnitChip
          label={`+${overflow.length} more`}
          title={overflow.map(unitChipTitle).join('\n')}
        />
      )}
    </div>
  )
}

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
  taughtUnits,
}: {
  values: LecturerFormState
  onChange: (update: Partial<LecturerFormState>) => void
  error?: string | null
  // When provided (edit mode), renders a read-only summary of the units this
  // lecturer teaches. Teaching assignments are not editable from here.
  taughtUnits?: Unit[]
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
      {taughtUnits && (
        <div className="grid gap-1.5">
          <Label>Units taught</Label>
          {taughtUnits.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No units assigned
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sortUnitsByCode(taughtUnits).map((u) => (
                <UnitChip key={u.id} label={unitChipTitle(u)} title={unitChipTitle(u)} />
              ))}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Teaching assignments are managed from Units.
          </p>
        </div>
      )}
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

  const [filters, setFilters] = useState<LecturerFilters>(EMPTY_LECTURER_FILTERS)

  const {
    data: lecturers,
    isLoading,
    isError,
    error: listError,
  } = useQuery({
    queryKey: ['lecturers'],
    queryFn: listLecturers,
  })

  // Teaching visibility is derived from the units list (the Units page owns the
  // teaching relationship). Reading the same ['units'] cache means a teaching
  // change made on /units invalidates ['units'] and refetches here automatically.
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: listUnits })

  const taughtUnitsByLecturer = useMemo(() => {
    const map = new Map<string, Unit[]>()
    for (const unit of unitsQuery.data ?? []) {
      for (const lec of unit.lecturers) {
        const existing = map.get(lec.id)
        if (existing) existing.push(unit)
        else map.set(lec.id, [unit])
      }
    }
    return map
  }, [unitsQuery.data])

  // Taught-unit filter options: every loaded unit, sorted by code.
  const unitFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All units' },
      ...sortUnitsByCode(unitsQuery.data ?? []).map((u) => ({
        value: u.id,
        label: unitChipTitle(u),
      })),
    ],
    [unitsQuery.data]
  )

  const filteredLecturers = useMemo(
    () => filterLecturers(lecturers ?? [], filters, taughtUnitsByLecturer),
    [lecturers, filters, taughtUnitsByLecturer]
  )

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
          <TableCell colSpan={5} className="py-16 text-center">
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
          <TableCell colSpan={5} className="py-16 text-center">
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
          <TableCell colSpan={5} className="py-16 text-center">
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

    if (filteredLecturers.length === 0) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={5} className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No lecturers match the current filters.
            </p>
          </TableCell>
        </TableRow>
      )
    }

    return filteredLecturers.map((lecturer) => (
      <TableRow key={lecturer.id}>
        <TableCell className="px-4">{lecturer.title}</TableCell>
        <TableCell className="px-4">{lecturer.first_name}</TableCell>
        <TableCell className="px-4 font-medium">{lecturer.last_name}</TableCell>
        <TableCell className="px-4">
          <TaughtUnitsCell
            units={taughtUnitsByLecturer.get(lecturer.id) ?? []}
            isLoading={unitsQuery.isLoading}
            isError={unitsQuery.isError}
          />
        </TableCell>
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

      {lecturers && lecturers.length > 0 && (
        <FilterBar
          isActive={lecturerFiltersActive(filters)}
          onClear={() => setFilters(EMPTY_LECTURER_FILTERS)}
        >
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((f) => ({ ...f, search }))}
            label="Search lecturers by name"
            placeholder="Search lecturers"
          />
          <FilterSelect
            value={filters.unitId}
            onChange={(unitId) => setFilters((f) => ({ ...f, unitId }))}
            options={unitFilterOptions}
            label="Filter by taught unit"
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
              <TableHead className="px-4">Title</TableHead>
              <TableHead className="px-4">First name</TableHead>
              <TableHead className="px-4">Last name</TableHead>
              <TableHead className="px-4">Units taught</TableHead>
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
            taughtUnits={
              lecturerToEdit ? taughtUnitsByLecturer.get(lecturerToEdit.id) ?? [] : []
            }
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
