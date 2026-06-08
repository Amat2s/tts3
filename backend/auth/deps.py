from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel

from api.errors import AppError
from auth.jwt import decode_supabase_token


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
