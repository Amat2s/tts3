import { describe, expect, it } from 'vitest'
import { slotLabel, slotLabels, formatAffectedSlots } from './slot-label'

describe('slotLabel', () => {
  it('converts a slot ID to its human time range', () => {
    expect(slotLabel('s1')).toBe('9:00-9:50')
    expect(slotLabel('s4')).toBe('1:30-2:20')
    expect(slotLabel('s7')).toBe('4:30-5:20')
  })

  it('falls back to the raw value for an unknown slot ID', () => {
    expect(slotLabel('s99')).toBe('s99')
  })
})

describe('slotLabels', () => {
  it('maps a list of slot IDs preserving order', () => {
    expect(slotLabels(['s4', 's1'])).toEqual(['1:30-2:20', '9:00-9:50'])
  })
})

describe('formatAffectedSlots', () => {
  it('formats zero, one, two, and many slots for messages', () => {
    expect(formatAffectedSlots([])).toBe('')
    expect(formatAffectedSlots(['s4'])).toBe('1:30-2:20')
    expect(formatAffectedSlots(['s4', 's5'])).toBe('1:30-2:20 and 2:30-3:20')
    expect(formatAffectedSlots(['s4', 's5', 's6'])).toBe(
      '1:30-2:20, 2:30-3:20, and 3:30-4:20'
    )
  })
})
