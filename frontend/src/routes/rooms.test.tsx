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
}))

import RoomsPage from './rooms'
import { listRooms, deleteRoom } from '@/lib/api/rooms'
import { ApiRequestError } from '@/lib/api/client'
import { makeRoom } from '@/test/fixtures'

const mockListRooms = vi.mocked(listRooms)
const mockDeleteRoom = vi.mocked(deleteRoom)

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
