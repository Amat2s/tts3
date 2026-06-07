import { UserCheck } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'

export default function LecturersPage() {
  return (
    <AppFrame>
      <PageHeader
        title="Lecturers"
        description="Manage lecturers and their weekly availability. Availability is used as a hard scheduling constraint."
      />
      <EmptyState
        icon={<UserCheck className="h-8 w-8" />}
        title="No lecturers yet"
        description="This page will list all lecturers and allow you to create, edit, and set their availability."
      />
    </AppFrame>
  )
}
