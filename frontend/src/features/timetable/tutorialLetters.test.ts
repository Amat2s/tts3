import { describe, expect, it } from 'vitest'
import { computeTutorialLetters } from './tutorialLetters'
import { makeAssignment } from '@/test/fixtures'

const rooms = [
  { id: 'r-pds', name: 'PDS' },
  { id: 'r-l105', name: 'L1.05' },
]

describe('computeTutorialLetters', () => {
  it('letters tutorials per unit in day/slot/room order, ignoring lectures', () => {
    const letters = computeTutorialLetters(
      [
        makeAssignment({
          session_id: 'tut-mon',
          session_type: 'tutorial',
          unit_id: 'unit-1',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'r-pds',
        }),
        makeAssignment({
          session_id: 'tut-tue',
          session_type: 'tutorial',
          unit_id: 'unit-1',
          day: 'Tuesday',
          start_slot: 's1',
          room_id: 'r-pds',
        }),
        makeAssignment({
          session_id: 'lec-1',
          session_type: 'lecture',
          unit_id: 'unit-1',
          day: 'Monday',
          start_slot: 's2',
          room_id: 'r-pds',
        }),
      ],
      rooms
    )

    expect(letters.get('tut-mon')).toBe('A')
    expect(letters.get('tut-tue')).toBe('B')
    expect(letters.has('lec-1')).toBe(false)
  })

  it('breaks same day/slot ties by the fixed export room order', () => {
    const letters = computeTutorialLetters(
      [
        makeAssignment({
          session_id: 'tut-l105',
          session_type: 'tutorial',
          unit_id: 'unit-1',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'r-l105',
        }),
        makeAssignment({
          session_id: 'tut-pds',
          session_type: 'tutorial',
          unit_id: 'unit-1',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'r-pds',
        }),
      ],
      rooms
    )

    // PDS precedes L1.05 in the fixed export room order.
    expect(letters.get('tut-pds')).toBe('A')
    expect(letters.get('tut-l105')).toBe('B')
  })

  it('letters tutorials independently per unit', () => {
    const letters = computeTutorialLetters(
      [
        makeAssignment({
          session_id: 'u1-tut',
          session_type: 'tutorial',
          unit_id: 'unit-1',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'r-pds',
        }),
        makeAssignment({
          session_id: 'u2-tut',
          session_type: 'tutorial',
          unit_id: 'unit-2',
          day: 'Monday',
          start_slot: 's1',
          room_id: 'r-l105',
        }),
      ],
      rooms
    )

    expect(letters.get('u1-tut')).toBe('A')
    expect(letters.get('u2-tut')).toBe('A')
  })
})
