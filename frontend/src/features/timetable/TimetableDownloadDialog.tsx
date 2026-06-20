import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Suggested default; mirrors the `Campion - Timetable` brand. The admin can
// replace it before downloading.
export const DEFAULT_EXPORT_TITLE = 'Campion Timetable'

interface TimetableDownloadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called with the (untrimmed) title; the caller trims before the request.
  onDownload: (title: string) => void
  isExporting: boolean
  // Backend/export error shown inside the dialog; the dialog stays open on
  // failure so the admin can retry.
  error: string | null
}

/**
 * Collects a required title before exporting the saved timetable as Excel
 * (Unit 94). The title is embedded inside the generated workbook by the backend;
 * this dialog never builds the file itself. Download is disabled while the title
 * is blank or an export is already running.
 */
export function TimetableDownloadDialog({
  open,
  onOpenChange,
  onDownload,
  isExporting,
  error,
}: TimetableDownloadDialogProps) {
  const [title, setTitle] = useState(DEFAULT_EXPORT_TITLE)

  const trimmedTitle = title.trim()
  const canDownload = trimmedTitle.length > 0 && !isExporting

  function handleDownload() {
    if (!canDownload) return
    onDownload(title)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download timetable</DialogTitle>
          <DialogDescription>
            Export the current saved timetable as an Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timetable-export-title">Title</Label>
            <Input
              id="timetable-export-title"
              value={title}
              placeholder={DEFAULT_EXPORT_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isExporting}
              autoFocus
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              This title appears inside the downloaded Excel file.
            </p>
          </div>

          {error && (
            <p
              className="text-xs"
              style={{ color: 'var(--state-error)' }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            disabled={isExporting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canDownload}
            onClick={handleDownload}
            className="bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-primary-hover)]"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Downloading…
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
