import { CalendarDays } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'

export default function TimetablePage() {
  return (
    <AppFrame>
      <PageHeader
        title="Timetable"
        description="Weekly scheduling workspace. Drag sessions onto the grid or run the constraint solver."
      />
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        title="Timetable workspace not connected"
        description="This page will show the weekly timetable grid and unscheduled session pool once rooms and sessions are available."
      />
    </AppFrame>
  )
}
