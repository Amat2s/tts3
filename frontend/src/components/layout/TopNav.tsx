import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

const NAV_LINKS = [
  { to: '/timetable', label: 'Timetable' },
  { to: '/preferences', label: 'Preferences' },
  { to: '/units', label: 'Units' },
  { to: '/lecturers', label: 'Lecturers' },
  { to: '/students', label: 'Students' },
  { to: '/rooms', label: 'Rooms' },
] as const

export function TopNav() {
  const { signOut } = useAuth()

  return (
    <header
      className="border-b relative"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div className="px-6 h-14 flex items-center justify-between">
        <span
          className="text-xl font-bold shrink-0"
          style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-serif)' }}
        >
          Campion - Timetable
        </span>

        <nav
          className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
        >
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                ].join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 text-sm shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
