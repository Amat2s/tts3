"""Tests for Unit 90: backend student CSV import API.

Covers the structural file contract, row parsing/classification rules, the
student create/update + additive enrolment behaviour, hidden allocation
rebalancing, accurate aggregate counts, and route-level auth. Most behaviour is
exercised directly against the pure-ish service (``import_students_csv``) using
the in-memory SQLite ``db`` fixture; route-level tests cover the multipart upload
path and the auth requirement.
"""
import asyncio
import io
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from main import app
from models.session import Session, SessionType
from models.session_allocation import SessionStudentAllocation
from models.student import Student
from models.unit import Unit
from services.student_import import import_students_csv

# Fixed "today" so census filtering and year derivation are deterministic.
TODAY = date(2026, 6, 20)

DEFAULT_HEADER = [
    "Student number",
    "first name",
    "last name",
    "scheduled unit code",
    "dest census date",
]

FUTURE = "31/12/2026"  # after TODAY -> current
ON_TODAY = "20/06/2026"  # equals TODAY -> current
PAST = "19/06/2026"  # before TODAY -> non-current


def make_csv(rows: list[list[str]], header: list[str] | None = None) -> bytes:
    """Build CSV bytes from a header + data rows."""
    buf = io.StringIO()
    writer = __import__("csv").writer(buf)
    writer.writerow(DEFAULT_HEADER if header is None else header)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode("utf-8")


def make_unit(db, code="HIS101", year_level=1) -> Unit:
    unit = Unit(code=code, name=f"{code} Unit", year_level=year_level)
    db.add(unit)
    db.flush()
    return unit


def make_lecture(db, unit: Unit) -> Session:
    session = Session(unit_id=unit.id, session_type=SessionType.LECTURE, duration=1)
    db.add(session)
    db.flush()
    return session


def make_student(db, number, first="Old", last="Name", year_level=1) -> Student:
    student = Student(
        student_number=number,
        first_name=first,
        last_name=last,
        year_level=year_level,
    )
    db.add(student)
    db.flush()
    return student


def run_import(db, content: bytes, *, filename="students.csv"):
    return import_students_csv(db, filename=filename, content=content, today=TODAY)


# ---------------------------------------------------------------------------
# Structural file contract
# ---------------------------------------------------------------------------


def test_exact_valid_header_accepted(db):
    make_unit(db)
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.created_students == 1


def test_imported_names_are_title_cased(db):
    make_unit(db)
    content = make_csv([["20261234", "ADA", "lovelace", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.created_students == 1
    student = db.query(Student).filter(Student.student_number == "20261234").one()
    assert (student.first_name, student.last_name) == ("Ada", "Lovelace")


def test_case_and_spacing_header_variants_accepted(db):
    make_unit(db)
    header = [
        "  STUDENT   Number ",
        "First Name",
        "LAST name",
        "Scheduled   Unit Code",
        " Dest Census Date ",
    ]
    content = make_csv(
        [["20261234", "Ada", "Lovelace", "HIS101", FUTURE]], header=header
    )
    result = run_import(db, content)
    assert result.created_students == 1


def test_missing_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_students_csv(db, filename=None, content=b"", today=TODAY)
    assert exc.value.code == "import_missing_file"


def test_wrong_extension_rejects(db):
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101", FUTURE]])
    with pytest.raises(AppError) as exc:
        import_students_csv(db, filename="students.txt", content=content, today=TODAY)
    assert exc.value.code == "import_invalid_file_type"


def test_invalid_encoding_rejects(db):
    # 0xFF is not valid UTF-8.
    with pytest.raises(AppError) as exc:
        import_students_csv(
            db, filename="s.csv", content=b"\xff\xfe\x00bad", today=TODAY
        )
    assert exc.value.code == "import_invalid_encoding"


def test_empty_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_students_csv(db, filename="s.csv", content=b"", today=TODAY)
    assert exc.value.code == "import_empty_file"


def test_header_only_whitespace_file_rejects(db):
    with pytest.raises(AppError) as exc:
        import_students_csv(db, filename="s.csv", content=b"   \n  \n", today=TODAY)
    assert exc.value.code == "import_empty_file"


def test_missing_required_column_rejects_whole_file(db):
    header = ["Student number", "first name", "last name", "scheduled unit code"]
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101"]], header=header)
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_invalid_header"


def test_wrong_column_name_rejects_whole_file(db):
    header = [
        "Student number",
        "given name",  # wrong
        "last name",
        "scheduled unit code",
        "dest census date",
    ]
    content = make_csv(
        [["20261234", "Ada", "Lovelace", "HIS101", FUTURE]], header=header
    )
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_invalid_header"


def test_extra_column_rejects_whole_file(db):
    header = DEFAULT_HEADER + ["extra column"]
    content = make_csv(
        [["20261234", "Ada", "Lovelace", "HIS101", FUTURE, "x"]], header=header
    )
    with pytest.raises(AppError) as exc:
        run_import(db, content)
    assert exc.value.code == "import_invalid_header"


def test_bom_prefixed_header_accepted(db):
    make_unit(db)
    content = b"\xef\xbb\xbf" + make_csv(
        [["20261234", "Ada", "Lovelace", "HIS101", FUTURE]]
    )
    result = run_import(db, content)
    assert result.created_students == 1


# ---------------------------------------------------------------------------
# Row parsing / classification
# ---------------------------------------------------------------------------


def test_ddmmyyyy_parsing_and_current_inclusion(db):
    make_unit(db)
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "HIS101", ON_TODAY],  # equals today
            ["20251234", "Grace", "Hopper", "HIS101", FUTURE],
        ]
    )
    result = run_import(db, content)
    assert result.created_students == 2
    assert result.skipped_past_census_rows == 0


def test_past_census_rows_ignored(db):
    make_unit(db)
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "HIS101", PAST],
            ["20261234", "Ada", "Lovelace", "HIS101", "01/01/2020"],
        ]
    )
    result = run_import(db, content)
    assert result.skipped_past_census_rows == 2
    assert result.created_students == 0
    assert db.query(Student).count() == 0


def test_invalid_dates_and_values_skipped(db):
    make_unit(db)
    content = make_csv(
        [
            ["1234567", "Ada", "Lovelace", "HIS101", FUTURE],  # 7-digit number
            ["2026123X", "Ada", "Lovelace", "HIS101", FUTURE],  # non-digit
            ["20261234", "", "Lovelace", "HIS101", FUTURE],  # blank first
            ["20261234", "Ada", "", "HIS101", FUTURE],  # blank last
            ["20261234", "Ada", "Lovelace", "HIS101", "2026-12-31"],  # bad date
            ["20261234", "Ada", "Lovelace", "HIS101", "31/13/2026"],  # impossible
        ]
    )
    result = run_import(db, content)
    assert result.skipped_invalid_rows == 6
    assert result.created_students == 0


def test_future_cohort_student_number_rejected(db):
    make_unit(db)
    content = make_csv([["20271234", "Future", "Student", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.skipped_invalid_rows == 1
    assert result.created_students == 0
    assert db.query(Student).count() == 0


def test_unknown_unit_rows_skipped_and_counted(db):
    make_unit(db, code="HIS101")
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "ZZZ999", FUTURE],
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],
        ]
    )
    result = run_import(db, content)
    assert result.skipped_unknown_unit_rows == 1
    assert result.created_students == 1
    assert db.query(Unit).count() == 1  # no unit created from CSV


def test_duplicate_student_unit_pairs_deduped(db):
    make_unit(db)
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],
            ["20261234", "Ada", "Lovelace", "his101", FUTURE],  # case-normalized dup
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],
        ]
    )
    result = run_import(db, content)
    assert result.deduped_rows == 2
    assert result.created_students == 1
    assert result.added_enrolments == 1


# ---------------------------------------------------------------------------
# Student create / update + enrolment behaviour
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "number,expected_year",
    [
        ("20261234", 1),
        ("20251234", 2),
        ("20241234", 3),
        ("20231234", 3),  # would be 4, capped to 3
    ],
)
def test_new_students_created_with_derived_initial_year(db, number, expected_year):
    make_unit(db)
    content = make_csv([[number, "New", "Student", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.created_students == 1
    student = db.query(Student).filter(Student.student_number == number).one()
    assert student.year_level == expected_year


def test_existing_student_matched_by_number_and_name_updated(db):
    unit = make_unit(db)
    student = make_student(db, "20251234", first="Old", last="Name", year_level=2)
    db.commit()
    content = make_csv([["20251234", "New", "Surname", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.created_students == 0
    assert result.updated_students == 1
    db.refresh(student)
    assert (student.first_name, student.last_name) == ("New", "Surname")


def test_existing_student_keeps_manually_edited_year_level(db):
    make_unit(db)
    # Number would derive to year 3 for a new student, but this student already
    # exists with a manually edited year of 1 — it must be preserved.
    student = make_student(db, "20241234", first="Ada", last="L", year_level=1)
    db.commit()
    content = make_csv([["20241234", "Ada", "L", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.created_students == 0
    db.refresh(student)
    assert student.year_level == 1


def test_no_name_change_does_not_count_as_update(db):
    make_unit(db)
    make_student(db, "20251234", first="Same", last="Name", year_level=2)
    db.commit()
    content = make_csv([["20251234", "Same", "Name", "HIS101", FUTURE]])
    result = run_import(db, content)
    assert result.updated_students == 0
    assert result.added_enrolments == 1


def test_one_student_enrols_into_multiple_units(db):
    make_unit(db, code="HIS101")
    make_unit(db, code="PHI201", year_level=2)
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],
            ["20261234", "Ada", "Lovelace", "PHI201", FUTURE],
        ]
    )
    result = run_import(db, content)
    assert result.created_students == 1
    assert result.added_enrolments == 2
    student = db.query(Student).filter(Student.student_number == "20261234").one()
    assert {u.code for u in student.units} == {"HIS101", "PHI201"}


def test_import_is_additive_and_never_removes_enrolments(db):
    his = make_unit(db, code="HIS101")
    the = make_unit(db, code="THE301", year_level=3)
    phi = make_unit(db, code="PHI201", year_level=2)
    student = make_student(db, "20261234", first="Ada", last="Lovelace")
    student.units.append(his)
    student.units.append(the)
    db.commit()
    # Import enrols them into PHI201 and re-asserts HIS101 (already enrolled).
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "PHI201", FUTURE],
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],
        ]
    )
    result = run_import(db, content)
    assert result.added_enrolments == 1  # only PHI201 is new
    db.refresh(student)
    assert {u.code for u in student.units} == {"HIS101", "THE301", "PHI201"}


def test_affected_session_allocations_rebalanced(db):
    unit = make_unit(db)
    lecture = make_lecture(db, unit)
    db.commit()
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101", FUTURE]])
    run_import(db, content)
    student = db.query(Student).filter(Student.student_number == "20261234").one()
    allocations = (
        db.query(SessionStudentAllocation)
        .filter(SessionStudentAllocation.session_id == lecture.id)
        .all()
    )
    assert [a.student_id for a in allocations] == [student.id]


def test_response_counts_are_accurate(db):
    make_unit(db, code="HIS101")
    content = make_csv(
        [
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],  # created + enrol
            ["20261234", "Ada", "Lovelace", "HIS101", FUTURE],  # deduped
            ["20251234", "Grace", "Hopper", "HIS101", PAST],  # past census
            ["1234567", "Bad", "Number", "HIS101", FUTURE],  # invalid
            ["20269999", "Una", "Known", "ZZZ999", FUTURE],  # unknown unit
            ["20271234", "Future", "Cohort", "HIS101", FUTURE],  # future cohort
        ]
    )
    result = run_import(db, content)
    assert result.created_students == 1
    assert result.updated_students == 0
    assert result.added_enrolments == 1
    assert result.deduped_rows == 1
    assert result.skipped_past_census_rows == 1
    assert result.skipped_invalid_rows == 2  # bad number + future cohort
    assert result.skipped_unknown_unit_rows == 1


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

    def post_csv(self, path: str, filename: str, content: bytes) -> ASGIResponse:
        return asyncio.run(self._upload(path, filename, content))

    async def _upload(self, path, filename, content) -> ASGIResponse:
        boundary = "----tts3boundary"
        body = b"\r\n".join(
            [
                f"--{boundary}".encode(),
                (
                    f'Content-Disposition: form-data; name="file"; '
                    f'filename="{filename}"'
                ).encode(),
                b"Content-Type: text/csv",
                b"",
                content,
                f"--{boundary}--".encode(),
                b"",
            ]
        )
        headers = [
            (b"host", b"testserver"),
            (
                b"content-type",
                f"multipart/form-data; boundary={boundary}".encode(),
            ),
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
            m.get("body", b"")
            for m in messages
            if m["type"] == "http.response.body"
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
    make_unit(db)
    db.commit()
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101", FUTURE]])
    response = client.post_csv("/students/import-csv", "students.csv", content)
    assert response.status_code == 200
    payload = response.json()
    assert payload["created_students"] == 1
    assert payload["added_enrolments"] == 1
    assert "skipped_past_census_rows" in payload


def test_route_rejects_invalid_header(client, db):
    content = make_csv(
        [["20261234", "Ada", "Lovelace", "HIS101"]],
        header=["Student number", "first name", "last name", "scheduled unit code"],
    )
    response = client.post_csv("/students/import-csv", "students.csv", content)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "import_invalid_header"


def test_route_requires_auth(unauthenticated_client, db):
    content = make_csv([["20261234", "Ada", "Lovelace", "HIS101", FUTURE]])
    response = unauthenticated_client.post_csv(
        "/students/import-csv", "students.csv", content
    )
    assert response.status_code == 401
