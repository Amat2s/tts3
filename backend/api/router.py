from fastapi import APIRouter

from api.health import router as health_router
from api.protected import router as protected_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(protected_router)
