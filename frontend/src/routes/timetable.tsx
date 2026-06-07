import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { TimetableActionBar } from '@/features/timetable/TimetableActionBar'
import { TimetableGrid, type RoomColumn } from '@/features/timetable/TimetableGrid'
import { verifyAuth, type VerifyResponse } from '@/lib/api/auth'
import { ApiRequestError } from '@/lib/api/client'

type VerifyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: VerifyResponse }
  | { status: 'error'; message: string }

// No rooms until the room API is wired up in a future unit.
const ROOMS: RoomColumn[] = []

export default function TimetablePage() {
  const [verify, setVerify] = useState<VerifyState>({ status: 'idle' })

  useEffect(() => {
    if (!import.meta.env.DEV) return
    setVerify({ status: 'loading' })
    verifyAuth()
      .then((data) => setVerify({ status: 'ok', data }))
      .catch((err) => {
        const message =
          err instanceof ApiRequestError ? err.message : 'Unknown error'
        setVerify({ status: 'error', message })
      })
  }, [])

  return (
    <AppFrame>
      <PageHeader
        title="Timetable"
        description="Weekly scheduling workspace. Assign sessions to rooms and time slots, or run the constraint solver."
      />

      {import.meta.env.DEV && (
        <div className="mb-4">
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {verify.status === 'idle' && 'Auth verify: idle'}
            {verify.status === 'loading' && 'Auth verify: checking…'}
            {verify.status === 'ok' &&
              `Auth verify: ✓ authenticated (user_id=${verify.data.user_id})`}
            {verify.status === 'error' && `Auth verify: ✗ ${verify.message}`}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <TimetableActionBar />

        {ROOMS.length === 0 ? (
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
                The timetable canvas requires at least one room. Create rooms on
                the Rooms page before scheduling sessions.
              </p>
            </div>
          </div>
        ) : (
          <TimetableGrid rooms={ROOMS} />
        )}
      </div>
    </AppFrame>
  )
}
