import { DoorOpen } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'

export default function RoomsPage() {
  return (
    <AppFrame>
      <PageHeader
        title="Rooms"
        description="Manage teaching rooms. Rooms define the timetable canvas and set capacity constraints."
      />
      <EmptyState
        icon={<DoorOpen className="h-8 w-8" />}
        title="No rooms yet"
        description="This page will list all rooms and allow you to create, edit, and delete them. At least one room is required to display the timetable grid."
      />
    </AppFrame>
  )
}
