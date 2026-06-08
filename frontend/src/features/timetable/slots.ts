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
  { id: 's1', label: '9:00-9:50', block: 'am' },
  { id: 's2', label: '10:00-10:50', block: 'am' },
  { id: 's3', label: '11:00-11:50', block: 'am' },
  { id: 's4', label: '1:30-2:20', block: 'pm' },
  { id: 's5', label: '2:30-3:20', block: 'pm' },
  { id: 's6', label: '3:30-4:20', block: 'pm' },
  { id: 's7', label: '4:30-5:20', block: 'pm' },
]

export const AM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'am')
export const PM_SLOTS = TIME_SLOTS.filter((s) => s.block === 'pm')

export const LUNCH_LABEL = '12:00'
