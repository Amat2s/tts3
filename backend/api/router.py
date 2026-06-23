from fastapi import APIRouter

from api.assignments import router as assignments_router
from api.health import router as health_router
from api.lecturers import router as lecturers_router
from api.protected import router as protected_router
from api.rooms import router as rooms_router
from api.sessions import sessions_router, unit_sessions_router
from api.solver import router as solver_router
from api.students import router as students_router
from api.timetable_blocks import router as timetable_blocks_router
from api.timetable_export import router as timetable_export_router
from api.units import router as units_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(protected_router)
api_router.include_router(rooms_router)
api_router.include_router(lecturers_router)
api_router.include_router(students_router)
api_router.include_router(units_router)
api_router.include_router(unit_sessions_router)
api_router.include_router(sessions_router)
api_router.include_router(assignments_router)
api_router.include_router(timetable_blocks_router)
api_router.include_router(timetable_export_router)
api_router.include_router(solver_router)
