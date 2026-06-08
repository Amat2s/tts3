from fastapi import APIRouter

from api.health import router as health_router
from api.lecturers import router as lecturers_router
from api.protected import router as protected_router
from api.rooms import router as rooms_router
from api.students import router as students_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(protected_router)
api_router.include_router(rooms_router)
api_router.include_router(lecturers_router)
api_router.include_router(students_router)
