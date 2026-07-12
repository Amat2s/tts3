"""Tests for Unit 113: backend room ordering persistence.

Covers the persisted ``Room.position`` contract: ``list_rooms`` ordered by
``position`` (name tiebreak), ``create_room`` appending to the end, the
``reorder_rooms`` service persisting a full ordered id list atomically, and the
structured 422 ``rooms_reorder_mismatch`` on any missing/unknown/duplicate id
(nothing persisted). Also asserts ``RoomResponse`` exposes ``position`` and the
``PUT /rooms/reorder`` route requires admin auth. Uses the in-memory SQLite
``db`` fixture from conftest.
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from api.errors import AppError
from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from main import app
from models.room import Room, RoomType
from schemas.room import RoomCreate, RoomResponse
from services.room import create_room, list_rooms, reorder_rooms


# ---------------------------------------------------------------------------
# Minimal ASGI test client (mirrors test_solver_api) with PUT support.
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

    def put(self, path: str, json_body=None) -> ASGIResponse:
        return asyncio.run(self._request("PUT", path, json_body))

    async def _request(self, method: str, path: str, json_body=None) -> ASGIResponse:
        body = b""
        headers = [(b"host", b"testserver")]
        if json_body is not None:
            body = json.dumps(json_body).encode("utf-8")
            headers.append((b"content-type", b"application/json"))

        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": method,
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
        body_chunks = [
            m.get("body", b"")
            for m in messages
            if m["type"] == "http.response.body"
        ]
        return ASGIResponse(start["status"], b"".join(body_chunks))


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


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def make_room(db, name, capacity=30) -> Room:
    return create_room(
        db, RoomCreate(name=name, capacity=capacity, room_type=RoomType.LECTURE)
    )


# ---------------------------------------------------------------------------
# Ordering & create
# ---------------------------------------------------------------------------


def test_create_room_appends_to_end(db):
    first = make_room(db, "Alpha")
    second = make_room(db, "Beta")
    third = make_room(db, "Gamma")

    assert first.position == 0
    assert second.position == 1
    assert third.position == 2
    # A brand-new room is the right-most (highest position) column.
    assert third.position == max(r.position for r in db.query(Room).all())


def test_list_rooms_ordered_by_position_then_name(db):
    # Insert out of alphabetical order; positions follow insertion (append).
    make_room(db, "Zulu")
    make_room(db, "Alpha")
    make_room(db, "Mike")

    ordered = list_rooms(db)

    assert [r.name for r in ordered] == ["Zulu", "Alpha", "Mike"]
    assert [r.position for r in ordered] == [0, 1, 2]


def test_list_rooms_name_tiebreak_on_equal_position(db):
    # Direct construction leaves the default position 0 on both rooms, so the
    # name tiebreak decides the order deterministically.
    db.add(Room(id="r1", name="Bravo", capacity=10, room_type=RoomType.LECTURE))
    db.add(Room(id="r2", name="Alpha", capacity=10, room_type=RoomType.LECTURE))
    db.commit()

    ordered = list_rooms(db)

    assert [r.name for r in ordered] == ["Alpha", "Bravo"]


def test_delete_does_not_disturb_relative_order(db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")
    c = make_room(db, "Gamma")

    db.delete(b)
    db.commit()

    ordered = list_rooms(db)
    # Positional gap left by Beta is acceptable; the rest keep their order.
    assert [r.name for r in ordered] == ["Alpha", "Gamma"]
    assert a.position < c.position


# ---------------------------------------------------------------------------
# Reorder service
# ---------------------------------------------------------------------------


def test_reorder_rooms_persists_new_order(db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")
    c = make_room(db, "Gamma")

    reorder_rooms(db, [c.id, a.id, b.id])

    ordered = list_rooms(db)
    assert [r.name for r in ordered] == ["Gamma", "Alpha", "Beta"]
    assert [r.position for r in ordered] == [0, 1, 2]


def test_reorder_returns_reordered_rooms(db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")

    result = reorder_rooms(db, [b.id, a.id])

    assert [r.name for r in result] == ["Beta", "Alpha"]


def test_reorder_missing_id_rejected_and_nothing_persisted(db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")

    with pytest.raises(AppError) as exc:
        reorder_rooms(db, [b.id])  # missing a

    assert exc.value.status_code == 422
    assert exc.value.code == "rooms_reorder_mismatch"
    db.rollback()
    assert [r.name for r in list_rooms(db)] == ["Alpha", "Beta"]


def test_reorder_unknown_id_rejected_and_nothing_persisted(db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")

    with pytest.raises(AppError) as exc:
        reorder_rooms(db, [a.id, b.id, "ghost"])

    assert exc.value.code == "rooms_reorder_mismatch"
    db.rollback()
    assert [r.position for r in list_rooms(db)] == [0, 1]


def test_reorder_duplicate_id_rejected_and_nothing_persisted(db):
    a = make_room(db, "Alpha")
    make_room(db, "Beta")

    with pytest.raises(AppError) as exc:
        reorder_rooms(db, [a.id, a.id])  # right length, but a duplicate

    assert exc.value.code == "rooms_reorder_mismatch"
    db.rollback()
    assert [r.name for r in list_rooms(db)] == ["Alpha", "Beta"]


# ---------------------------------------------------------------------------
# Schema & API
# ---------------------------------------------------------------------------


def test_room_response_includes_position(db):
    room = make_room(db, "Alpha")

    dto = RoomResponse.model_validate(room)

    assert dto.position == room.position


def test_reorder_endpoint_reorders_via_api(client, db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")

    response = client.put("/rooms/reorder", {"ordered_ids": [b.id, a.id]})

    assert response.status_code == 200
    assert [r["name"] for r in response.json()] == ["Beta", "Alpha"]


def test_reorder_endpoint_requires_admin(unauthenticated_client, db):
    a = make_room(db, "Alpha")
    b = make_room(db, "Beta")

    response = unauthenticated_client.put(
        "/rooms/reorder", {"ordered_ids": [b.id, a.id]}
    )

    assert response.status_code == 401
