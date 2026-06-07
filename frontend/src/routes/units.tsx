import { BookOpen } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'

export default function UnitsPage() {
  return (
    <AppFrame>
      <PageHeader
        title="Units"
        description="Manage course units and their sessions. Sessions created here appear in the timetable scheduling pool."
      />
      <EmptyState
        icon={<BookOpen className="h-8 w-8" />}
        title="No units yet"
        description="This page will list all units. Each unit contains sessions that can be scheduled onto the timetable."
      />
    </AppFrame>
  )
}
