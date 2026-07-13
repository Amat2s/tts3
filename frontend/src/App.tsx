import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth/context'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import TimetablePage from '@/routes/timetable'
import PreferencesPage from '@/routes/preferences'
import RoomsPage from '@/routes/rooms'
import LecturersPage from '@/routes/lecturers'
import StudentsPage from '@/routes/students'
import UnitsPage from '@/routes/units'
import LoginPage from '@/routes/login'

const queryClient = new QueryClient()

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/timetable"
            element={<ProtectedRoute><TimetablePage /></ProtectedRoute>}
          />
          <Route
            path="/preferences"
            element={<ProtectedRoute><PreferencesPage /></ProtectedRoute>}
          />
          <Route
            path="/rooms"
            element={<ProtectedRoute><RoomsPage /></ProtectedRoute>}
          />
          <Route
            path="/lecturers"
            element={<ProtectedRoute><LecturersPage /></ProtectedRoute>}
          />
          <Route
            path="/students"
            element={<ProtectedRoute><StudentsPage /></ProtectedRoute>}
          />
          <Route
            path="/units"
            element={<ProtectedRoute><UnitsPage /></ProtectedRoute>}
          />
          <Route path="/" element={<Navigate to="/timetable" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
