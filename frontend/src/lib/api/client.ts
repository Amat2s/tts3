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

  // For multipart uploads (FormData) the browser must set its own
  // `Content-Type` including the boundary, so we never force JSON headers.
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    const parsed = body as
      | { detail?: unknown; error?: { message?: unknown } }
      | null

    const detailMessage =
      typeof parsed?.detail === 'string' ? parsed.detail : undefined
    const envelopeMessage =
      typeof parsed?.error?.message === 'string' ? parsed.error.message : undefined

    const message =
      envelopeMessage ??
      detailMessage ??
      `Request failed with status ${response.status}`

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

export interface BinaryResponse {
  blob: Blob
  // Filename parsed from the response `Content-Disposition` header, if present.
  filename: string | null
}

// Parse a download filename out of a `Content-Disposition` header. Handles the
// RFC 5987 extended form (`filename*=UTF-8''…`) and the plain quoted/unquoted
// `filename="…"` form. Returns null when no filename is advertised.
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null

  const extended = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''))
    } catch {
      // Fall through to the plain form on a malformed percent-encoding.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header)
  if (plain?.[1]) return plain[1].trim()

  return null
}

/**
 * Authenticated binary GET for file downloads (Unit 94).
 *
 * `apiRequest` reads the body as text and parses JSON, which would corrupt a
 * binary payload, so binary endpoints use this helper instead. It reuses the
 * same Supabase bearer-token auth and structured-error handling: a failed
 * request still returns a JSON error envelope, which is parsed for a readable
 * message rather than read as a blob.
 */
export async function apiRequestBlob(
  path: string,
  options: RequestInit = {}
): Promise<BinaryResponse> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (response.status === 401) {
    throw new ApiRequestError({ status: 401, message: 'Unauthorized' })
  }

  if (!response.ok) {
    const text = await response.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text) as unknown
      } catch {
        body = { detail: text }
      }
    }

    const parsed = body as
      | { detail?: unknown; error?: { message?: unknown } }
      | null

    const detailMessage =
      typeof parsed?.detail === 'string' ? parsed.detail : undefined
    const envelopeMessage =
      typeof parsed?.error?.message === 'string' ? parsed.error.message : undefined

    const message =
      envelopeMessage ??
      detailMessage ??
      `Request failed with status ${response.status}`

    throw new ApiRequestError({ status: response.status, message, detail: body })
  }

  const blob = await response.blob()
  const filename = parseContentDispositionFilename(
    response.headers.get('Content-Disposition')
  )
  return { blob, filename }
}
