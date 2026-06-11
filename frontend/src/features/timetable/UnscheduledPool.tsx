import { CalendarPlus, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { SchedulableSession } from '@/lib/api/sessions'
import { getUnitColor } from './unitColors'
import { UnitGroup } from './UnitGroup'

const SESSION_TYPE_ORDER: Record<string, number> = {
  lecture: 0,
  tutorial: 1,
  lab: 2,
  workshop: 3,
}

interface UnitBucket {
  unitId: string
  unitCode: string
  unitName: string
  sessions: SchedulableSession[]
}

function buildUnitBuckets(sessions: SchedulableSession[]): UnitBucket[] {
  const map = new Map<string, UnitBucket>()
  for (const s of sessions) {
    if (!map.has(s.unit_id)) {
      map.set(s.unit_id, {
        unitId: s.unit_id,
        unitCode: s.unit_code,
        unitName: s.unit_name,
        sessions: [],
      })
    }
    map.get(s.unit_id)!.sessions.push(s)
  }
  const buckets = Array.from(map.values())
  buckets.sort((a, b) => a.unitCode.localeCompare(b.unitCode))
  for (const bucket of buckets) {
    bucket.sessions.sort((a, b) => {
      const typeOrder =
        (SESSION_TYPE_ORDER[a.session_type] ?? 99) -
        (SESSION_TYPE_ORDER[b.session_type] ?? 99)
      if (typeOrder !== 0) return typeOrder
      return a.duration - b.duration
    })
  }
  return buckets
}

interface UnscheduledPoolProps {
  sessions?: SchedulableSession[]
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  selectedSessionId?: string | null
  onSelectSession?: (session: SchedulableSession) => void
}

export function UnscheduledPool({
  sessions = [],
  isLoading = false,
  isError = false,
  error,
  selectedSessionId,
  onSelectSession,
}: UnscheduledPoolProps) {
  const unitBuckets = buildUnitBuckets(sessions)

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-4"
      style={{
        borderColor: 'var(--border-default)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div>
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          Unscheduled Sessions
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {onSelectSession
            ? 'Click a session to select it, then click a time slot to place it.'
            : 'Sessions available for placement on the timetable, grouped by unit.'}
        </p>
      </div>

      {isLoading ? (
        <div
          className="flex items-center justify-center gap-2 py-10 rounded-md border border-dashed"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color: 'var(--text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading sessions…
          </p>
        </div>
      ) : isError ? (
        <div
          className="rounded-md border border-dashed px-4 py-6 text-center"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--state-error)' }}>
            {error?.message ?? 'Failed to load schedulable sessions.'}
          </p>
        </div>
      ) : sessions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-10 rounded-md border border-dashed"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <CalendarPlus
            className="h-8 w-8"
            style={{ color: 'var(--text-muted)' }}
          />
          <div className="text-center">
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              No schedulable sessions yet
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Create units and add sessions to make them available for
              scheduling.{' '}
              <Link
                to="/units"
                className="underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                Go to units
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-3 overflow-x-auto pb-1">
          {unitBuckets.map((bucket) => (
            <UnitGroup
              key={bucket.unitId}
              unitId={bucket.unitId}
              unitCode={bucket.unitCode}
              unitName={bucket.unitName}
              sessions={bucket.sessions}
              colorVariant={getUnitColor(bucket.unitId)}
              selectedSessionId={selectedSessionId}
              onSelectSession={onSelectSession}
            />
          ))}
        </div>
      )}
    </div>
  )
}
