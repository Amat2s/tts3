"""Unit 104: backend lecturer/unit spreadsheet import service.

Reads a single uploaded lecturer/unit spreadsheet (``.csv`` or ``.xlsx``) and,
for each row, ensures the named lecturer exists, ensures the named unit exists,
and adds that lecturer to the unit's ``unit_lecturers`` teaching team. Returns
aggregate import counts only.

This is a sibling of the Unit 90 student CSV import and follows the same
boundary rules (see the Unit 104 spec and invariant 31 parity):

- The file is parsed in-memory and discarded; no blob/object storage is used.
- Structural file problems (missing file, wrong extension, empty file, bad CSV
  encoding, header not exactly the six columns) reject the whole import with a
  structured ``422`` (reusing the Unit 90 error codes/messages).
- Row-level problems never block valid rows: bad rows are skipped and counted.
- The import is additive and non-destructive: it never deletes lecturers, units,
  or team links, and never renames an existing unit or retitles/renames an
  existing lecturer.
- New lecturers are matched/created by a normalized ``(first_name, last_name)``
  key; new units are matched/created by normalized ``code`` (invariant 24).
- Created units get an empty student list (no auto-enrolment, no sessions, so no
  ``session_student_allocations`` rebalance).
- All creations and team additions are applied in one transaction and committed
  atomically (rolled back on an unexpected persistence failure).

``AVAILABILITY`` must be present in the header but its value is ignored in this
unit (availability import is deferred).
"""
import csv
import io
import re

from sqlalchemy.orm import Session as DBSession

from api.errors import AppError
from models.lecturer import Lecturer, LecturerTitle
from models.unit import Unit
from schemas.lecturer import LecturerImportResult
from schemas.unit import UNIT_CODE_PATTERN
from services.text import to_title_case
from services.year_level import InvalidUnitCodeError, parse_unit_year_level

# The required logical columns, already in normalized comparison form (trimmed,
# lowercased, collapsed whitespace). After normalization the file must contain
# exactly these six columns and no extras. ``availability`` is required in the
# header but its value is ignored this unit.
COL_TITLE = "title"
COL_LAST_NAME = "last name"
COL_FIRST_NAME = "first name"
COL_AVAILABILITY = "availability"
COL_UNIT_CODE = "unit code"
COL_UNIT_NAME = "unit name"
REQUIRED_COLUMNS = (
    COL_TITLE,
    COL_LAST_NAME,
    COL_FIRST_NAME,
    COL_AVAILABILITY,
    COL_UNIT_CODE,
    COL_UNIT_NAME,
)

_HEADER_HELP = (
    "Spreadsheet header must contain exactly these columns (case- and "
    "spacing-tolerant): title, last name, first name, availability, unit code, "
    "unit name."
)

# Unrecognized or blank titles fall back to this single documented default.
DEFAULT_LECTURER_TITLE = LecturerTitle.MR

# Tolerant title-variant matching. Keys are normalized forms (lowercased,
# whitespace-collapsed, periods removed); values are the canonical enum member.
_TITLE_VARIANTS: dict[str, LecturerTitle] = {
    "mr": LecturerTitle.MR,
    "mister": LecturerTitle.MR,
    "ms": LecturerTitle.MS,
    "miss": LecturerTitle.MS,
    "mrs": LecturerTitle.MRS,
    "dr": LecturerTitle.DR,
    "doctor": LecturerTitle.DR,
    "fr": LecturerTitle.FR,
    "father": LecturerTitle.FR,
    "prof": LecturerTitle.PROF,
    "professor": LecturerTitle.PROF,
    "a/prof": LecturerTitle.ASSOC_PROF,
    "aprof": LecturerTitle.ASSOC_PROF,
    "assoc prof": LecturerTitle.ASSOC_PROF,
    "assoc professor": LecturerTitle.ASSOC_PROF,
    "associate prof": LecturerTitle.ASSOC_PROF,
    "associate professor": LecturerTitle.ASSOC_PROF,
}


def _normalize_header(value: str) -> str:
    """Trim, lowercase, and collapse repeated whitespace in a header cell."""
    return re.sub(r"\s+", " ", value.strip().lower())


def _normalize_name_key(first_name: str, last_name: str) -> tuple[str, str]:
    """Build a case-insensitive, whitespace-collapsed lecturer name key."""
    return (
        re.sub(r"\s+", " ", first_name.strip().lower()),
        re.sub(r"\s+", " ", last_name.strip().lower()),
    )


def _map_title(raw: str) -> LecturerTitle:
    """Map a raw CSV title to the ``LecturerTitle`` enum with tolerant matching.

    Unrecognized or blank titles fall back to ``DEFAULT_LECTURER_TITLE``.
    """
    normalized = re.sub(r"\s+", " ", raw.strip().lower()).replace(".", "")
    return _TITLE_VARIANTS.get(normalized, DEFAULT_LECTURER_TITLE)


def _normalize_unit_code(raw: str) -> str | None:
    """Return the trimmed/uppercased ``AAA999`` code, or ``None`` if invalid.

    A code is valid only when it matches the structural ``AAA999`` pattern and a
    year level (first digit 1/2/3) is derivable from it (invariant 24).
    """
    code = raw.strip().upper()
    if not UNIT_CODE_PATTERN.match(code):
        return None
    try:
        parse_unit_year_level(code)
    except InvalidUnitCodeError:
        return None
    return code


class _CandidateRow:
    """A single valid import row after classification."""

    __slots__ = (
        "name_key",
        "first_name",
        "last_name",
        "title_raw",
        "unit_code",
        "unit_name",
    )

    def __init__(
        self,
        name_key: tuple[str, str],
        first_name: str,
        last_name: str,
        title_raw: str,
        unit_code: str,
        unit_name: str,
    ) -> None:
        self.name_key = name_key
        self.first_name = first_name
        self.last_name = last_name
        self.title_raw = title_raw
        self.unit_code = unit_code
        self.unit_name = unit_name


def import_lecturers_csv(
    db: DBSession,
    *,
    filename: str | None,
    content: bytes,
) -> LecturerImportResult:
    """Import a lecturer/unit spreadsheet and return aggregate counts."""
    rows, header_index = _read_and_validate_structure(filename, content)

    counts = {
        "skipped_invalid_rows": 0,
        "deduped_rows": 0,
    }
    candidates: list[_CandidateRow] = []
    # Dedupe (lecturer, unit) pairs within the file; the first appearance is
    # authoritative for the created record (title/name), later rows never
    # retitle or rename.
    seen_pairs: set[tuple[tuple[str, str], str]] = set()

    for raw in rows:
        candidate = _classify_row(raw, header_index, counts=counts)
        if candidate is None:
            continue
        pair = (candidate.name_key, candidate.unit_code)
        if pair in seen_pairs:
            counts["deduped_rows"] += 1
            continue
        seen_pairs.add(pair)
        candidates.append(candidate)

    created_lecturers, created_units, added = _apply_candidates(db, candidates)

    return LecturerImportResult(
        created_lecturers=created_lecturers,
        created_units=created_units,
        added_team_memberships=added,
        **counts,
    )


def _read_and_validate_structure(
    filename: str | None, content: bytes
) -> tuple[list[list[str]], dict[str, int]]:
    """Validate the file structurally and return (data_rows, header_index).

    Raises a structured 422 ``AppError`` for any structural problem so the whole
    import is rejected. ``header_index`` maps each required normalized column
    name to its position in the row.
    """
    if filename is None:
        raise AppError(
            "import_missing_file", "No file was uploaded.", status_code=422
        )

    lower = filename.lower()
    if lower.endswith(".csv"):
        all_rows = _read_csv_rows(content)
    elif lower.endswith(".xlsx"):
        all_rows = _read_xlsx_rows(content)
    else:
        raise AppError(
            "import_invalid_file_type",
            "Uploaded file must be a .csv or .xlsx file.",
            status_code=422,
        )

    if not all_rows or all(
        not any(cell.strip() for cell in row) for row in all_rows
    ):
        raise AppError("import_empty_file", "The file is empty.", status_code=422)

    header = all_rows[0]
    normalized = [_normalize_header(cell) for cell in header]
    if len(normalized) != len(REQUIRED_COLUMNS) or set(normalized) != set(
        REQUIRED_COLUMNS
    ):
        raise AppError("import_invalid_header", _HEADER_HELP, status_code=422)

    header_index = {name: idx for idx, name in enumerate(normalized)}
    return all_rows[1:], header_index


def _read_csv_rows(content: bytes) -> list[list[str]]:
    """Decode and parse CSV bytes into rows of string cells."""
    if not content.strip():
        raise AppError("import_empty_file", "The file is empty.", status_code=422)
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
    return [row for row in reader]


def _read_xlsx_rows(content: bytes) -> list[list[str]]:
    """Parse ``.xlsx`` bytes into rows of string cells using ``openpyxl``.

    Read-only + values-only; the workbook is parsed in-memory and discarded.
    """
    if not content:
        raise AppError("import_empty_file", "The file is empty.", status_code=422)
    # Imported lazily so the CSV path never pays the openpyxl import cost.
    import openpyxl

    try:
        workbook = openpyxl.load_workbook(
            io.BytesIO(content), read_only=True, data_only=True
        )
    except Exception:
        raise AppError(
            "import_invalid_encoding",
            "The .xlsx file could not be read.",
            status_code=422,
        )
    try:
        sheet = workbook.active
        rows: list[list[str]] = []
        for raw in sheet.iter_rows(values_only=True):
            rows.append([_cell_to_str(cell) for cell in raw])
        return rows
    finally:
        workbook.close()


def _cell_to_str(value: object) -> str:
    """Coerce an openpyxl cell value to a trimmed-safe string."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _classify_row(
    raw: list[str],
    header_index: dict[str, int],
    *,
    counts: dict[str, int],
) -> _CandidateRow | None:
    """Classify one data row, incrementing skip counters and returning a
    candidate only when it is valid. ``TITLE`` is never a reason to skip.

    Wholly blank rows are ignored silently (trailing newlines etc.).
    """
    if not any(cell.strip() for cell in raw):
        return None

    def field(name: str) -> str:
        idx = header_index[name]
        return raw[idx].strip() if idx < len(raw) else ""

    title_raw = field(COL_TITLE)
    first_name = field(COL_FIRST_NAME)
    last_name = field(COL_LAST_NAME)
    unit_code = _normalize_unit_code(field(COL_UNIT_CODE))
    unit_name = field(COL_UNIT_NAME)

    # Row-level problems skip and count the row: blank first/last name, blank
    # unit name, or a unit code that fails the AAA999 / derivable-year contract.
    if not first_name or not last_name or not unit_name or unit_code is None:
        counts["skipped_invalid_rows"] += 1
        return None

    first_name = to_title_case(first_name)
    last_name = to_title_case(last_name)
    unit_name = to_title_case(unit_name)

    return _CandidateRow(
        name_key=_normalize_name_key(first_name, last_name),
        first_name=first_name,
        last_name=last_name,
        title_raw=title_raw,
        unit_code=unit_code,
        unit_name=unit_name,
    )


def _apply_candidates(
    db: DBSession,
    candidates: list[_CandidateRow],
) -> tuple[int, int, int]:
    """Ensure lecturers/units exist and add team links, then commit atomically.

    Returns ``(created_lecturers, created_units, added_team_memberships)``. Rolls
    back and raises a structured 500 on an unexpected persistence failure.
    """
    # Pre-load existing lecturers by normalized name key and units by normalized
    # code so every candidate is resolved against current persistent state.
    lecturers_by_key: dict[tuple[str, str], Lecturer] = {}
    for lecturer in db.query(Lecturer).all():
        key = _normalize_name_key(lecturer.first_name, lecturer.last_name)
        # First existing match wins; existing lecturers are never retitled.
        lecturers_by_key.setdefault(key, lecturer)

    units_by_code: dict[str, Unit] = {unit.code: unit for unit in db.query(Unit).all()}

    # Current team membership per unit code, tracked so additions within the file
    # are also deduplicated and pre-existing links count as no-ops.
    team_ids_by_code: dict[str, set[str]] = {
        code: {lec.id for lec in unit.lecturers}
        for code, unit in units_by_code.items()
    }

    created_lecturers = 0
    created_units = 0
    added = 0

    try:
        for candidate in candidates:
            lecturer = lecturers_by_key.get(candidate.name_key)
            if lecturer is None:
                lecturer = Lecturer(
                    title=_map_title(candidate.title_raw),
                    first_name=candidate.first_name,
                    last_name=candidate.last_name,
                )
                db.add(lecturer)
                db.flush()
                lecturers_by_key[candidate.name_key] = lecturer
                created_lecturers += 1

            unit = units_by_code.get(candidate.unit_code)
            if unit is None:
                unit = Unit(
                    code=candidate.unit_code,
                    name=candidate.unit_name,
                    year_level=parse_unit_year_level(candidate.unit_code),
                    students=[],
                )
                db.add(unit)
                db.flush()
                units_by_code[candidate.unit_code] = unit
                team_ids_by_code[candidate.unit_code] = set()
                created_units += 1

            team_ids = team_ids_by_code[candidate.unit_code]
            if lecturer.id not in team_ids:
                unit.lecturers.append(lecturer)
                team_ids.add(lecturer.id)
                added += 1

        db.commit()
    except AppError:
        raise
    except Exception:
        db.rollback()
        raise AppError(
            "import_failed",
            "The lecturer import could not be saved.",
            status_code=500,
        )

    return created_lecturers, created_units, added
