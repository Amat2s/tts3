import { describe, expect, it } from 'vitest'
import { ApiRequestError } from '@/lib/api/client'
import { deleteBlockedMessage, GENERIC_DELETE_BLOCKED_MESSAGE } from './deleteErrorMessage'

describe('deleteBlockedMessage (Unit 112)', () => {
  it('surfaces the backend structured 409 message verbatim', () => {
    const err = new ApiRequestError({
      status: 409,
      message: "Can't delete this lecturer yet — they're on the teaching team of HIS101.",
      detail: {
        error: {
          code: 'lecturer_delete_blocked',
          message: "Can't delete this lecturer yet — they're on the teaching team of HIS101.",
        },
      },
    })

    expect(deleteBlockedMessage(err)).toBe(
      "Can't delete this lecturer yet — they're on the teaching team of HIS101."
    )
  })

  it('falls back to the generic reason when no structured message is present', () => {
    const err = new ApiRequestError({ status: 500, message: 'Request failed with status 500' })
    expect(deleteBlockedMessage(err)).toBe(GENERIC_DELETE_BLOCKED_MESSAGE)
  })

  it('falls back to the generic reason when the structured message is blank', () => {
    const err = new ApiRequestError({
      status: 409,
      message: '  ',
      detail: { error: { code: 'room_delete_blocked', message: '   ' } },
    })
    expect(deleteBlockedMessage(err)).toBe(GENERIC_DELETE_BLOCKED_MESSAGE)
  })

  it('falls back to the generic reason for a non-ApiRequestError failure', () => {
    expect(deleteBlockedMessage(new Error('network down'))).toBe(GENERIC_DELETE_BLOCKED_MESSAGE)
  })
})
