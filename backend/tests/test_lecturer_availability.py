"""Tests for Unit 61: lecturer availability replace-all save hardening.

Covers the ``set_availability`` service's transactional replace semantics:
creating from empty, replacing one set with a different set, clearing all
availability with an empty list, saving the same set twice, deduplicating
duplicate request entries, and leaving other lecturers' rows untouched. Uses the
in-memory SQLite ``db`` fixture from conftest so fixtures match production ORM
models exactly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select

from api.errors import AppError
from models.lecturer import (
    AvailabilityDay,
    AvailabilitySlot,
    Lecturer,
    LecturerAvailability,
    LecturerTitle,
)
from schemas.lecturer import AvailabilityEntry, LecturerAvailabilitySet
from services.lecturer import set_availability


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_lecturer(db, lecturer_id="lec1", last_name="Lovelace") -> Lecturer:
    lec = Lecturer(
        id=lecturer_id,
        title=LecturerTitle.DR,
        first_name="Ada",
        last_name=last_name,
    )
    db.add(lec)
    db.commit()
    return lec


def entry(day: AvailabilityDay, slot: AvailabilitySlot) -> AvailabilityEntry:
    return AvailabilityEntry(day=day, slot=slot)


def slot_pairs(lecturer: Lecturer) -> set[tuple[str, str]]:
    return {(s.day.value, s.slot.value) for s in lecturer.unavailable_slots}


def db_rows(db, lecturer_id: str) -> list[LecturerAvailability]:
    return list(
        db.execute(
            select(LecturerAvailability).where(
                LecturerAvailability.lecturer_id == lecturer_id
            )
        ).scalars()
    )


# ---------------------------------------------------------------------------
# Create from empty
# ---------------------------------------------------------------------------


def test_create_availability_from_empty(db):
    make_lecturer(db)
    payload = LecturerAvailabilitySet(
        unavailable=[
            entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
            entry(AvailabilityDay.TUESDAY, AvailabilitySlot.S5),
        ]
    )

    lecturer = set_availability(db, "lec1", payload)

    expected = {("Monday", "s1"), ("Tuesday", "s5")}
    assert slot_pairs(lecturer) == expected
    assert {(r.day.value, r.slot.value) for r in db_rows(db, "lec1")} == expected


# ---------------------------------------------------------------------------
# Replace one set with a different set
# ---------------------------------------------------------------------------


def test_replace_set_with_different_set(db):
    make_lecturer(db)
    set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S2),
            ]
        ),
    )

    lecturer = set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[
                entry(AvailabilityDay.FRIDAY, AvailabilitySlot.S7),
            ]
        ),
    )

    expected = {("Friday", "s7")}
    assert slot_pairs(lecturer) == expected
    assert {(r.day.value, r.slot.value) for r in db_rows(db, "lec1")} == expected


def test_replace_overlapping_set_no_unique_conflict(db):
    """A repeated save that keeps some slots and adds/removes others must not
    trip the (lecturer_id, day, slot) unique constraint."""
    make_lecturer(db)
    set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S2),
            ]
        ),
    )

    lecturer = set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S3),
            ]
        ),
    )

    expected = {("Monday", "s1"), ("Monday", "s3")}
    assert slot_pairs(lecturer) == expected
    assert {(r.day.value, r.slot.value) for r in db_rows(db, "lec1")} == expected


# ---------------------------------------------------------------------------
# Clear all availability with an empty list
# ---------------------------------------------------------------------------


def test_clear_all_availability_with_empty_list(db):
    make_lecturer(db)
    set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[
                entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
                entry(AvailabilityDay.TUESDAY, AvailabilitySlot.S5),
            ]
        ),
    )

    lecturer = set_availability(db, "lec1", LecturerAvailabilitySet(unavailable=[]))

    assert slot_pairs(lecturer) == set()
    assert db_rows(db, "lec1") == []


def test_clear_when_already_empty(db):
    make_lecturer(db)

    lecturer = set_availability(db, "lec1", LecturerAvailabilitySet(unavailable=[]))

    assert slot_pairs(lecturer) == set()
    assert db_rows(db, "lec1") == []


# ---------------------------------------------------------------------------
# Save the same set twice
# ---------------------------------------------------------------------------


def test_save_same_set_twice_is_idempotent(db):
    make_lecturer(db)
    payload = LecturerAvailabilitySet(
        unavailable=[
            entry(AvailabilityDay.WEDNESDAY, AvailabilitySlot.S4),
            entry(AvailabilityDay.THURSDAY, AvailabilitySlot.S6),
        ]
    )

    set_availability(db, "lec1", payload)
    lecturer = set_availability(db, "lec1", payload)

    expected = {("Wednesday", "s4"), ("Thursday", "s6")}
    assert slot_pairs(lecturer) == expected
    rows = db_rows(db, "lec1")
    assert len(rows) == 2
    assert {(r.day.value, r.slot.value) for r in rows} == expected


# ---------------------------------------------------------------------------
# Duplicate request entries deduplicate safely
# ---------------------------------------------------------------------------


def test_duplicate_request_entries_deduplicate(db):
    make_lecturer(db)
    payload = LecturerAvailabilitySet(
        unavailable=[
            entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
            entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
            entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1),
            entry(AvailabilityDay.TUESDAY, AvailabilitySlot.S2),
        ]
    )

    lecturer = set_availability(db, "lec1", payload)

    expected = {("Monday", "s1"), ("Tuesday", "s2")}
    assert slot_pairs(lecturer) == expected
    rows = db_rows(db, "lec1")
    assert len(rows) == 2
    assert {(r.day.value, r.slot.value) for r in rows} == expected


# ---------------------------------------------------------------------------
# Missing lecturer
# ---------------------------------------------------------------------------


def test_missing_lecturer_raises_404(db):
    try:
        set_availability(
            db, "nope", LecturerAvailabilitySet(unavailable=[])
        )
    except AppError as exc:
        assert exc.status_code == 404
        assert exc.code == "lecturer_not_found"
    else:  # pragma: no cover - explicit failure path
        raise AssertionError("expected AppError 404 for missing lecturer")


# ---------------------------------------------------------------------------
# Other lecturers are untouched
# ---------------------------------------------------------------------------


def test_other_lecturers_rows_untouched(db):
    make_lecturer(db, lecturer_id="lec1", last_name="One")
    make_lecturer(db, lecturer_id="lec2", last_name="Two")

    set_availability(
        db,
        "lec2",
        LecturerAvailabilitySet(
            unavailable=[entry(AvailabilityDay.FRIDAY, AvailabilitySlot.S7)]
        ),
    )

    # Saving (and later clearing) lec1 must never affect lec2's rows.
    set_availability(
        db,
        "lec1",
        LecturerAvailabilitySet(
            unavailable=[entry(AvailabilityDay.MONDAY, AvailabilitySlot.S1)]
        ),
    )
    set_availability(db, "lec1", LecturerAvailabilitySet(unavailable=[]))

    assert {(r.day.value, r.slot.value) for r in db_rows(db, "lec2")} == {
        ("Friday", "s7")
    }
    assert db_rows(db, "lec1") == []
