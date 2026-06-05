import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <header
        className="border-b px-6 py-3 flex items-center gap-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-default)',
        }}
      >
        <span
          className="text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          University Timetable Scheduler
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1
            className="text-3xl mb-3"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
          >
            Timetable Scheduler
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Single-admin university timetable scheduling system. Create rooms,
            lecturers, students, and units — then manually schedule or run the
            constraint solver to generate a conflict-free weekly timetable.
          </p>
        </div>

        <div className="flex items-center gap-2 mb-10">
          <Badge
            className="rounded-full text-xs font-medium px-3 py-1"
            style={{
              backgroundColor: 'var(--state-info-bg)',
              color: 'var(--state-info)',
              border: '1px solid var(--state-info)',
            }}
          >
            v1 — Foundation
          </Badge>
          <Badge
            className="rounded-full text-xs font-medium px-3 py-1"
            style={{
              backgroundColor: 'var(--accent-primary-soft)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
            }}
          >
            In Development
          </Badge>
        </div>

        <Card
          className="rounded-lg"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-base font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              Frontend Foundation
            </CardTitle>
            <CardDescription
              className="text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Core tooling and design system confirmed ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                'Vite + React + TypeScript',
                'TailwindCSS v4 with Vite plugin',
                'Project design tokens configured',
                'shadcn/ui initialized',
                'Inter, Cormorant Garamond, JetBrains Mono fonts',
                'Lucide React icons',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <CheckCircle
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--state-success)' }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
