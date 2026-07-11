import { parseUnitYearLevel } from '@/features/units/yearLevel'
import type { YearLevel } from '@/lib/api/students'
import type { SchedulableSession } from '@/lib/api/sessions'
import { sessionMatchesSearch, type StudentSearchIndex } from './sessionFilter'

// Stable ordering for the session stack inside each unit box.
const SESSION_TYPE_ORDER: Record<SchedulableSession['session_type'], number> = {
  lecture: 0,
  tutorial: 1,
  seminar: 2,
}

export type YearLevelFilter = 'all' | `${YearLevel}`

export interface UnscheduledPoolFilters {
  search: string
  yearLevel: YearLevelFilter
}

export interface UnitBucket {
  unitId: string
  unitCode: string
  unitName: string
  unitYearLevel?: YearLevel
  sessions: SchedulableSession[]
}

export const EMPTY_UNSCHEDULED_POOL_FILTERS: UnscheduledPoolFilters = {
  search: '',
  yearLevel: 'all',
}

export function getSessionYearLevel(
  session: SchedulableSession
): YearLevel | undefined {
  if (session.unit_year_level !== undefined) {
    return session.unit_year_level
  }

  // Unit codes remain authoritative for the derived year while the existing
  // schedulable-session DTO does not expose this metadata.
  const parsed = parseUnitYearLevel(session.unit_code)
  return parsed.ok ? parsed.year : undefined
}

export function unscheduledPoolFiltersActive(
  filters: UnscheduledPoolFilters
): boolean {
  return filters.search.trim().length > 0 || filters.yearLevel !== 'all'
}

export function filterUnscheduledSessions(
  sessions: SchedulableSession[],
  filters: UnscheduledPoolFilters,
  unitTeachingTeams?: Map<string, string[]>,
  // Unit 108: resolves allocated student ids to searchable name/number text so
  // the pool search also matches students, in addition to unit and lecturer.
  studentIndex?: StudentSearchIndex,
): SchedulableSession[] {
  return sessions.filter((session) => {
    if (
      filters.yearLevel !== 'all' &&
      getSessionYearLevel(session) !== Number(filters.yearLevel)
    ) {
      return false
    }

    return sessionMatchesSearch(
      session,
      filters.search,
      studentIndex,
      unitTeachingTeams?.get(session.unit_id)
    )
  })
}

export function buildUnitBuckets(
  sessions: SchedulableSession[]
): UnitBucket[] {
  const bucketsByUnit = new Map<string, UnitBucket>()

  for (const session of sessions) {
    const existing = bucketsByUnit.get(session.unit_id)
    if (existing) {
      existing.sessions.push(session)
      continue
    }

    bucketsByUnit.set(session.unit_id, {
      unitId: session.unit_id,
      unitCode: session.unit_code,
      unitName: session.unit_name,
      unitYearLevel: getSessionYearLevel(session),
      sessions: [session],
    })
  }

  const buckets = Array.from(bucketsByUnit.values()).filter(
    (bucket) => bucket.sessions.length > 0
  )

  buckets.sort((a, b) => {
    const yearOrder =
      (a.unitYearLevel ?? Number.MAX_SAFE_INTEGER) -
      (b.unitYearLevel ?? Number.MAX_SAFE_INTEGER)
    if (yearOrder !== 0) return yearOrder

    const codeOrder = a.unitCode.localeCompare(b.unitCode)
    if (codeOrder !== 0) return codeOrder

    return a.unitName.localeCompare(b.unitName)
  })

  for (const bucket of buckets) {
    bucket.sessions.sort((a, b) => {
      const typeOrder =
        SESSION_TYPE_ORDER[a.session_type] - SESSION_TYPE_ORDER[b.session_type]
      if (typeOrder !== 0) return typeOrder

      const lecturerOrder = a.lecturer_display_name.localeCompare(
        b.lecturer_display_name
      )
      if (lecturerOrder !== 0) return lecturerOrder

      return a.session_id.localeCompare(b.session_id)
    })
  }

  return buckets
}
