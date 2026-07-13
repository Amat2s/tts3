import { apiRequest, ApiRequestError } from '@/lib/api/client'

// Unit 72/73: title set restricted to match the backend `LecturerTitle` enum.
// Punctuation is retained only for the two professor titles.
export type LecturerTitle = 'Mr' | 'Ms' | 'Mrs' | 'Dr' | 'Fr' | 'Rev. Dr' | 'A/Prof.' | 'Prof.'
export type AvailabilityDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
export type AvailabilitySlot = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'

export interface AvailabilityEntry {
  day: AvailabilityDay
  slot: AvailabilitySlot
}

export interface Lecturer {
  id: string
  title: LecturerTitle
  first_name: string
  last_name: string
  unavailable_slots: AvailabilityEntry[]
  created_at: string
  updated_at: string
}

export interface LecturerCreate {
  title: LecturerTitle
  first_name: string
  last_name: string
}

export interface LecturerUpdate {
  title?: LecturerTitle
  first_name?: string
  last_name?: string
}

export interface LecturerAvailabilitySet {
  unavailable: AvailabilityEntry[]
}

// Unit 104/105: aggregate outcome of a lecturer/unit spreadsheet import. Mirrors
// the backend `LecturerImportResult` — counts only, never lecturer/unit lists or
// raw rows. `added_team_memberships` excludes links that already existed.
export interface LecturerImportResult {
  created_lecturers: number
  created_units: number
  added_team_memberships: number
  skipped_invalid_rows: number
  deduped_rows: number
}

function parseLecturerError(err: unknown): never {
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
      throw new ApiRequestError({ status: 409, message: 'A lecturer with that name already exists.', detail: err.detail })
    }
    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid lecturer data.', detail: err.detail })
    }
  }
  throw err
}

export async function listLecturers(): Promise<Lecturer[]> {
  return apiRequest<Lecturer[]>('/lecturers')
}

export async function createLecturer(data: LecturerCreate): Promise<Lecturer> {
  try {
    return await apiRequest<Lecturer>('/lecturers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseLecturerError(err)
  }
}

export async function updateLecturer(lecturerId: string, data: LecturerUpdate): Promise<Lecturer> {
  try {
    return await apiRequest<Lecturer>(`/lecturers/${lecturerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseLecturerError(err)
  }
}

export async function deleteLecturer(lecturerId: string): Promise<void> {
  return apiRequest<void>(`/lecturers/${lecturerId}`, { method: 'DELETE' })
}

export async function deleteAllLecturers(): Promise<void> {
  return apiRequest<void>('/lecturers', { method: 'DELETE' })
}

export async function setLecturerAvailability(
  lecturerId: string,
  data: LecturerAvailabilitySet
): Promise<Lecturer> {
  try {
    return await apiRequest<Lecturer>(`/lecturers/${lecturerId}/availability`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseLecturerError(err)
  }
}

/**
 * Upload a lecturer/unit CSV or Excel file to the protected Unit 104 import
 * endpoint.
 *
 * Sends a multipart request through the authenticated API client (which omits
 * the JSON `Content-Type` for `FormData` so the browser sets the multipart
 * boundary). Structured backend errors arrive as `AppError` envelopes whose
 * human message is already surfaced on `ApiRequestError.message`, so we let them
 * propagate for the caller to display — mirroring `uploadStudentCsv`.
 */
export async function uploadLecturerCsv(file: File): Promise<LecturerImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest<LecturerImportResult>('/lecturers/import-csv', {
    method: 'POST',
    body: formData,
  })
}
