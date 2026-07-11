import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// --- Module mocks --------------------------------------------------------
// The Supabase client is built at import time from env vars; stub it so the API
// client layer never reaches a real network/env dependency.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock('@/components/layout/AppFrame', () => ({
  AppFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api/rooms', () => ({
  listRooms: vi.fn(),
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
  reorderRooms: vi.fn(),
}))

import RoomsPage from './rooms'
import { listRooms, deleteRoom, reorderRooms } from '@/lib/api/rooms'
import type { Room } from '@/lib/api/rooms'
import { ApiRequestError } from '@/lib/api/client'
import { makeRoom } from '@/test/fixtures'

const mockListRooms = vi.mocked(listRooms)
const mockDeleteRoom = vi.mocked(deleteRoom)
const mockReorderRooms = vi.mocked(reorderRooms)

function renderRooms() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RoomsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...utils }
}

beforeEach(() => {
  mockListRooms.mockResolvedValue([makeRoom({ id: 'room-1', name: 'Bromley' })])
})

afterEach(() => {
  vi.clearAllMocks()
})

// Unit 112: surfacing the Unit 111 structured delete-blocked reason.
describe('RoomsPage — delete-blocked error surfacing (Unit 112)', () => {
  it('shows the backend reason and keeps the row when the delete is blocked', async () => {
    const user = userEvent.setup()
    mockDeleteRoom.mockRejectedValue(
      new ApiRequestError({
        status: 409,
        message: "Can't delete this room yet — it's still referenced elsewhere.",
        detail: {
          error: {
            code: 'room_delete_blocked',
            message: "Can't delete this room yet — it's still referenced elsewhere.",
          },
        },
      })
    )
    renderRooms()
    await screen.findByText('Bromley')

    await user.click(screen.getByRole('button', { name: /Delete/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete room/ }))

    expect(
      await screen.findByText("Can't delete this room yet — it's still referenced elsewhere.")
    ).toBeInTheDocument()
    // The row must stay present; a blocked delete never optimistically removes it.
    expect(
      within(screen.getByRole('table', { hidden: true })).getByText('Bromley')
    ).toBeInTheDocument()
  })

  it('falls back to a generic reason when no structured message is present', async () => {
    const user = userEvent.setup()
    mockDeleteRoom.mockRejectedValue(new Error('boom'))
    renderRooms()
    await screen.findByText('Bromley')

    await user.click(screen.getByRole('button', { name: /Delete/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete room/ }))

    expect(
      await screen.findByText("Couldn't delete — it's still in use.")
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { hidden: true })).getByText('Bromley')
    ).toBeInTheDocument()
  })

  it('removes the row with no error on a successful delete', async () => {
    const user = userEvent.setup()
    mockDeleteRoom.mockResolvedValue(undefined)
    mockListRooms
      .mockResolvedValueOnce([makeRoom({ id: 'room-1', name: 'Bromley' })])
      .mockResolvedValueOnce([])
    renderRooms()
    await screen.findByText('Bromley')

    await user.click(screen.getByRole('button', { name: /Delete/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: /Delete room/ }))

    await waitFor(() => expect(screen.queryByText('Bromley')).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// Unit 114: optimistic room reordering via move-up/down buttons.
describe('RoomsPage — room reordering (Unit 114)', () => {
  const THREE_ROOMS = [
    makeRoom({ id: 'room-1', name: 'Alpha', position: 0 }),
    makeRoom({ id: 'room-2', name: 'Beta', position: 1 }),
    makeRoom({ id: 'room-3', name: 'Gamma', position: 2 }),
  ]

  function renderedRoomOrder(): string[] {
    const table = screen.getByRole('table')
    return within(table)
      .getAllByRole('row')
      .slice(1) // drop the header row
      .map((row) => within(row).getAllByRole('cell')[0].textContent ?? '')
  }

  it('moves a room down instantly and sends the full swapped order to reorderRooms', async () => {
    const user = userEvent.setup()
    mockListRooms.mockResolvedValue(THREE_ROOMS)
    // Never resolves: proves the UI reorders without waiting on the network.
    mockReorderRooms.mockImplementation(() => new Promise<Room[]>(() => {}))
    renderRooms()
    await screen.findByText('Alpha')

    expect(renderedRoomOrder()).toEqual(['Alpha', 'Beta', 'Gamma'])

    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }))

    // Optimistic reorder is visible while the persist call is still pending.
    await waitFor(() =>
      expect(renderedRoomOrder()).toEqual(['Beta', 'Alpha', 'Gamma'])
    )
    expect(mockReorderRooms).toHaveBeenCalledWith(['room-2', 'room-1', 'room-3'])
  })

  it('disables move-up on the first row and move-down on the last', async () => {
    mockListRooms.mockResolvedValue(THREE_ROOMS)
    renderRooms()
    await screen.findByText('Alpha')

    expect(screen.getByRole('button', { name: 'Move Alpha up' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Alpha down' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Move Gamma down' })
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Gamma up' })).toBeEnabled()
  })

  it('disables reorder buttons and shows a hint while a filter is active', async () => {
    const user = userEvent.setup()
    mockListRooms.mockResolvedValue(THREE_ROOMS)
    renderRooms()
    await screen.findByText('Alpha')

    await user.type(
      screen.getByPlaceholderText('Search by room name'),
      'Alpha'
    )

    await waitFor(() =>
      expect(screen.queryByText('Beta')).toBeNull()
    )
    expect(
      screen.getByRole('button', { name: 'Move Alpha up' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Alpha down' })
    ).toBeDisabled()
    expect(screen.getByText('Clear filters to reorder rooms.')).toBeInTheDocument()
    expect(mockReorderRooms).not.toHaveBeenCalled()
  })

  it('rolls back the order and shows an error when the persist fails', async () => {
    const user = userEvent.setup()
    mockListRooms.mockResolvedValue(THREE_ROOMS)
    mockReorderRooms.mockRejectedValue(new Error('Reorder failed on the server.'))
    renderRooms()
    await screen.findByText('Alpha')

    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }))

    // Error surfaces and the order is restored to the pre-click state; the UI
    // does not stay in the optimistic order after a failed persist.
    expect(
      await screen.findByText('Reorder failed on the server.')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(renderedRoomOrder()).toEqual(['Alpha', 'Beta', 'Gamma'])
    )
  })

  it('writes the optimistic order to the shared ["rooms"] cache', async () => {
    const user = userEvent.setup()
    mockListRooms.mockResolvedValue(THREE_ROOMS)
    mockReorderRooms.mockImplementation(() => new Promise<Room[]>(() => {}))
    const { queryClient } = renderRooms()
    await screen.findByText('Alpha')

    await user.click(screen.getByRole('button', { name: 'Move Alpha down' }))

    // The /timetable and /preferences grids read this same query, so a single
    // cache write re-orders all three surfaces.
    await waitFor(() => {
      const cached = queryClient.getQueryData<Room[]>(['rooms'])
      expect(cached?.map((r) => r.id)).toEqual(['room-2', 'room-1', 'room-3'])
      expect(cached?.map((r) => r.position)).toEqual([0, 1, 2])
    })
  })
})
