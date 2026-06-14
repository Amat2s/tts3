import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface FilterOption {
  value: string
  label: string
}

/**
 * Reusable management-page filter dropdown. Wraps the shadcn `Select` with an
 * accessible `aria-label` (no visible label in the filter bar) and a fixed list
 * of `{ value, label }` options. The first option is treated as the default the
 * control falls back to if the primitive ever reports a null value.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  label,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  label: string
  placeholder?: string
  className?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange((v as string | null) ?? options[0]?.value ?? '')}
      items={options}
    >
      <SelectTrigger aria-label={label} className={className ?? 'h-9 text-sm w-48'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
