"""Tests for Unit 104: backend lecturer/unit CSV/Excel import API.

Covers the structural file contract (``.csv`` and ``.xlsx``), row parsing/
classification, lecturer match/create by normalized name, unit match/create by
code (existing name preserved), additive team-membership links, title variant
mapping + default fallback, ``AVAILABILITY`` ignored, dedupe/skip counting,
atomic rollback, aggregate-counts-only result, and route-level auth. Most
behaviour is exercised directly against the service using the in-memory SQLite
``db`` fixture; route-level tests cover the multipart upload path and auth.
"""
import asyncio
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import openpyxl
import pytest

from api.errors import AppError
from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from main import app
from models.lecturer import Lecturer, LecturerTitle
from models.session import Session, SessionType
from models.session_allocation import SessionStudentAllocation
from models.unit import Unit
from services.lecturer_import import import_lecturers_csv

DEFAULT_HEADER = [
    "TITLE",
    "LAST NAME",
    "FIRST NAME",
    "AVAILABILITY",
    "UNIT CODE",
    "UNIT NAME",
]


def make_csv(rows: list[list[str]], header: list[str] | None = None) -> bytes:
    """Build CSV bytes from a header + data rows."""
    buf = io.StringIO()
    writer = __import__("csv").writer(buf)
    writer.writerow(DEFAULT_HEADER if header is None else header)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


def make_xlsx(rows: list[list[str]], header: list[str] | None = None) -> bytes:
    """Build .xlsx bytes from a header + data rows."""
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(DEFAULT_HEADER if header is None else header)
    for row in rows:
        sheet.append(row)
    buf = io.BytesIO()
    workbook.save(buf)
    return buf.getvalue()


def make_unit(db, code="HIS101", name=None, year_level=1) -> Unit:
    unit = Unit(code=code, name=name or f"{code} Unit", year_level=year_level)
    db.add(unit)
    db.flush()
    return unit


def make_lecturer(db, first, last, title=LecturerTitle.DR) -> Lecturer:
    lecturer = Lecturer(title=title, first_name=first, last_name=last)
    db.add(lecturer)
    db.flush()
    return lecturer


def run_import(db, content: bytes, *, filename="lecturers.csv"):
    return import_lecturers_csv(db, filename=filename, content=content)


# A single well-formed data row: Dr Ada Lovelace teaching HIS101.
def row(
    title="Dr",
    last="Lovelace",
    first="Ada",
    avail="Mon AM",
    code="HIS101",
    name="History 101",
) -> list[str]:
    return [title, last, first, avail, code, name]


# ---------------------------------------------------------------------------
# Structural file contract
# ---------------------------------------------------------------------------


def test_exact_valid_header_accepted(db):
    result = run_import(db, make_csv([row()]))
    assert result.created_lecturers == 1
    assert result.created_units == 1
    assert result.added_team_memberships == 1


def test_imported_names_are_title_cased(db):
    content = make_csv(
        [row(last="LOVELACE", first="ada", name="ancient HISTORY")]
    )
    run_import(db, content)
    lecturer = db.query(Lecturer).filter(Lecturer.first_name == "Ada").one()
    assert lecturer.last_name == "Lovelace"
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert unit.name == "Ancient History"


def test_case_and_spacing_header_variants_accepted(db):
    header = [
        " Title ",
        "LAST   Name",
        "First Name",
        " AVAILABILITY ",
        "Unit   Code",
        "UNIT name",
    ]
    result = run_import(db, make_csv([row()], header=header))
    assert result.created_lecturers == 1


def test_missing_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename=None, content=b"")
    assert exc.value.code == "import_missing_file"


def test_wrong_extension_rejects(db):
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename="lecturers.txt", content=make_csv([row()]))
    assert exc.value.code == "import_invalid_file_type"


def test_invalid_encoding_rejects(db):
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename="l.csv", content=b"\xff\xfe\x00bad")
    assert exc.value.code == "import_invalid_encoding"


def test_empty_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename="l.csv", content=b"")
    assert exc.value.code == "import_empty_file"


def test_header_only_whitespace_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename="l.csv", content=b"  \n  \n")
    assert exc.value.code == "import_empty_file"


def test_missing_required_column_rejects_whole_file(db):
    header = ["TITLE", "LAST NAME", "FIRST NAME", "AVAILABILITY", "UNIT CODE"]
    content = make_csv([["Dr", "Lovelace", "Ada", "Mon", "HIS101"]], header=header)
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_invalid_header"


def test_wrong_column_name_rejects_whole_file(db):
    header = [
        "TITLE",
        "SURNAME",  # wrong
        "FIRST NAME",
        "AVAILABILITY",
        "UNIT CODE",
        "UNIT NAME",
    ]
    with pytest.raises(AppError) as exc:
        run_import(db, make_csv([row()], header=header))
    assert exc.value.code == "import_invalid_header"


def test_extra_column_rejects_whole_file(db):
    header = DEFAULT_HEADER + ["EXTRA"]
    content = make_csv([row() + ["x"]], header=header)
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_invalid_header"


def test_bom_prefixed_header_accepted(db):
    content = b"\xef\xbb\xbf" + make_csv([row()])
    result = run_import(db, content)
    assert result.created_lecturers == 1


# ---------------------------------------------------------------------------
# .xlsx parity
# ---------------------------------------------------------------------------


def test_xlsx_and_csv_produce_identical_results(db):
    rows = [
        row(),
        row(title="Prof.", last="Hopper", first="Grace", code="PHI201", name="Phi"),
    ]
    csv_result = run_import(db, make_csv(rows), filename="lecturers.csv")

    # Fresh DB state for the xlsx run.
    db.query(Session).delete()
    db.query(Unit).delete()
    db.query(Lecturer).delete()
    db.commit()

    xlsx_result = run_import(db, make_xlsx(rows), filename="lecturers.xlsx")
    assert csv_result.model_dump() == xlsx_result.model_dump()
    assert xlsx_result.created_lecturers == 2
    assert xlsx_result.created_units == 2


def test_xlsx_invalid_header_rejected(db):
    header = ["TITLE", "LAST NAME", "FIRST NAME", "AVAILABILITY", "UNIT CODE"]
    content = make_xlsx([["Dr", "Lovelace", "Ada", "Mon", "HIS101"]], header=header)
    with pytest.raises(AppError) as exc:
        import_lecturers_csv(db, filename="l.xlsx", content=content)
    assert exc.value.code == "import_invalid_header"


def test_xlsx_numeric_cell_coerced_to_string(db):
    # A unit name arriving as a number must not crash the string pipeline.
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(DEFAULT_HEADER)
    sheet.append(["Dr", "Lovelace", "Ada", "Mon", "HIS101", 2025])
    buf = io.BytesIO()
    workbook.save(buf)
    result = import_lecturers_csv(db, filename="l.xlsx", content=buf.getvalue())
    assert result.created_units == 1
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert unit.name == "2025"


# ---------------------------------------------------------------------------
# Lecturer match / create + title mapping
# ---------------------------------------------------------------------------


def test_existing_lecturer_matched_by_normalized_name(db):
    existing = make_lecturer(db, "Ada", "Lovelace", title=LecturerTitle.DR)
    db.commit()
    # Different case/spacing + a different title in the CSV; must match and NOT
    # create a new lecturer, and must NOT retitle the existing one.
    content = make_csv([row(title="Mr", last="  lovelace ", first="ADA")])
    result = run_import(db, content)
    assert result.created_lecturers == 0
    assert db.query(Lecturer).count() == 1
    db.refresh(existing)
    assert existing.title == LecturerTitle.DR


def test_new_lecturer_created_with_first_row_title(db):
    content = make_csv([row(title="Prof.")])
    run_import(db, content)
    lecturer = db.query(Lecturer).filter(Lecturer.last_name == "Lovelace").one()
    assert lecturer.title == LecturerTitle.PROF


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Mr", LecturerTitle.MR),
        ("mr.", LecturerTitle.MR),
        ("Ms", LecturerTitle.MS),
        ("Mrs", LecturerTitle.MRS),
        ("Dr", LecturerTitle.DR),
        ("doctor", LecturerTitle.DR),
        ("Fr.", LecturerTitle.FR),
        ("Prof.", LecturerTitle.PROF),
        ("professor", LecturerTitle.PROF),
        ("A/Prof.", LecturerTitle.ASSOC_PROF),
        ("associate professor", LecturerTitle.ASSOC_PROF),
    ],
)
def test_title_variants_map(db, raw, expected):
    run_import(db, make_csv([row(title=raw, last="Solo", first="Han")]))
    lecturer = db.query(Lecturer).filter(Lecturer.last_name == "Solo").one()
    assert lecturer.title == expected


@pytest.mark.parametrize("raw", ["", "   ", "Herr", "???"])
def test_unknown_or_blank_title_falls_back_to_default(db, raw):
    run_import(db, make_csv([row(title=raw, last="Solo", first="Han")]))
    lecturer = db.query(Lecturer).filter(Lecturer.last_name == "Solo").one()
    assert lecturer.title == LecturerTitle.MR


def test_title_is_never_a_reason_to_skip(db):
    # A garbage title still imports the row (falls back to default).
    result = run_import(db, make_csv([row(title="!!!nonsense!!!")]))
    assert result.skipped_invalid_rows == 0
    assert result.created_lecturers == 1


# ---------------------------------------------------------------------------
# Unit match / create
# ---------------------------------------------------------------------------


def test_existing_unit_matched_and_name_not_overwritten(db):
    make_unit(db, code="HIS101", name="Original Name")
    db.commit()
    content = make_csv([row(code="his101", name="Different Name")])
    result = run_import(db, content)
    assert result.created_units == 0
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert unit.name == "Original Name"


def test_new_unit_created_with_derived_year_and_empty_students(db):
    run_import(db, make_csv([row(code="PHI201", name="Philosophy")]))
    unit = db.query(Unit).filter(Unit.code == "PHI201").one()
    assert unit.year_level == 2
    assert unit.name == "Philosophy"
    assert unit.students == []


def test_invalid_unit_code_row_skipped(db):
    content = make_csv(
        [
            row(code="BADCODE"),  # not AAA999
            row(code="HI9101"),  # wrong letter/digit split
            row(code="HIS401", last="X", first="Y"),  # year 4 not derivable
            row(code="HIS101"),  # valid
        ]
    )
    result = run_import(db, content)
    assert result.skipped_invalid_rows == 3
    assert result.created_units == 1


# ---------------------------------------------------------------------------
# Team membership (additive)
# ---------------------------------------------------------------------------


def test_team_link_added_additively(db):
    run_import(db, make_csv([row()]))
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert [lec.last_name for lec in unit.lecturers] == ["Lovelace"]


def test_team_link_noop_when_already_present(db):
    unit = make_unit(db, code="HIS101")
    lecturer = make_lecturer(db, "Ada", "Lovelace")
    unit.lecturers.append(lecturer)
    db.commit()
    result = run_import(db, make_csv([row()]))
    assert result.created_lecturers == 0
    assert result.created_units == 0
    assert result.added_team_memberships == 0
    db.refresh(unit)
    assert len(unit.lecturers) == 1


def test_team_link_added_to_existing_unit_without_replacing_team(db):
    unit = make_unit(db, code="HIS101")
    other = make_lecturer(db, "Grace", "Hopper")
    unit.lecturers.append(other)
    db.commit()
    result = run_import(db, make_csv([row()]))
    assert result.added_team_memberships == 1
    db.refresh(unit)
    assert {lec.last_name for lec in unit.lecturers} == {"Hopper", "Lovelace"}


def test_multiple_lecturers_on_same_unit(db):
    content = make_csv(
        [
            row(last="Lovelace", first="Ada"),
            row(last="Hopper", first="Grace"),
        ]
    )
    result = run_import(db, content)
    assert result.created_lecturers == 2
    assert result.created_units == 1
    assert result.added_team_memberships == 2
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert {lec.last_name for lec in unit.lecturers} == {"Lovelace", "Hopper"}


def test_one_lecturer_on_multiple_units(db):
    content = make_csv(
        [
            row(code="HIS101", name="History"),
            row(code="PHI201", name="Philosophy"),
        ]
    )
    result = run_import(db, content)
    assert result.created_lecturers == 1
    assert result.created_units == 2
    assert result.added_team_memberships == 2
    assert db.query(Lecturer).count() == 1


# ---------------------------------------------------------------------------
# Dedupe / skip / AVAILABILITY ignored
# ---------------------------------------------------------------------------


def test_duplicate_lecturer_unit_pairs_deduped(db):
    content = make_csv(
        [
            row(),
            row(code="his101"),  # case-normalized dup pair
            row(first="ada", last="LOVELACE"),  # name-normalized dup pair
        ]
    )
    result = run_import(db, content)
    assert result.deduped_rows == 2
    assert result.created_lecturers == 1
    assert result.created_units == 1
    assert result.added_team_memberships == 1


def test_availability_column_ignored(db):
    # Different availability values on the same (lecturer, unit) pair still dedupe
    # to one — availability plays no part this unit.
    content = make_csv(
        [
            row(avail="Mon AM"),
            row(avail="Fri PM"),
        ]
    )
    result = run_import(db, content)
    assert result.deduped_rows == 1
    assert result.added_team_memberships == 1


def test_blank_names_and_unit_name_skipped(db):
    content = make_csv(
        [
            row(first=""),  # blank first
            row(last=""),  # blank last
            row(name=""),  # blank unit name
            row(),  # valid
        ]
    )
    result = run_import(db, content)
    assert result.skipped_invalid_rows == 3
    assert result.created_lecturers == 1
    assert result.added_team_memberships == 1


def test_first_row_authoritative_for_created_records(db):
    # First appearance sets lecturer title and unit name; a later differing row
    # for the same name/code never retitles or renames.
    content = make_csv(
        [
            row(title="Prof.", code="HIS101", name="First Name Wins"),
            row(title="Mr", last="Lovelace", first="Ada", code="PHI201", name="Phil"),
            # same code HIS101 with a different name, via a different lecturer
            ["Ms", "Hopper", "Grace", "Mon", "HIS101", "Second Name Ignored"],
        ]
    )
    run_import(db, content)
    lecturer = db.query(Lecturer).filter(Lecturer.last_name == "Lovelace").one()
    assert lecturer.title == LecturerTitle.PROF  # first row's title, not "Mr"
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert unit.name == "First Name Wins"


def test_response_counts_are_accurate(db):
    make_unit(db, code="THE301", name="Existing", year_level=3)
    db.commit()
    content = make_csv(
        [
            row(),  # create lecturer + unit + link
            row(),  # deduped
            row(code="BADCODE"),  # invalid unit code
            row(name=""),  # blank unit name
            row(last="Hopper", first="Grace", code="THE301", name="Ignore"),  # existing unit
        ]
    )
    result = run_import(db, content)
    assert result.created_lecturers == 2  # Lovelace + Hopper
    assert result.created_units == 1  # HIS101 (THE301 already exists)
    assert result.added_team_memberships == 2
    assert result.deduped_rows == 1
    assert result.skipped_invalid_rows == 2


# ---------------------------------------------------------------------------
# No allocations rebalanced (created units have no sessions/students)
# ---------------------------------------------------------------------------


def test_no_allocations_created_for_imported_units(db):
    run_import(db, make_csv([row()]))
    assert db.query(SessionStudentAllocation).count() == 0
    unit = db.query(Unit).filter(Unit.code == "HIS101").one()
    assert db.query(Session).filter(Session.unit_id == unit.id).count() == 0


# ---------------------------------------------------------------------------
# Atomic rollback
# ---------------------------------------------------------------------------


def test_persistence_failure_rolls_back_atomically(db, monkeypatch):
    import services.lecturer_import as svc

    original_flush = db.flush
    calls = {"n": 0}

    def failing_flush(*args, **kwargs):
        calls["n"] += 1
        # Fail on the second flush so the first creation is already staged.
        if calls["n"] >= 2:
            raise RuntimeError("boom")
        return original_flush(*args, **kwargs)

    monkeypatch.setattr(db, "flush", failing_flush)
    content = make_csv(
        [
            row(last="Lovelace", first="Ada", code="HIS101"),
            row(last="Hopper", first="Grace", code="PHI201"),
        ]
    )
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_failed"
    assert exc.value.status_code == 500
    # Rolled back: nothing persisted.
    assert db.query(Lecturer).count() == 0
    assert db.query(Unit).count() == 0


# ---------------------------------------------------------------------------
# Route-level: multipart upload + auth
# ---------------------------------------------------------------------------


class ASGIResponse:
    def __init__(self, status_code: int, body: bytes) -> None:
        self.status_code = status_code
        self.body = body

    def json(self):
        return json.loads(self.body.decode("utf-8"))


class ASGITestClient:
    def __init__(self, application) -> None:
        self.application = application

    def post_file(self, path, filename, content, content_type) -> ASGIResponse:
        return asyncio.run(self._upload(path, filename, content, content_type))

    async def _upload(self, path, filename, content, content_type) -> ASGIResponse:
        boundary = "----tts3boundary"
        body = b"\r\n".join(
            [
                f"--{boundary}".encode(),
                (
                    f'Content-Disposition: form-data; name="file"; '
                    f'filename="{filename}"'
                ).encode(),
                f"Content-Type: {content_type}".encode(),
                b"",
                content,
                f"--{boundary}--".encode(),
                b"",
            ]
        )
        headers = [
            (b"host", b"testserver"),
            (b"content-type", f"multipart/form-data; boundary={boundary}".encode()),
            (b"content-length", str(len(body)).encode()),
        ]
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("ascii"),
            "query_string": b"",
            "headers": headers,
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
        messages = []
        received = False

        async def receive():
            nonlocal received
            if not received:
                received = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            messages.append(message)

        await self.application(scope, receive, send)
        start = next(m for m in messages if m["type"] == "http.response.start")
        chunks = [
            m.get("body", b"") for m in messages if m["type"] == "http.response.body"
        ]
        return ASGIResponse(start["status"], b"".join(chunks))


@pytest.fixture
def client(db):
    def override_db():
        yield db

    def override_admin():
        return CurrentAdmin(user_id="admin-1", email="admin@example.com")

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_admin] = override_admin
    yield ASGITestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(db):
    def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db
    yield ASGITestClient(app)
    app.dependency_overrides.clear()


def test_route_imports_csv_via_multipart(client, db):
    content = make_csv([row()])
    response = client.post_file(
        "/lecturers/import-csv", "lecturers.csv", content, "text/csv"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["created_lecturers"] == 1
    assert payload["created_units"] == 1
    assert payload["added_team_memberships"] == 1


def test_route_imports_xlsx_via_multipart(client, db):
    content = make_xlsx([row()])
    response = client.post_file(
        "/lecturers/import-csv",
        "lecturers.xlsx",
        content,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    assert response.status_code == 200
    assert response.json()["created_lecturers"] == 1


def test_route_rejects_invalid_header(client, db):
    header = ["TITLE", "LAST NAME", "FIRST NAME", "AVAILABILITY", "UNIT CODE"]
    content = make_csv([["Dr", "Lovelace", "Ada", "Mon", "HIS101"]], header=header)
    response = client.post_file(
        "/lecturers/import-csv", "lecturers.csv", content, "text/csv"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "import_invalid_header"


def test_route_requires_auth(unauthenticated_client, db):
    content = make_csv([row()])
    response = unauthenticated_client.post_file(
        "/lecturers/import-csv", "lecturers.csv", content, "text/csv"
    )
    assert response.status_code == 401
