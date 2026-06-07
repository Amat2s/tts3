import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth/context'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import TimetablePage from '@/routes/timetable'
import RoomsPage from '@/routes/rooms'
import LecturersPage from '@/routes/lecturers'
import StudentsPage from '@/routes/students'
import UnitsPage from '@/routes/units'
import LoginPage from '@/routes/login'
import SignupPage from '@/routes/signup'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/timetable"
            element={<ProtectedRoute><TimetablePage /></ProtectedRoute>}
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
  )
}
