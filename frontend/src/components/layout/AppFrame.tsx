import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

interface AppFrameProps {
  children: ReactNode
}

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopNav />
      <main className="px-6 py-8">{children}</main>
    </div>
  )
}
