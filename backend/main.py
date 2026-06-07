from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.errors import AppError, app_error_handler
from api.router import api_router
from config import settings
from log.setup import configure_logging

configure_logging()

app = FastAPI(title="TTS3 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(api_router)
