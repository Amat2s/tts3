import { apiRequestBlob, type BinaryResponse } from '@/lib/api/client'

/**
 * Outcome of a saved-timetable Excel export request: the backend-generated
 * `.xlsx` blob plus the filename advertised in `Content-Disposition` (when the
 * backend provides one). The workbook is generated entirely server-side; the
 * browser never parses it.
 */
export type TimetableExportResult = BinaryResponse

/**
 * Export the current SAVED timetable as an `.xlsx` blob (Unit 94).
 *
 * Calls the Unit 93 backend endpoint `GET /timetable/export.xlsx?title=…` through
 * the authenticated binary client. The title is sent verbatim as a query param
 * (callers trim it first) and is rendered inside the workbook by the backend.
 * Structured backend errors are surfaced as readable messages by the shared
 * client and propagate to the caller.
 */
export async function exportSavedTimetableExcel(input: {
  title: string
}): Promise<TimetableExportResult> {
  const params = new URLSearchParams({ title: input.title })
  return apiRequestBlob(`/timetable/export.xlsx?${params.toString()}`, {
    method: 'GET',
  })
}

// Two-digit zero-padded helper for the local-date fallback filename.
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Fallback download filename used when the backend response carries no
 * `Content-Disposition` filename: `campion-timetable-YYYY-MM-DD.xlsx` using the
 * local date.
 */
export function fallbackExportFilename(today: Date = new Date()): string {
  const yyyy = today.getFullYear()
  const mm = pad2(today.getMonth() + 1)
  const dd = pad2(today.getDate())
  return `campion-timetable-${yyyy}-${mm}-${dd}.xlsx`
}

/**
 * Trigger a browser download of an already-fetched blob under `filename`.
 *
 * Creates a short-lived object URL, clicks a synthetic anchor, and revokes the
 * URL once the download has been triggered.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
