import { apiRequest, ApiRequestError } from '@/lib/api/client'

export type StudentTitle = 'Mr.' | 'Ms.' | 'Mx.'

export interface Student {
  id: string
  title: StudentTitle
  first_name: string
  last_name: string
  year_level: number
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
