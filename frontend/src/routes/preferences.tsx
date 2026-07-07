import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppFrame } from '@/components/layout/AppFrame'
import { LecturerSelector } from '@/features/preferences/LecturerSelector'
import {
  PreferenceGrid,
  preferenceCellKey,
} from '@/features/preferences/PreferenceGrid'
import { listLecturers } from '@/lib/api/lecturers'
import type { AvailabilityDay, AvailabilitySlot } from '@/lib/api/lecturers'
import {
  type LecturerPreference,
  type LecturerPreferenceCell,
  type LecturerPreferenceLevel,
  deleteLecturerPreference,
  listLecturerPreferences,
  upsertLecturerPreference,
} from '@/lib/api/lecturerPreferences'
import { listRooms } from '@/lib/api/rooms'
import { getErrorMessage } from '@/lib/errors'

// Click cycles neutral -> preferred -> avoid -> neutral. Each click is one
// immediate API call: an upsert for the first two, a delete for the last.
type PreferenceAction =
  | { kind: 'upsert'; level: LecturerPreferenceLevel }
  | { kind: 'delete' }

interface PreferenceMutationVars {
  cell: LecturerPreferenceCell
  action: PreferenceAction
}

function nextAction(current: LecturerPreferenceLevel | null): PreferenceAction {
  if (current === null) return { kind: 'upsert', level: 'preferred' }
  if (current === 'preferred') return { kind: 'upsert', level: 'avoid' }
  return { kind: 'delete' }
}

export default function PreferencesPage() {
  const queryClient = useQueryClient()
  const [selectedLecturerId, setSelectedLecturerId] = useState<string | null>(
    null
  )
  const [mutationError, setMutationError] = useState<string | null>(null)

  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsIsError,
    error: roomsError,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
  })

  const { data: lecturers } = useQuery({
    queryKey: ['lecturers'],
    queryFn: listLecturers,
  })

  // Loaded per-lecturer; the query key swaps on lecturer change so there is no
  // cross-lecturer cell bleed. Disabled until a lecturer is selected.
  const {
    data: preferences,
    isError: prefsIsError,
    error: prefsError,
  } = useQuery({
    queryKey: ['lecturer-preferences', selectedLecturerId],
    queryFn: () => listLecturerPreferences(selectedLecturerId as string),
    enabled: !!selectedLecturerId,
  })

  const preferenceLevels = useMemo(() => {
    const map = new Map<string, LecturerPreferenceLevel>()
    for (const p of preferences ?? []) {
      map.set(preferenceCellKey(p.day, p.room_id, p.slot), p.level)
    }
    return map
  }, [preferences])

  const mutation = useMutation({
    mutationFn: async ({ cell, action }: PreferenceMutationVars) => {
      if (action.kind === 'upsert') {
        await upsertLecturerPreference({ ...cell, level: action.level })
      } else {
        await deleteLecturerPreference(cell)
      }
    },
    // Optimistically patch the cached cell so the grid updates immediately.
    onMutate: async ({ cell, action }: PreferenceMutationVars) => {
      setMutationError(null)
      const key = ['lecturer-preferences', cell.lecturer_id]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<LecturerPreference[]>(key)
      queryClient.setQueryData<LecturerPreference[]>(key, (old) => {
        const without = (old ?? []).filter(
          (p) =>
            !(
              p.day === cell.day &&
              p.slot === cell.slot &&
              p.room_id === cell.room_id
            )
        )
        if (action.kind === 'delete') return without
        const now = new Date().toISOString()
        const optimistic: LecturerPreference = {
          id: `optimistic-${cell.day}-${cell.slot}-${cell.room_id}`,
          lecturer_id: cell.lecturer_id,
          day: cell.day,
          slot: cell.slot,
          room_id: cell.room_id,
          level: action.level,
          created_at: now,
          updated_at: now,
        }
        return [...without, optimistic]
      })
      return { previous, key }
    },
    onError: (err, _vars, context) => {
      // Roll the optimistic update back to the last server-confirmed state.
      if (context) {
        queryClient.setQueryData(context.key, context.previous)
      }
      setMutationError(getErrorMessage(err, 'Failed to save preference.'))
    },
    // Reconcile the optimistic guess with the server on settle.
    onSettled: (_data, _err, { cell }: PreferenceMutationVars) => {
      queryClient.invalidateQueries({
        queryKey: ['lecturer-preferences', cell.lecturer_id],
      })
    },
  })

  function handleCellClick(day: string, slotId: string, roomId: string) {
    if (!selectedLecturerId) return
    const current =
      preferenceLevels.get(preferenceCellKey(day, roomId, slotId)) ?? null
    const cell: LecturerPreferenceCell = {
      lecturer_id: selectedLecturerId,
      day: day as AvailabilityDay,
      slot: slotId as AvailabilitySlot,
      room_id: roomId,
    }
    mutation.mutate({ cell, action: nextAction(current) })
  }

  function renderGrid() {
    if (roomsLoading) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading rooms…
          </p>
        </div>
      )
    }

    if (roomsIsError) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--state-error)' }}>
            {(roomsError as Error)?.message ?? 'Failed to load rooms.'}
          </p>
        </div>
      )
    }

    // Same empty-state pattern as /timetable: the grid requires at least one
    // room, otherwise show a message pointing to /rooms.
    if (!rooms || rooms.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <CalendarDays
            className="h-8 w-8"
            style={{ color: 'var(--text-muted)' }}
          />
          <div className="text-center">
            <p
              className="text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              No rooms available
            </p>
            <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
              The preferences grid requires at least one room.{' '}
              <Link
                to="/rooms"
                className="underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                Create rooms
              </Link>{' '}
              before setting preferences.
            </p>
          </div>
        </div>
      )
    }

    // Concise inline error near the grid: a failed preference load, or the most
    // recent failed click.
    const inlineError = prefsIsError
      ? getErrorMessage(prefsError, 'Failed to load preferences.')
      : mutationError

    return (
      <div className="flex flex-col gap-2">
        {!selectedLecturerId && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a lecturer to view and set their preferences.
          </p>
        )}
        {inlineError && (
          <p
            role="alert"
            className="text-sm"
            style={{ color: 'var(--state-error)' }}
          >
            {inlineError}
          </p>
        )}
        <PreferenceGrid
          rooms={rooms}
          preferenceLevels={preferenceLevels}
          onCellClick={handleCellClick}
          interactionDisabled={!selectedLecturerId}
        />
      </div>
    )
  }

  return (
    <AppFrame>
      <h1 className="sr-only">Preferences</h1>
      <div className="flex flex-col gap-6">
        <LecturerSelector
          lecturers={lecturers ?? []}
          value={selectedLecturerId}
          onChange={(id) => {
            setMutationError(null)
            setSelectedLecturerId(id)
          }}
        />
        {renderGrid()}
      </div>
    </AppFrame>
  )
}
