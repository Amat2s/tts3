export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'

export const DAYS: Day[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
]

export type SlotBlock = 'am' | 'pm'

export interface TimeSlot {
  id: string
  label: string
  block: SlotBlock
}

export const TIME_SLOTS: TimeSlot[] = [
  { id: 's1', label: '9:00', block: 'am' },
  { id: 's2', label: '10:00', block: 'am' },
  { id: 's3', label: '11:00', block: 'am' },
  { id: 's4', label: '13:00', block: 'pm' },
  { id: 's5', label: '14:00', block: 'pm' },
  { id: 's6', label: '15:00', block: 'pm' },
  { id: 's7', label: '16:00', block: 'pm' },
]

export const AM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'am')
export const PM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'pm')

export const LUNCH_LABEL = '12:00'
