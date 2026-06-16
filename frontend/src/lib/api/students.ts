import { apiRequest, ApiRequestError } from '@/lib/api/client'

export type StudentTitle = 'Mr.' | 'Ms.' | 'Mx.'

// Post-v1 (Unit 58): the product operates over three year levels only. This is
// the single source of truth for the year-level union, reused by unit DTOs.
export type YearLevel = 1 | 2 | 3

// Lightweight summary of a unit a student is enrolled in. Mirrors the backend
// `EnrolledUnitSummary`. Enrolment is managed server-side (auto by matching
// year), so there is no client-side enrolment input in this unit.
export interface UnitSummary {
  id: string
  code: string
  name: string
  year_level: YearLevel
}

export interface Student {
  id: string
  title: StudentTitle
  first_name: string
  last_name: string
  year_level: YearLevel
  units: UnitSummary[]
  unit_count: number
  created_at: string
  updated_at: string
}

export interface StudentCreate {
  title: StudentTitle
  first_name: string
  last_name: string
  year_level: number
}

export interface StudentUpdate {
  title?: StudentTitle
  first_name?: string
  last_name?: string
  year_level?: number
}

function parseStudentError(err: unknown): never {
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

    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid student data.', detail: err.detail })
    }
  }
  throw err
}

export async function listStudents(): Promise<Student[]> {
  return apiRequest<Student[]>('/students')
}

export async function createStudent(data: StudentCreate): Promise<Student> {
  try {
    return await apiRequest<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseStudentError(err)
  }
}

export async function updateStudent(studentId: string, data: StudentUpdate): Promise<Student> {
  try {
    return await apiRequest<Student>(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseStudentError(err)
  }
}

export async function deleteStudent(studentId: string): Promise<void> {
  return apiRequest<void>(`/students/${studentId}`, { method: 'DELETE' })
}
