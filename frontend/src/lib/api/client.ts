import { supabase } from '@/lib/supabase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export interface ApiError {
  status: number
  message: string
  detail?: unknown
}

export class ApiRequestError extends Error {
  readonly status: number
  readonly detail?: unknown

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.status = error.status
    this.detail = error.detail
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  const text = await response.text()
  let body: unknown = null
  let parseError = false
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      parseError = true
      body = { detail: text }
    }
  }

  if (response.status === 401) {
    throw new ApiRequestError({ status: 401, message: 'Unauthorized' })
  }

  if (!response.ok) {
    const detail = (body as { detail?: string } | null)?.detail
    const message = detail ?? `Request failed with status ${response.status}`
    throw new ApiRequestError({ status: response.status, message, detail: body })
  }

  if (parseError) {
    throw new ApiRequestError({
      status: response.status,
      message: 'Server returned an unexpected response. Is the API base URL configured correctly?',
    })
  }

  return body as T
}
