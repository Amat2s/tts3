import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.errors import AppError, app_error_handler
from api.router import api_router
from config import settings
from log.setup import configure_logging
from observability import (
    RequestContextMiddleware,
    capture_unexpected_exception,
    configure_sentry,
    get_request_id,
)

configure_logging()
configure_sentry()

logger = structlog.get_logger(__name__)

app = FastAPI(title="TTS3 API")

# Correlation/request ID context for every request (Unit 49). Added last so it
# runs outermost among our middleware and binds the id before route handlers.
app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Unexpected backend exception: log with correlation context and report to
    # Sentry when configured. Never expose internals to the caller.
    request_id = get_request_id(request)
    logger.error(
        "unhandled_exception",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        error_type=type(exc).__name__,
    )
    capture_unexpected_exception(
        exc,
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "An unexpected error occurred."}},
    )

app.include_router(api_router)
