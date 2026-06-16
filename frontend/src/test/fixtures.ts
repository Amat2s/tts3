/**
 * Test fixtures for the timetable validation and interaction suite (Unit 52).
 *
 * These factories produce objects shaped exactly like the real API DTOs the
 * production code consumes (`Room`, `SchedulableSession`, `AssignmentResponse`,
 * `Lecturer`, `SolverRunStatusResponse`) and the frontend `TimetableAssignment`
 * rendering model. They live in `src/test/` — outside production feature state —
 * so no test data can leak into the running app.
 */
import type { Room } from '@/lib/api/rooms'
import type { SchedulableSession } from '@/lib/api/sessions'
import type { AssignmentResponse } from '@/lib/api/assignments'
import type { Lecturer } from '@/lib/api/lecturers'
import type { SolverRunStatusResponse } from '@/lib/api/solver'
import type { Student } from '@/lib/api/students'
import type { Unit } from '@/lib/api/units'
import type { TimetableAssignment } from '@/features/timetable/assignment'

const ISO = '2026-06-13T00:00:00.000Z'

export function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'Room A',
    capacity: 30,
    room_type: 'lecture',
    created_at: ISO,
    updated_at: ISO,
    ...overrides,
  }
}

export function makeSchedulableSession(
  overrides: Partial<SchedulableSession> = {}
): SchedulableSession {
  return {
    session_id: 'sess-1',
    unit_id: 'unit-1',
    unit_code: 'HIS101',
    unit_name: 'Ancient History',
    session_type: 'lecture',
    duration: 1,
    lecturer_id: 'lec-1',
    lecturer_display_name: 'Dr. Ada Lovelace',
    student_count: 10,
    allocated_student_ids: [],
    ...overrides,
  }
}

export function makeAssignmentResponse(
  overrides: Partial<AssignmentResponse> = {}
): AssignmentResponse {
  return {
    assignment_id: 'asg-1',
    session_id: 'sess-1',
    unit_id: 'unit-1',
    unit_code: 'HIS101',
    unit_name: 'Ancient History',
    session_type: 'lecture',
    duration: 1,
    lecturer_id: 'lec-1',
    lecturer_display_name: 'Dr. Ada Lovelace',
    student_count: 10,
    allocated_student_ids: [],
    day: 'Monday',
    start_slot: 's1',
    room_id: 'room-1',
    created_at: ISO,
    updated_at: ISO,
    ...overrides,
  }
}

export function makeLecturer(overrides: Partial<Lecturer> = {}): Lecturer {
  return {
    id: 'lec-1',
    title: 'Dr.',
    first_name: 'Ada',
    last_name: 'Lovelace',
    unavailable_slots: [],
    created_at: ISO,
    updated_at: ISO,
    ...overrides,
  }
}

export function makeAssignment(
  overrides: Partial<TimetableAssignment> = {}
): TimetableAssignment {
  return {
    session_id: 'sess-1',
    unit_id: 'unit-1',
    unit_code: 'HIS101',
    unit_name: 'Ancient History',
    session_type: 'lecture',
    duration: 1,
    lecturer_id: 'lec-1',
    lecturer_display_name: 'Dr. Ada Lovelace',
    student_count: 10,
    allocated_student_ids: [],
    day: 'Monday',
    start_slot: 's1',
    room_id: 'room-1',
    ...overrides,
  }
}

export function makeSolverStatus(
  overrides: Partial<SolverRunStatusResponse> = {}
): SolverRunStatusResponse {
  return {
    solver_run_id: 'run-1',
    status: 'running',
    job_id: 'job-1',
    created_at: ISO,
    updated_at: ISO,
    scheduled_count: null,
    unscheduled_count: null,
    partial_success: false,
    failure_message: null,
    ...overrides,
  }
}

export function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    title: 'Mx.',
    first_name: 'Sam',
    last_name: 'Carter',
    year_level: 1,
    units: [],
    unit_count: 0,
    created_at: ISO,
    updated_at: ISO,
    ...overrides,
  }
}

export function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    code: 'HIS101',
    name: 'Ancient History',
    year_level: 1,
    lecturers: [],
    students: [],
    created_at: ISO,
    updated_at: ISO,
    ...overrides,
  }
}
