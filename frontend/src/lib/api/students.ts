import { apiRequest, ApiRequestError } from '@/lib/api/client'

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
  // Unit 89: the canonical institutional identifier (exactly 8 digits),
  // distinct from the internal `id`.
  student_number: string
  first_name: string
  last_name: string
  year_level: YearLevel
  units: UnitSummary[]
  unit_count: number
  created_at: string
  updated_at: string
}

export interface StudentCreate {
  student_number: string
  first_name: string
  last_name: string
  year_level: YearLevel
}

export interface StudentUpdate {
  student_number?: string
  first_name?: string
  last_name?: string
  year_level?: YearLevel
}

// Unit 90/91: aggregate outcome of a student CSV import. Mirrors the backend
// `StudentImportResult` — counts only, never student lists or raw rows.
export interface StudentImportResult {
  created_students: number
  updated_students: number
  added_enrolments: number
  skipped_unknown_unit_rows: number
  skipped_invalid_rows: number
  skipped_past_census_rows: number
  deduped_rows: number
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

/**
 * Upload a student-enrolment CSV to the protected backend import endpoint.
 *
 * Sends a multipart request through the authenticated API client (which omits
 * the JSON `Content-Type` for `FormData` so the browser sets the multipart
 * boundary). Structural backend errors arrive as structured `AppError`
 * envelopes whose human message is already surfaced on `ApiRequestError.message`,
 * so we let them propagate for the caller to display.
 */
export async function uploadStudentCsv(file: File): Promise<StudentImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest<StudentImportResult>('/students/import-csv', {
    method: 'POST',
    body: formData,
  })
}
