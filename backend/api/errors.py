import structlog
from pydantic import BaseModel
from fastapi import Request
from fastapi.responses import JSONResponse

logger = structlog.get_logger(__name__)


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_response(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    # Expected product errors (validation, defensive rejections, auth) are not
    # crashes: they return a normal structured response and are logged at
    # warning level for traceability, never sent to Sentry. The message is
    # developer-authored and safe — it never contains tokens or payloads.
    logger.warning(
        "app_error",
        code=exc.code,
        status_code=exc.status_code,
        path=request.url.path,
        method=request.method,
    )
    return error_response(exc.code, exc.message, exc.status_code)
