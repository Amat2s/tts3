import { CalendarPlus, CheckCircle2, Loader2, SearchX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '@/components/filters/FilterBar'
import { FilterSelect } from '@/components/filters/FilterSelect'
import { SearchInput } from '@/components/filters/SearchInput'
import { Button } from '@/components/ui/button'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { Unit } from '@/lib/api/units'
import { getSubjectTokens } from './unitColors'
import { UnitGroup } from './UnitGroup'
import {
  buildUnitBuckets,
  EMPTY_UNSCHEDULED_POOL_FILTERS,
  filterUnscheduledSessions,
  unscheduledPoolFiltersActive,
  type UnscheduledPoolFilters,
} from './unscheduledPoolView'
import { sessionMatchesSearch, type StudentSearchIndex } from './sessionFilter'

const YEAR_LEVEL_OPTIONS = [
  { value: 'all', label: 'All years' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
]

interface UnscheduledPoolProps {
  sessions?: SchedulableSession[]
  units?: Unit[]
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  totalSchedulableCount?: number
  pendingSessionId?: string | null
  editingDisabled?: boolean
  onSelectSession?: (sessionId: string) => void
  // Unit 108: resolves allocated student ids to searchable name/number text so
  // the pool's own search (and the grid search below) can match students.
  studentIndex?: StudentSearchIndex
  // Unit 108: the grid controls' session search, layered on top of the pool's
  // own filters — non-matching sessions are hidden while it is active.
  externalSearch?: string
}

export function UnscheduledPool({
  sessions = [],
  units,
  isLoading = false,
  isError = false,
  error,
  totalSchedulableCount,
  pendingSessionId,
  editingDisabled = false,
  onSelectSession,
  studentIndex,
  externalSearch,
}: UnscheduledPoolProps) {
  const [filters, setFilters] = useState<UnscheduledPoolFilters>(
    EMPTY_UNSCHEDULED_POOL_FILTERS
  )
  const unitTeachingTeams = useMemo(() => {
    if (!units) return undefined
    const map = new Map<string, string[]>()
    for (const unit of units) {
      map.set(
        unit.id,
        unit.lecturers.map((l) => `${l.title} ${l.first_name} ${l.last_name}`)
      )
    }
    return map
  }, [units])
  const externalQuery = externalSearch?.trim() ?? ''
  const filteredSessions = useMemo(() => {
    const base = filterUnscheduledSessions(
      sessions,
      filters,
      unitTeachingTeams,
      studentIndex
    )
    // Layer the grid controls' session search on top of the pool's own filters:
    // while it is active, hide sessions it does not match.
    if (externalQuery.length === 0) return base
    return base.filter((session) =>
      sessionMatchesSearch(
        session,
        externalQuery,
        studentIndex,
        unitTeachingTeams?.get(session.unit_id)
      )
    )
  }, [filters, sessions, unitTeachingTeams, studentIndex, externalQuery])
  const unitBuckets = useMemo(
    () => buildUnitBuckets(filteredSessions),
    [filteredSessions]
  )
  const schedulableCount = totalSchedulableCount ?? sessions.length
  const filtersActive = unscheduledPoolFiltersActive(filters)

  function clearFilters() {
    setFilters(EMPTY_UNSCHEDULED_POOL_FILTERS)
  }

  useEffect(() => {
    if (!pendingSessionId || !onSelectSession) return

    const isStillUnscheduled = sessions.some(
      (session) => session.session_id === pendingSessionId
    )
    const isStillVisible = filteredSessions.some(
      (session) => session.session_id === pendingSessionId
    )

    if (isStillUnscheduled && !isStillVisible) {
      onSelectSession(pendingSessionId)
    }
  }, [filteredSessions, onSelectSession, pendingSessionId, sessions])

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border p-4"
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
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          Sessions available for placement on the timetable, grouped by unit.
        </p>
      </div>

      {isLoading ? (
        <div
          className="flex items-center justify-center gap-2 rounded-md border border-dashed py-10"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color: 'var(--text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading sessions...
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
      ) : schedulableCount === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10"
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
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
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
      ) : sessions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-md border px-4 py-10 text-center"
          style={{
            borderColor: 'var(--state-success)',
            backgroundColor: 'var(--state-success-bg)',
          }}
        >
          <CheckCircle2
            className="h-8 w-8"
            style={{ color: 'var(--state-success)' }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--state-success)' }}
          >
            All schedulable sessions are scheduled.
          </p>
        </div>
      ) : (
        <div>
          <FilterBar
            isActive={filtersActive && unitBuckets.length > 0}
            onClear={clearFilters}
          >
            <SearchInput
              value={filters.search}
              onChange={(search) =>
                setFilters((current) => ({ ...current, search }))
              }
              label="Search unscheduled sessions"
              placeholder="Search unit or lecturer"
              className="w-full sm:w-72"
            />
            <FilterSelect
              value={filters.yearLevel}
              onChange={(yearLevel) =>
                setFilters((current) => ({
                  ...current,
                  yearLevel: yearLevel as UnscheduledPoolFilters['yearLevel'],
                }))
              }
              options={YEAR_LEVEL_OPTIONS}
              label="Filter unscheduled sessions by year level"
              className="h-9 w-36 text-sm"
            />
          </FilterBar>

          {unitBuckets.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-10 text-center"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <SearchX
                className="h-8 w-8"
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                No unscheduled sessions match your filters.
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div
              className="grid items-start gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 20rem))',
              }}
            >
              {unitBuckets.map((bucket) => (
                <UnitGroup
                  key={bucket.unitId}
                  unitId={bucket.unitId}
                  unitCode={bucket.unitCode}
                  unitName={bucket.unitName}
                  unitYearLevel={bucket.unitYearLevel}
                  sessions={bucket.sessions}
                  colorTokens={getSubjectTokens(bucket.unitCode)}
                  pendingSessionId={pendingSessionId}
                  editingDisabled={editingDisabled}
                  onSelectSession={onSelectSession}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
