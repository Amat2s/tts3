import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Reusable management-page search field. A leading search icon plus an
 * `aria-label`ed input so the control is accessible without a visible label.
 * Purely presentational — filtering happens in the per-domain filter helpers.
 */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder = 'Search',
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Accessible label for the field (no visible label in the filter bar). */
  label: string
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className ?? 'w-64'}`}>
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4"
        style={{ color: 'var(--text-muted)' }}
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-8 h-9 text-sm"
      />
    </div>
  )
}
