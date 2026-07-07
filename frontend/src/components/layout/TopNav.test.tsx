import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The auth context reads from the Supabase client at import time; stub useAuth
// so the navbar renders without a real session/provider.
vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ session: null, loading: false, signOut: vi.fn() }),
}))

import { TopNav } from './TopNav'

function renderNav() {
  return render(
    <MemoryRouter>
      <TopNav />
    </MemoryRouter>
  )
}

describe('TopNav — brand and links (Unit 81)', () => {
  it('renders the brand text "Campion - Timetable" in the title/serif font, bold', () => {
    renderNav()
    const brand = screen.getByText('Campion - Timetable')
    expect(brand).toBeInTheDocument()
    expect(brand).toHaveClass('font-bold')
    expect(brand).toHaveStyle({ fontFamily: 'var(--font-serif)' })
    expect(brand).toHaveStyle({ color: 'var(--accent-primary)' })
  })

  it('keeps the centered nav links', () => {
    renderNav()
    for (const label of ['Timetable', 'Preferences', 'Units', 'Lecturers', 'Students', 'Rooms']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })
})
