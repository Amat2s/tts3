"""Unit 90: backend student CSV import service.

Reads a single uploaded student CSV, filters current rows by census date,
creates/updates students by their canonical ``student_number`` (Unit 89), enrols
them into matching *existing* units (units are never created here), and returns
aggregate import counts.

Boundary and scope rules (see the Unit 90 spec):

- The CSV is parsed in-memory and discarded; no blob/object storage is used.
- Structural file problems (missing file, wrong extension, bad encoding, empty
  file, missing/incorrect header, extra columns) reject the whole import.
- Row-level problems never block valid rows: bad rows are skipped and counted.
- "Current" rows are those whose ``dest census date >= today`` in
  ``Australia/Sydney``.
- Existing students are matched only by ``student_number``; their names are
  updated from the CSV but their ``year_level`` is preserved. Only newly created
  students get an initially derived year level from the student number.
- Import is additive: existing enrolments are never removed.
- Hidden ``session_student_allocations`` are rebalanced for affected units in the
  same transaction, then everything is committed together (rolled back on an
  unexpected persistence failure).
"""
import csv
import io
import re
from collections import OrderedDict
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.student import Student
from models.unit import Unit
from schemas.student import StudentImportResult
from services.session_allocation import rebalance_unit_session_allocations
from services.text import to_title_case

SYDNEY_TZ = ZoneInfo("Australia/Sydney")

# The required logical columns, already in normalized comparison form (trimmed,
# lowercased, collapsed whitespace). After normalization the file must contain
# exactly these five columns and no extras.
COL_STUDENT_NUMBER = "student number"
COL_FIRST_NAME = "first name"
COL_LAST_NAME = "last name"
COL_UNIT_CODE = "scheduled unit code"
COL_CENSUS_DATE = "dest census date"
REQUIRED_COLUMNS = (
    COL_STUDENT_NUMBER,
    COL_FIRST_NAME,
    COL_LAST_NAME,
    COL_UNIT_CODE,
    COL_CENSUS_DATE,
)

_STUDENT_NUMBER_PATTERN = re.compile(r"^\d{8}$")
_HEADER_HELP = (
    "CSV header must contain exactly these columns (case- and spacing-tolerant): "
    "Student number, first name, last name, scheduled unit code, dest census date."
)


def _normalize_header(value: str) -> str:
    """Trim, lowercase, and collapse repeated whitespace in a header cell."""
    return re.sub(r"\s+", " ", value.strip().lower())


def _derive_initial_year_level(student_number: str, current_year: int) -> int | None:
    """Derive a *new* student's initial year level from their student number.

    ``year_level = current_year - first_four_digits + 1``; returns ``None`` for a
    future cohort (derived year < 1, e.g. ``20271234`` in 2026) which cannot be
    created, and caps anything above 3 to 3.
    """
    first_four = int(student_number[:4])
    derived = current_year - first_four + 1
    if derived < 1:
        return None
    return min(derived, 3)


class _CandidateRow:
    """A single valid, current, known-unit import row after classification."""

    __slots__ = ("student_number", "first_name", "last_name", "unit_id")

    def __init__(
        self, student_number: str, first_name: str, last_name: str, unit_id: str
    ) -> None:
        self.student_number = student_number
        self.first_name = first_name
        self.last_name = last_name
        self.unit_id = unit_id


def import_students_csv(
    db: DBSession,
    *,
    filename: str | None,
    content: bytes,
    today: date | None = None,
) -> StudentImportResult:
    """Import a student CSV and return aggregate counts.

    ``today`` is injectable for deterministic tests; it defaults to the current
    date in ``Australia/Sydney`` and also supplies the year used for new-student
    year derivation.
    """
    if today is None:
        today = datetime.now(SYDNEY_TZ).date()

    rows, header_index = _read_and_validate_structure(filename, content)

    # Pre-load known units by normalized code and existing students by number so
    # every row can be classified against current persistent state up front.
    units_by_code = {unit.code: unit for unit in db.query(Unit).all()}
    students_by_number = {s.student_number: s for s in db.query(Student).all()}

    counts = {
        "skipped_unknown_unit_rows": 0,
        "skipped_invalid_rows": 0,
        "skipped_past_census_rows": 0,
        "deduped_rows": 0,
    }
    candidates: list[_CandidateRow] = []
    seen_pairs: set[tuple[str, str]] = set()

    for raw in rows:
        candidate = _classify_row(
            raw,
            header_index,
            units_by_code=units_by_code,
            students_by_number=students_by_number,
            today=today,
            counts=counts,
        )
        if candidate is None:
            continue
        pair = (candidate.student_number, candidate.unit_id)
        if pair in seen_pairs:
            counts["deduped_rows"] += 1
            continue
        seen_pairs.add(pair)
        candidates.append(candidate)

    created, updated, added = _apply_candidates(
        db,
        candidates,
        units_by_id={unit.id: unit for unit in units_by_code.values()},
        students_by_number=students_by_number,
        current_year=today.year,
    )

    return StudentImportResult(
        created_students=created,
        updated_students=updated,
        added_enrolments=added,
        **counts,
    )


def _read_and_validate_structure(
    filename: str | None, content: bytes
) -> tuple[list[list[str]], dict[str, int]]:
    """Validate the file structurally and return (data_rows, header_index).

    Raises a structured 422 ``AppError`` for any structural problem so the whole
    import is rejected. ``header_index`` maps each required normalized column name
    to its position in the row.
    """
    if filename is None:
        raise AppError("import_missing_file", "No CSV file was uploaded.", status_code=422)
    if not filename.lower().endswith(".csv"):
        raise AppError(
            "import_invalid_file_type",
            "Uploaded file must be a .csv file.",
            status_code=422,
        )
    if not content.strip():
        raise AppError("import_empty_file", "The CSV file is empty.", status_code=422)

    try:
        # ``utf-8-sig`` transparently strips a leading BOM when present.
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppError(
            "import_invalid_encoding",
            "The CSV file is not valid UTF-8 text.",
            status_code=422,
        )

    reader = csv.reader(io.StringIO(text))
    all_rows = [row for row in reader]
    if not all_rows or all(not any(cell.strip() for cell in row) for row in all_rows):
        raise AppError("import_empty_file", "The CSV file is empty.", status_code=422)

    header = all_rows[0]
    normalized = [_normalize_header(cell) for cell in header]
    if len(normalized) != len(REQUIRED_COLUMNS) or set(normalized) != set(
        REQUIRED_COLUMNS
    ):
        raise AppError("import_invalid_header", _HEADER_HELP, status_code=422)

    header_index = {name: idx for idx, name in enumerate(normalized)}
    return all_rows[1:], header_index


def _classify_row(
    raw: list[str],
    header_index: dict[str, int],
    *,
    units_by_code: dict[str, Unit],
    students_by_number: dict[str, Student],
    today: date,
    counts: dict[str, int],
) -> _CandidateRow | None:
    """Classify one data row, incrementing skip counters and returning a
    candidate row only when it is valid, current, and targets a known unit.

    Wholly blank rows are ignored silently (trailing newlines etc.).
    """
    if not any(cell.strip() for cell in raw):
        return None

    def field(name: str) -> str:
        idx = header_index[name]
        return raw[idx].strip() if idx < len(raw) else ""

    student_number = field(COL_STUDENT_NUMBER)
    first_name = field(COL_FIRST_NAME)
    last_name = field(COL_LAST_NAME)
    unit_code = field(COL_UNIT_CODE).upper()
    census_raw = field(COL_CENSUS_DATE)

    census_date = _parse_census_date(census_raw)
    if (
        not _STUDENT_NUMBER_PATTERN.match(student_number)
        or not first_name
        or not last_name
        or census_date is None
    ):
        counts["skipped_invalid_rows"] += 1
        return None

    if census_date < today:
        counts["skipped_past_census_rows"] += 1
        return None

    unit = units_by_code.get(unit_code)
    if unit is None:
        counts["skipped_unknown_unit_rows"] += 1
        return None

    # A new student whose number is a future cohort (derived year < 1) cannot be
    # created; such a row is invalid. Existing students are matched by number and
    # are never re-derived, so the cohort rule does not apply to them.
    if student_number not in students_by_number and (
        _derive_initial_year_level(student_number, today.year) is None
    ):
        counts["skipped_invalid_rows"] += 1
        return None

    return _CandidateRow(
        student_number, to_title_case(first_name), to_title_case(last_name), unit.id
    )


def _parse_census_date(value: str) -> date | None:
    """Parse a ``dd/mm/yyyy`` census date, returning ``None`` when invalid."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return None


def _apply_candidates(
    db: DBSession,
    candidates: list[_CandidateRow],
    *,
    units_by_id: dict[str, Unit],
    students_by_number: dict[str, Student],
    current_year: int,
) -> tuple[int, int, int]:
    """Create/update students and add enrolments, then rebalance + commit.

    Returns ``(created_students, updated_students, added_enrolments)``. Rolls back
    and raises a structured 500 on an unexpected persistence failure.
    """
    # Group deduped candidates by student number, preserving first-seen order and
    # using the first row's name as authoritative.
    by_student: "OrderedDict[str, dict]" = OrderedDict()
    for candidate in candidates:
        entry = by_student.get(candidate.student_number)
        if entry is None:
            by_student[candidate.student_number] = {
                "first_name": candidate.first_name,
                "last_name": candidate.last_name,
                "unit_ids": [candidate.unit_id],
            }
        else:
            entry["unit_ids"].append(candidate.unit_id)

    created = 0
    updated = 0
    added = 0
    affected_unit_ids: set[str] = set()

    try:
        for number, info in by_student.items():
            student = students_by_number.get(number)
            if student is None:
                # Cohort was already validated >= 1 during classification.
                year = _derive_initial_year_level(number, current_year)
                assert year is not None  # guaranteed by classification
                student = Student(
                    student_number=number,
                    first_name=info["first_name"],
                    last_name=info["last_name"],
                    year_level=year,
                )
                db.add(student)
                db.flush()
                created += 1
                enrolled_unit_ids: set[str] = set()
            else:
                if (
                    student.first_name != info["first_name"]
                    or student.last_name != info["last_name"]
                ):
                    student.first_name = info["first_name"]
                    student.last_name = info["last_name"]
                    updated += 1
                enrolled_unit_ids = {unit.id for unit in student.units}

            for unit_id in info["unit_ids"]:
                if unit_id in enrolled_unit_ids:
                    continue
                student.units.append(units_by_id[unit_id])
                enrolled_unit_ids.add(unit_id)
                affected_unit_ids.add(unit_id)
                added += 1

        db.flush()
        # Rebalance hidden allocations for every unit that gained an enrolment so
        # new students join each lecture and one tutorial group, atomically.
        # Sorted by unit id so concurrent multi-unit transactions take the
        # per-unit advisory locks in a consistent order and cannot deadlock.
        for unit_id in sorted(affected_unit_ids):
            rebalance_unit_session_allocations(db, unit_id)
        db.commit()
    except AppError:
        raise
    except Exception:
        db.rollback()
        raise AppError(
            "import_failed",
            "The student import could not be saved.",
            status_code=500,
        )

    return created, updated, added
