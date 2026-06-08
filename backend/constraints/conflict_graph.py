from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations


@dataclass(frozen=True)
class SessionNode:
    """Lightweight session representation used as graph input.

    Carries only the fields needed to derive conflicts — no ORM, no DB access.
    student_ids is empty for sessions with no enrolled students; those sessions
    produce no student-conflict edges.
    """

    session_id: str
    lecturer_id: str
    student_ids: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class ConflictEdge:
    """An undirected conflict edge between two sessions.

    Exactly one of shared_lecturer_id or shared_student_ids will be populated
    depending on which graph produced the edge.
    """

    session_id_a: str
    session_id_b: str
    shared_lecturer_id: str | None = None
    shared_student_ids: frozenset[str] = field(default_factory=frozenset)


def build_lecturer_conflict_graph(sessions: list[SessionNode]) -> list[ConflictEdge]:
    """Return one ConflictEdge for every pair of sessions sharing a lecturer.

    Output is deterministic: edges are sorted by (session_id_a, session_id_b)
    and within each lecturer bucket session IDs are sorted before pairing.
    """
    by_lecturer: dict[str, list[str]] = {}
    for s in sessions:
        by_lecturer.setdefault(s.lecturer_id, []).append(s.session_id)

    edges: list[ConflictEdge] = []
    for lecturer_id in sorted(by_lecturer):
        for a, b in combinations(sorted(by_lecturer[lecturer_id]), 2):
            edges.append(
                ConflictEdge(
                    session_id_a=a,
                    session_id_b=b,
                    shared_lecturer_id=lecturer_id,
                )
            )
    return edges


def build_student_conflict_graph(sessions: list[SessionNode]) -> list[ConflictEdge]:
    """Return one ConflictEdge for every pair of sessions sharing at least one student.

    Sessions with no enrolled students (empty student_ids) contribute no edges.
    When two sessions share multiple students, all shared student IDs are recorded
    on a single edge rather than producing one edge per student.

    Output is deterministic: edges are sorted by (session_id_a, session_id_b).
    """
    by_student: dict[str, list[str]] = {}
    for s in sessions:
        for student_id in s.student_ids:
            by_student.setdefault(student_id, []).append(s.session_id)

    pair_shared: dict[tuple[str, str], set[str]] = {}
    for student_id in sorted(by_student):
        for a, b in combinations(sorted(by_student[student_id]), 2):
            pair_shared.setdefault((a, b), set()).add(student_id)

    return [
        ConflictEdge(
            session_id_a=a,
            session_id_b=b,
            shared_student_ids=frozenset(shared),
        )
        for (a, b), shared in sorted(pair_shared.items())
    ]
