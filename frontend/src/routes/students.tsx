import { Users } from 'lucide-react'
import { AppFrame } from '@/components/layout/AppFrame'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'

export default function StudentsPage() {
  return (
    <AppFrame>
      <PageHeader
        title="Students"
        description="Manage students. Students assigned to sessions are used to derive scheduling conflict constraints."
      />
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No students yet"
        description="This page will list all students and allow you to create and edit student records. Students are optional for sessions in v1."
      />
    </AppFrame>
  )
}
