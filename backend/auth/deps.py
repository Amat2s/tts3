import hmac
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel

from api.errors import AppError
from auth.jwt import decode_supabase_token
from config import settings


class CurrentAdmin(BaseModel):
    user_id: str
    email: str | None = None


_bearer = HTTPBearer(auto_error=False)


def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentAdmin:
    if credentials is None:
        raise AppError("unauthenticated", "Authentication required.", status_code=401)
    try:
        payload = decode_supabase_token(credentials.credentials)
    except InvalidTokenError:
        raise AppError("invalid_token", "Invalid or expired token.", status_code=401)
    except Exception:
        raise

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise AppError("invalid_token", "Token missing user identity.", status_code=401)

    return CurrentAdmin(user_id=user_id, email=payload.get("email"))


def require_internal_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> None:
    """Authorize a server-to-server internal call via the shared solver token.

    This is NOT the Supabase admin path: the Trigger.dev solver worker is a
    machine, not a logged-in admin, so it presents the configured
    ``SOLVER_INTERNAL_TOKEN`` as a Bearer token. Fails closed (503) when the
    token is not configured so the endpoint is never accidentally open, and
    uses a constant-time comparison to avoid leaking the token via timing.
    """
    expected = settings.solver_internal_token
    if not expected:
        raise AppError(
            "internal_token_unconfigured",
            "Internal solver execution is not enabled.",
            status_code=503,
        )
    if credentials is None or not hmac.compare_digest(
        credentials.credentials, expected
    ):
        raise AppError(
            "invalid_internal_token",
            "Invalid internal token.",
            status_code=401,
        )
