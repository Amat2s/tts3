import { apiRequest, ApiRequestError } from '@/lib/api/client'

export type RoomType = 'lecture' | 'tutorial'

export interface Room {
  id: string
  name: string
  capacity: number
  room_type: RoomType
  /** Persisted left-to-right timetable column order (Unit 113). */
  position: number
  created_at: string
  updated_at: string
}

export interface RoomCreate {
  name: string
  capacity: number
  room_type: RoomType
}

export interface RoomUpdate {
  name?: string
  capacity?: number
  room_type?: RoomType
}

function parseRoomError(err: unknown): never {
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
    if (err.status === 409 || (detail && detail.includes('already exists'))) {
      throw new ApiRequestError({ status: 409, message: 'A room with that name already exists.', detail: err.detail })
    }
    if (err.status === 422) {
      throw new ApiRequestError({ status: 422, message: detail ?? 'Invalid room data.', detail: err.detail })
    }
  }
  throw err
}

export async function listRooms(): Promise<Room[]> {
  return apiRequest<Room[]>('/rooms')
}

export async function createRoom(data: RoomCreate): Promise<Room> {
  try {
    return await apiRequest<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseRoomError(err)
  }
}

export async function updateRoom(roomId: string, data: RoomUpdate): Promise<Room> {
  try {
    return await apiRequest<Room>(`/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  } catch (err) {
    parseRoomError(err)
  }
}

export async function deleteRoom(roomId: string): Promise<void> {
  return apiRequest<void>(`/rooms/${roomId}`, { method: 'DELETE' })
}

/**
 * Persist a new room order (Unit 113/114). `orderedIds` is the full set of room
 * ids in the desired left-to-right order; the backend assigns each its index as
 * `position` and returns the reordered rooms. The reorder UI fires this in the
 * background and never blocks on it.
 */
export async function reorderRooms(orderedIds: string[]): Promise<Room[]> {
  try {
    return await apiRequest<Room[]>('/rooms/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ordered_ids: orderedIds }),
    })
  } catch (err) {
    parseRoomError(err)
  }
}
