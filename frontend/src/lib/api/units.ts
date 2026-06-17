import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { LecturerTitle } from '@/lib/api/lecturers'
import type { YearLevel } from '@/lib/api/students'

export type { YearLevel }

export interface LecturerSummary {
  id: string
  title: LecturerTitle
  first_name: string
  last_name: string
}

export interface StudentSummary {
  id: string
  first_name: string
  last_name: string
  year_level: YearLevel
}

export interface Unit {
  id: string
  code: string
  name: string
  // Derived server-side from the unit code's first digit (Unit 58).
  year_level: YearLevel
  // Unit 59: a unit is taught by a team of lecturers, not a single lecturer.
  lecturers: LecturerSummary[]
  students: StudentSummary[]
  created_at: string
  updated_at: string
}

export interface UnitCreate {
  code: string
  name: string
  // At least one teaching lecturer is required (validated server-side).
  lecturer_ids: string[]
  student_ids?: string[]
  // `year_level` is never an input — it is derived from `code` server-side.
}

export interface UnitUpdate {
  code?: string
  name?: string
  // When supplied, replaces the teaching team (must keep at least one).
  lecturer_ids?: string[]
  student_ids?: string[]
}

function parseUnitError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const rawDetail =
      typeof err.detail === 'object' && err.detail !== null
        ? (err.detail as { detail?: unknown }).detail
        : undefined

    const detail =
      typeof rawDetail === 'string'
        ? rawDetail
        : Array.isArray(rawDetail)
          ? rawDetail
              .map((d) =>
                typeof d === 'object' &&
                d !== null &&
                'msg' in d &&
                typeof (d as { msg?: unknown }).msg === 'string'
                  ? (d as { msg: string }).msg
                  : null
              )
              .filter((m): m is string => Boolean(m))
              .join(' ')
          : undefined

    if (err.status === 409 || (detail && detail.includes('already exists'))) {
      throw new ApiRequestError({ status: 409, message: 'A unit with that code already exists.', detail: err.detail })
    }
    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid unit data.', detail: err.detail })
    }
  }
  throw err
}

export async function listUnits(): Promise<Unit[]> {
  return apiRequest<Unit[]>('/units')
}

export async function createUnit(data: UnitCreate): Promise<Unit> {
  try {
    return await apiRequest<Unit>('/units', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseUnitError(err)
  }
}

export async function updateUnit(unitId: string, data: UnitUpdate): Promise<Unit> {
  try {
    return await apiRequest<Unit>(`/units/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseUnitError(err)
  }
}

export async function deleteUnit(unitId: string): Promise<void> {
  return apiRequest<void>(`/units/${unitId}`, { method: 'DELETE' })
}
