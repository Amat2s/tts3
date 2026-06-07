from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth.deps import CurrentAdmin, get_current_admin

router = APIRouter(prefix="/auth", tags=["auth"])


class VerifyResponse(BaseModel):
    authenticated: bool
    user_id: str


@router.get("/verify", response_model=VerifyResponse)
def verify_auth(
    admin: Annotated[CurrentAdmin, Depends(get_current_admin)],
) -> VerifyResponse:
    return VerifyResponse(authenticated=True, user_id=admin.user_id)
