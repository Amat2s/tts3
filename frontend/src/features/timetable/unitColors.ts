const COLOR_VARIANTS = ['maroon', 'gold', 'blue', 'green', 'purple', 'stone'] as const

export type UnitColorVariant = (typeof COLOR_VARIANTS)[number]

export function getUnitColor(identifier: string): UnitColorVariant {
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 31 + identifier.charCodeAt(i)) >>> 0
  }
  return COLOR_VARIANTS[hash % COLOR_VARIANTS.length]
}
