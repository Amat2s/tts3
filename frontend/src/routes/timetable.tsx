import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { TimetableActionBar } from '@/features/timetable/TimetableActionBar'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { UnscheduledPool } from '@/features/timetable/UnscheduledPool'
import { listRooms } from '@/lib/api/rooms'
import { listSchedulableSessions } from '@/lib/api/sessions'

export default function TimetablePage() {
  const {
    data: rooms,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
  })

  const {
    data: schedulableSessions,
    isLoading: sessionsLoading,
    isError: sessionsIsError,
    error: sessionsError,
  } = useQuery({
    queryKey: ['schedulable-sessions'],
    queryFn: listSchedulableSessions,
  })

  function renderCanvas() {
    if (isLoading) {
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

    if (isError) {
      return (
        <div
          className="flex items-center justify-center py-20 rounded-lg border"
          style={{
            borderColor: 'var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--state-error)' }}>
            {(error as Error)?.message ?? 'Failed to load rooms.'}
          </p>
        </div>
      )
    }

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
            <p
              className="text-sm max-w-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              The timetable canvas requires at least one room.{' '}
              <Link
                to="/rooms"
                className="underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                Create rooms
              </Link>{' '}
              before scheduling sessions.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <TimetableGrid rooms={rooms} assignments={[]} />
        <UnscheduledPool
          sessions={schedulableSessions}
          isLoading={sessionsLoading}
          isError={sessionsIsError}
          error={sessionsError as Error | null}
        />
      </div>
    )
  }

  return (
    <AppFrame>
      <PageHeader
        title="Timetable"
        description="Weekly scheduling workspace. Assign sessions to rooms and time slots, or run the constraint solver."
      />
      <div className="flex flex-col gap-4">
        <TimetableActionBar />
        {renderCanvas()}
      </div>
    </AppFrame>
  )
}
