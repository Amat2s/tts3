import { describe, expect, it } from 'vitest'
import { getLecturerInitials } from './lecturerInitials'

describe('getLecturerInitials', () => {
  it('drops the title and takes first + last name initials', () => {
    expect(getLecturerInitials('Dr Ada Lovelace')).toBe('AL')
    expect(getLecturerInitials('Dr. Ada Lovelace')).toBe('AL')
    expect(getLecturerInitials('Prof. Grace Hopper')).toBe('GH')
    expect(getLecturerInitials('A/Prof. John Smith')).toBe('JS')
  })

  it('drops the two-token "Rev. Dr" title', () => {
    expect(getLecturerInitials('Rev. Dr Ada Lovelace')).toBe('AL')
    expect(getLecturerInitials('Rev Dr Grace Hopper')).toBe('GH')
  })

  it('handles a middle name by ignoring it', () => {
    expect(getLecturerInitials('Mr John Michael Smith')).toBe('JS')
    expect(getLecturerInitials('Rev. Dr John Michael Smith')).toBe('JS')
  })

  it('falls back gracefully for a two-part name with no title', () => {
    expect(getLecturerInitials('Ada Lovelace')).toBe('AL')
  })

  it('falls back gracefully for a single-word name', () => {
    expect(getLecturerInitials('Unassigned')).toBe('UN')
  })
})
