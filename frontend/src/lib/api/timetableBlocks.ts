import { apiRequest, ApiRequestError } from '@/lib/api/client'
import type { AvailabilityDay, AvailabilitySlot } from '@/lib/api/lecturers'

// Unit 84/85: allowed colours for a *named* timetable block. Unnamed blocks
// store no colour. These string values mirror the backend `BlockColour` enum.
export type TimetableBlockColour = 'gold' | 'light_blue' | 'light_pink'

// A single room-specific reserved cell (day + slot + room).
export interface BlockCell {
  id: string
  day: AvailabilityDay
  slot: AvailabilitySlot
  room_id: string
}

// A block group: one or more reserved cells, optionally named + coloured.
export interface TimetableBlock {
  id: string
  name: string | null
  colour: TimetableBlockColour | null
  cells: BlockCell[]
  created_at: string
  updated_at: string
}

// Input cell shape for create/update (no server-assigned id).
export interface BlockCellInput {
  day: AvailabilityDay
  slot: AvailabilitySlot
  room_id: string
}

export interface TimetableBlockCreate {
  name?: string | null
  colour?: TimetableBlockColour | null
  cells: BlockCellInput[]
}

export interface TimetableBlockUpdate {
  name?: string | null
  colour?: TimetableBlockColour | null
  cells: BlockCellInput[]
}

// Create/update result: the persisted block plus any assignments the backend
// unscheduled because the block now reserves their cells.
export interface TimetableBlockMutationResponse {
  block: TimetableBlock
  unscheduled_session_ids: string[]
}

// Translate structured backend errors into readable messages for the editor.
function parseBlockError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const rawDetail =
      typeof err.detail === 'object' && err.detail !== null
        ? (err.detail as { detail?: unknown }).detail
        : undefined

    const detail =
      typeof rawDetail === 'string'
        ? rawDetail
        : Array.isArray(rawDetail)
          ? rawDetail
              .map((d) =>
                typeof d === 'object' &&
                d !== null &&
                'msg' in d &&
                typeof (d as { msg?: unknown }).msg === 'string'
                  ? (d as { msg: string }).msg
                  : null
              )
              .filter((m): m is string => Boolean(m))
              .join(' ')
          : undefined

    if (err.status === 404) {
      throw new ApiRequestError({
        status: 404,
        message: detail ?? 'Timetable block not found.',
        detail: err.detail,
      })
    }
    if (err.status === 409) {
      throw new ApiRequestError({
        status: 409,
        message: detail ?? 'One or more of those cells is already blocked.',
        detail: err.detail,
      })
    }
    if (err.status === 422) {
      throw new ApiRequestError({
        status: 422,
        message: detail ?? 'Invalid timetable block data.',
        detail: err.detail,
      })
    }
  }
  throw err
}

export async function listTimetableBlocks(): Promise<TimetableBlock[]> {
  return apiRequest<TimetableBlock[]>('/timetable-blocks')
}

export async function createTimetableBlock(
  data: TimetableBlockCreate
): Promise<TimetableBlockMutationResponse> {
  try {
    return await apiRequest<TimetableBlockMutationResponse>('/timetable-blocks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseBlockError(err)
  }
}

export async function updateTimetableBlock(
  blockGroupId: string,
  data: TimetableBlockUpdate
): Promise<TimetableBlockMutationResponse> {
  try {
    return await apiRequest<TimetableBlockMutationResponse>(
      `/timetable-blocks/${blockGroupId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    )
  } catch (err) {
    parseBlockError(err)
  }
}

export async function deleteTimetableBlock(blockGroupId: string): Promise<void> {
  try {
    return await apiRequest<void>(`/timetable-blocks/${blockGroupId}`, {
      method: 'DELETE',
    })
  } catch (err) {
    parseBlockError(err)
  }
}
