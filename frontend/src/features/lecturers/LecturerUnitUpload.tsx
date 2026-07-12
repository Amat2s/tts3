import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { uploadLecturerCsv } from '@/lib/api/lecturers'
import type { LecturerImportResult } from '@/lib/api/lecturers'

/**
 * Aggregate counts shown in the lecturer/unit import success summary. Invalid
 * and deduped rows only appear when nonzero, matching the students summary's
 * treatment of skipped rows.
 */
function importSummaryItems(
  r: LecturerImportResult
): { label: string; value: number }[] {
  const items: { label: string; value: number }[] = [
    { label: 'Created lecturers', value: r.created_lecturers },
    { label: 'Created units', value: r.created_units },
    { label: 'Added team memberships', value: r.added_team_memberships },
  ]
  if (r.skipped_invalid_rows > 0) {
    items.push({ label: 'Skipped invalid rows', value: r.skipped_invalid_rows })
  }
  if (r.deduped_rows > 0) {
    items.push({ label: 'Deduped rows', value: r.deduped_rows })
  }
  return items
}

/**
 * Shared lecturer/unit CSV/Excel upload control (Unit 105). Owns the whole flow —
 * trigger button, dialog, file input, upload mutation, and success/error
 * summary — so `/units` and `/lecturers` render the exact same component and the
 * behaviour stays identical by construction. The upload drives the Unit 104
 * endpoint and, on success, invalidates the lecturer and unit caches from either
 * page.
 */
export function LecturerUnitUpload() {
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LecturerImportResult | null>(null)
  // Force-remount the native file input after a successful upload so its
  // displayed filename clears (an input's value cannot be set programmatically).
  const [fileInputKey, setFileInputKey] = useState(0)

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadLecturerCsv(f),
    onSuccess: (importResult) => {
      // The import can create lecturers/units and add teaching-team links, so
      // both lists change. No student allocations are touched, so the
      // schedulable-session / assignment queries do not need invalidation.
      qc.invalidateQueries({ queryKey: ['lecturers'] })
      qc.invalidateQueries({ queryKey: ['units'] })
      setResult(importResult)
      setError(null)
      setFile(null)
      setFileInputKey((k) => k + 1)
    },
    onError: (err: Error) => {
      setError(err.message)
      setResult(null)
    },
  })

  function resetState() {
    setFile(null)
    setError(null)
    setResult(null)
    uploadMutation.reset()
  }

  function handleUpload() {
    if (!file || uploadMutation.isPending) return
    setError(null)
    uploadMutation.mutate(file)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
          resetState()
        }}
      >
        <Upload className="h-4 w-4" />
        Upload lecturers &amp; units
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetState()
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Upload lecturers &amp; units</DialogTitle>
            <DialogDescription>
              Import lecturers, units, and their teaching teams from a CSV or
              Excel file. Lecturers and units are matched by name/code or created;
              teaching-team memberships are added without replacing existing ones.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div
              className="rounded-md border px-3 py-2.5 text-xs"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-secondary)',
              }}
            >
              <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Expected columns
              </p>
              <p className="font-mono break-words">
                TITLE, LAST NAME, FIRST NAME, AVAILABILITY, UNIT CODE, UNIT NAME
              </p>
              <p className="mt-1.5">
                <span className="font-mono">AVAILABILITY</span> is accepted but not
                imported yet.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lecturer-csv-file">CSV or Excel file</Label>
              <Input
                key={fileInputKey}
                id="lecturer-csv-file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  // Picking a new file clears any prior outcome so the summary
                  // always reflects the most recent upload attempt.
                  setResult(null)
                  setError(null)
                }}
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
                style={{
                  borderColor: 'var(--state-error)',
                  backgroundColor: 'var(--state-error-bg)',
                  color: 'var(--state-error)',
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div
                className="rounded-md border px-3 py-2.5"
                style={{
                  borderColor: 'var(--state-success)',
                  backgroundColor: 'var(--state-success-bg)',
                }}
              >
                <div
                  className="flex items-center gap-2 mb-2 text-sm font-medium"
                  style={{ color: 'var(--state-success)' }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Import complete</span>
                </div>
                <dl
                  className="grid gap-y-1 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {importSummaryItems(result).map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4"
                    >
                      <dt>{item.label}</dt>
                      <dd
                        className="font-medium tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <DialogFooter showCloseButton>
            <Button onClick={handleUpload} disabled={!file || uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
