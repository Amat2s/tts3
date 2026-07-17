"""Hidden session-student allocation service (Unit 60, extended Unit 115).

Allocations are system-owned: there is no API route to view or edit them. This
module is the sole writer. The public entry point is
``rebalance_unit_session_allocations`` which is called after any mutation that
affects a unit's enrolment or its sessions.

Rules implemented here:
  - Lecture sessions allocate *every* student enrolled in the parent unit.
  - When at least one tutorial session exists, every enrolled student is
    allocated to exactly one tutorial session, with groups kept as even as
    possible.
  - Seminar sessions, like lectures, allocate *every* student enrolled in the
    parent unit to *every* seminar session (no partition).
  - Allocation is deterministic (stable ordering by student id and session id),
    never truly random, and preserves existing placements where doing so does
    not break the target even distribution — so repeated edits move the
    smallest practical number of students.

Allocation refresh does NOT commit: it mutates the session within the caller's
transaction (via ``db.flush()``) so that data mutation + allocation refresh are
atomic and never left partially updated. Callers own the ``commit()``.
"""
from collections import defaultdict

from sqlalchemy import select, text
from sqlalchemy.orm import Session as DBSession

from models.session import Session, SessionType
from models.session_allocation import SessionStudentAllocation
from models.unit import unit_students


def _enrolled_student_ids(db: DBSession, unit_id: str) -> set[str]:
    """Currently enrolled student ids for the unit, read from unit_students."""
    rows = db.execute(
        select(unit_students.c.student_id).where(
            unit_students.c.unit_id == unit_id
        )
    ).all()
    return {row[0] for row in rows}


def _reconcile(
    db: DBSession,
    target: dict[str, set[str]],
    existing_rows: dict[tuple[str, str], SessionStudentAllocation],
) -> None:
    """Diff existing allocation rows against the desired membership.

    ``target`` maps session_id -> desired set of student_ids. ``existing_rows``
    maps (session_id, student_id) -> row for the same set of sessions. Rows not
    in the target are deleted; target pairs without a row are inserted. Rows that
    are already correct are left untouched (stability + minimal writes).
    """
    target_pairs = {
        (session_id, student_id)
        for session_id, student_ids in target.items()
        for student_id in student_ids
    }
    existing_pairs = set(existing_rows.keys())

    for pair in existing_pairs - target_pairs:
        db.delete(existing_rows[pair])
    for session_id, student_id in target_pairs - existing_pairs:
        db.add(
            SessionStudentAllocation(session_id=session_id, student_id=student_id)
        )


def _group_target(
    session_ids: list[str],
    enrolled: set[str],
    existing_by_session: dict[str, set[str]],
) -> dict[str, set[str]]:
    """Compute a balanced, stable partition of ``enrolled`` across ``session_ids``.

    Each enrolled student ends up in exactly one of the given sessions. Existing
    valid placements are kept where they do not break the target distribution;
    only the surplus needed to even the groups is moved. Type-agnostic: used for
    both tutorial and seminar partitions (Unit 115), invoked independently per
    type so the two never influence each other.
    """
    if not session_ids:
        return {}

    tut_ids = sorted(session_ids)

    # 1. Deduplicate existing placements: keep each enrolled student in exactly
    #    one tutorial (the lowest session id), drop the rest as part of the diff.
    members: dict[str, set[str]] = {sid: set() for sid in tut_ids}
    seen: set[str] = set()
    for sid in tut_ids:
        for student_id in sorted(existing_by_session.get(sid, set())):
            if student_id in enrolled and student_id not in seen:
                members[sid].add(student_id)
                seen.add(student_id)

    # 2. Place students with no valid placement into the smallest tutorial,
    #    deterministically (fewest members, then lowest session id).
    for student_id in sorted(enrolled - seen):
        target_sid = min(tut_ids, key=lambda s: (len(members[s]), s))
        members[target_sid].add(student_id)

    # 3. Correct any pre-existing imbalance with the fewest moves. The target
    #    sizes are base or base+1; the `rem` sessions allowed the extra are the
    #    currently-largest ones (tie-broken by id) so few students need to move.
    n = len(enrolled)
    k = len(tut_ids)
    base, rem = divmod(n, k)
    by_size = sorted(tut_ids, key=lambda s: (-len(members[s]), s))
    desired = {sid: base + (1 if i < rem else 0) for i, sid in enumerate(by_size)}

    pool: list[str] = []
    for sid in tut_ids:
        surplus = sorted(members[sid])
        while len(members[sid]) > desired[sid]:
            victim = surplus.pop()  # deterministic: highest student id
            members[sid].discard(victim)
            pool.append(victim)

    pool.sort()
    for sid in tut_ids:
        while len(members[sid]) < desired[sid]:
            members[sid].add(pool.pop())

    return members


def rebalance_unit_session_allocations(db: DBSession, unit_id: str) -> None:
    """Refresh hidden session-student allocations for a single unit.

    Idempotent and robust to stale rows. Flushes within the caller's transaction
    but does not commit.
    """
    # Serialize concurrent allocation refreshes for the same unit. Session and
    # student creates fire in parallel (e.g. the unit modal persists its sessions
    # with Promise.all -> one POST/transaction each). Without a per-unit lock two
    # concurrent rebalances can each read a session list that is missing the
    # other's just-inserted session and each allocate the whole cohort to its own
    # tutorial, leaving every student in every tutorial with no later refresh to
    # correct it.
    #
    # We use a transaction-scoped *advisory* lock rather than SELECT ... FOR UPDATE
    # on the units row: the caller has already INSERTed the new session, which
    # holds a FOR KEY SHARE lock on the parent units row, so two concurrent
    # transactions both hold that share lock and upgrading it to FOR UPDATE
    # deadlocks. An advisory lock lives in its own lock space (no interaction with
    # the FK row locks), so the second refresh simply waits for the first to
    # commit, then re-reads the full session set (READ COMMITTED) and partitions
    # correctly. Guarded to Postgres so the SQLite test fixture is unaffected.
    if db.get_bind().dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
            {"key": f"session_alloc:{unit_id}"},
        )

    enrolled = _enrolled_student_ids(db, unit_id)

    sessions = db.query(Session).filter(Session.unit_id == unit_id).all()
    lecture_ids = [s.id for s in sessions if s.session_type == SessionType.LECTURE]
    tutorial_ids = [s.id for s in sessions if s.session_type == SessionType.TUTORIAL]
    seminar_ids = [s.id for s in sessions if s.session_type == SessionType.SEMINAR]

    all_ids = [s.id for s in sessions]
    existing = (
        db.query(SessionStudentAllocation)
        .filter(SessionStudentAllocation.session_id.in_(all_ids))
        .all()
        if all_ids
        else []
    )
    existing_by_session: dict[str, set[str]] = defaultdict(set)
    rows_by_pair: dict[tuple[str, str], SessionStudentAllocation] = {}
    for row in existing:
        existing_by_session[row.session_id].add(row.student_id)
        rows_by_pair[(row.session_id, row.student_id)] = row

    # Lectures: every enrolled student in every lecture session.
    lecture_id_set = set(lecture_ids)
    lecture_target = {sid: set(enrolled) for sid in lecture_ids}
    lecture_rows = {
        pair: row
        for pair, row in rows_by_pair.items()
        if pair[0] in lecture_id_set
    }
    _reconcile(db, lecture_target, lecture_rows)

    # Tutorials: evenly divide enrolled students across the tutorial sessions.
    tutorial_id_set = set(tutorial_ids)
    tutorial_target = _group_target(tutorial_ids, enrolled, existing_by_session)
    tutorial_rows = {
        pair: row
        for pair, row in rows_by_pair.items()
        if pair[0] in tutorial_id_set
    }
    _reconcile(db, tutorial_target, tutorial_rows)

    # Seminars: like lectures, every enrolled student attends every seminar
    # session (no partition). Kept as its own block, mirroring the lecture rule,
    # so it can be flipped back to an independent partition (_group_target) if
    # the seminar model changes again.
    seminar_id_set = set(seminar_ids)
    seminar_target = {sid: set(enrolled) for sid in seminar_ids}
    seminar_rows = {
        pair: row
        for pair, row in rows_by_pair.items()
        if pair[0] in seminar_id_set
    }
    _reconcile(db, seminar_target, seminar_rows)

    db.flush()


def allocation_counts(db: DBSession, session_ids: list[str]) -> dict[str, int]:
    """Number of allocated students per session id (0 when none/absent)."""
    if not session_ids:
        return {}
    counts: dict[str, int] = {sid: 0 for sid in session_ids}
    rows = (
        db.query(SessionStudentAllocation.session_id)
        .filter(SessionStudentAllocation.session_id.in_(session_ids))
        .all()
    )
    for (session_id,) in rows:
        counts[session_id] = counts.get(session_id, 0) + 1
    return counts


def allocated_student_ids(
    db: DBSession, session_ids: list[str]
) -> dict[str, list[str]]:
    """Sorted allocated student ids per session id (empty list when none)."""
    if not session_ids:
        return {}
    result: dict[str, list[str]] = {sid: [] for sid in session_ids}
    rows = (
        db.query(
            SessionStudentAllocation.session_id,
            SessionStudentAllocation.student_id,
        )
        .filter(SessionStudentAllocation.session_id.in_(session_ids))
        .all()
    )
    for session_id, student_id in rows:
        result.setdefault(session_id, []).append(student_id)
    for sid in result:
        result[sid].sort()
    return result
