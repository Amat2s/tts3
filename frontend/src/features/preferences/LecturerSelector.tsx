import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Lecturer } from '@/lib/api/lecturers'

interface LecturerSelectorProps {
  lecturers: Lecturer[]
  value: string | null
  onChange: (lecturerId: string) => void
  disabled?: boolean
}

export function lecturerDisplayName(lecturer: Lecturer): string {
  return `${lecturer.title} ${lecturer.first_name} ${lecturer.last_name}`
}

// Unit 99: single-select lecturer picker above the preferences grid. Sourced
// from the existing lecturers query; the selection is local UI state only in
// this unit (no persisted-preference highlighting is wired to it yet).
export function LecturerSelector({
  lecturers,
  value,
  onChange,
  disabled = false,
}: LecturerSelectorProps) {
  // Resolve the selected lecturer so the trigger renders their display name.
  // Radix `SelectValue` otherwise falls back to the raw `value` (the lecturer
  // id) once a selection is made, which surfaced the ID instead of the name.
  const selected = value
    ? (lecturers.find((lecturer) => lecturer.id === value) ?? null)
    : null

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
        id="preference-lecturer-label"
      >
        Lecturer
      </label>
      <Select
        value={value ?? undefined}
        onValueChange={(v) => onChange(v as string)}
        disabled={disabled || lecturers.length === 0}
      >
        <SelectTrigger
          className="w-72"
          aria-labelledby="preference-lecturer-label"
        >
          <SelectValue
            placeholder={
              lecturers.length === 0
                ? 'No lecturers available'
                : 'Select a lecturer'
            }
          >
            {selected ? lecturerDisplayName(selected) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {lecturers.map((lecturer) => (
            <SelectItem key={lecturer.id} value={lecturer.id}>
              {lecturerDisplayName(lecturer)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
