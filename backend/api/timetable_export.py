"""Protected timetable Excel export route (Unit 93).

``GET /timetable/export.xlsx?title=...`` streams the current saved timetable as
an ``.xlsx`` workbook built from the fixed Campion template. The handler stays
thin: it authorizes the admin, validates the title, delegates rendering to the
export service, and shapes the streaming response. No generated file is stored.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.errors import AppError
from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from services import timetable_excel_export as export_service

router = APIRouter(prefix="/timetable", tags=["timetable-export"])


@router.get("/export.xlsx")
def export_timetable_xlsx(
    _: Annotated[CurrentAdmin, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    title: Annotated[str, Query()] = "",
) -> StreamingResponse:
    cleaned = title.strip()
    if not cleaned:
        # Structured 422 rather than FastAPI's default required-param error.
        raise AppError(
            "invalid_export_title",
            "A non-empty timetable title is required.",
            status_code=422,
        )

    stream = export_service.generate_timetable_export(db, cleaned)
    filename = export_service.export_filename(cleaned, date.today())
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        stream,
        media_type=export_service.XLSX_MEDIA_TYPE,
        headers=headers,
    )
