import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import asyncio
import json
import pytest

from auth.deps import CurrentAdmin, get_current_admin
from db.deps import get_db
from main import app
from models.assignment import TimetableAssignment
from models.lecturer import AvailabilityDay, AvailabilitySlot, Lecturer, LecturerTitle
from models.room import Room, RoomType
from models.session import Session, SessionType
from models.solver_run import SolverRun, SolverRunStatus
from models.student import Student, StudentTitle
from models.unit import Unit
from services import solver_run as solver_run_service
from services.trigger_client import TriggerClientError, TriggerRunHandle


class ASGIResponse:
    def __init__(self, status_code: int, body: bytes) -> None:
        self.status_code = status_code
        self.body = body

    def json(self):
        return json.loads(self.body.decode("utf-8"))


class ASGITestClient:
    def __init__(self, application) -> None:
        self.application = application

    def post(self, path: str, json_body=None) -> ASGIResponse:
        return asyncio.run(self._request("POST", path, json_body))

    def get(self, path: str) -> ASGIResponse:
        return asyncio.run(self._request("GET", path))

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


def make_lecturer(db, lecturer_id="lec1") -> Lecturer:
    lecturer = Lecturer(
        id=lecturer_id,
        title=LecturerTitle.DR,
        first_name="Ada",
        last_name="Lovelace",
    )
    db.add(lecturer)
    return lecturer


def make_student(db, student_id: str) -> Student:
    student = Student(
        id=student_id,
        title=StudentTitle.MX,
        first_name="Stu",
        last_name=student_id,
        year_level=1,
    )
    db.add(student)
    return student


def make_room(db, room_id="room1", capacity=30) -> Room:
    room = Room(
        id=room_id,
        name=room_id,
        capacity=capacity,
        room_type=RoomType.LECTURE,
    )
    db.add(room)
    return room


def make_unit(db, unit_id="unit1", lecturer_id="lec1", student_ids=()) -> Unit:
    unit = Unit(
        id=unit_id,
        code="HIS101",
        name="History 101",
        year_level=1,
    )
    db.add(unit)
    db.flush()
    lecturer = db.get(Lecturer, lecturer_id)
    if lecturer is not None:
        unit.lecturers.append(lecturer)
    for student_id in student_ids:
        unit.students.append(make_student(db, student_id))
    return unit


def make_session(db, session_id="sess1", unit_id="unit1", duration=1, lecturer_id="lec1") -> Session:
    session = Session(
        id=session_id,
        unit_id=unit_id,
        session_type=SessionType.LECTURE,
        duration=duration,
        lecturer_id=lecturer_id,
    )
    db.add(session)
    return session


def make_assignment(db, session_id="sess1", room_id="room1") -> TimetableAssignment:
    assignment = TimetableAssignment(
        session_id=session_id,
        room_id=room_id,
        day=AvailabilityDay.MONDAY,
        start_slot=AvailabilitySlot.S1,
    )
    db.add(assignment)
    return assignment


def make_schedulable_state(db) -> None:
    make_lecturer(db)
    make_room(db)
    make_unit(db)
    make_session(db)
    db.commit()


def test_start_solver_requires_auth(unauthenticated_client):
    response = unauthenticated_client.post("/solver/start")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_status_requires_auth(unauthenticated_client, db):
    run = SolverRun(
        id="run-1",
        status=SolverRunStatus.SUCCEEDED,
        correlation_id="corr-1",
    )
    db.add(run)
    db.commit()

    response = unauthenticated_client.get("/solver/status/run-1")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_start_solver_uses_saved_state_only_and_triggers_job(client, db, monkeypatch):
    make_schedulable_state(db)
    seen_payloads = []

    def fake_trigger(payload):
        seen_payloads.append(payload)
        return TriggerRunHandle(id="job-123")

    monkeypatch.setattr(solver_run_service, "trigger_solver_job", fake_trigger)

    response = client.post(
        "/solver/start",
        json_body={"assignments": [{"session_id": "frontend-draft"}]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["job_id"] == "job-123"
    assert body["scheduled_count"] is None
    assert body["unscheduled_count"] is None
    assert body["partial_success"] is False
    assert len(seen_payloads) == 1
    assert seen_payloads[0]["solverRunId"] == body["solver_run_id"]
    assert seen_payloads[0]["correlationId"]
    assert seen_payloads[0]["adminWorkspaceId"] == "admin-1"
    assert "assignments" not in seen_payloads[0]


def test_start_rejects_active_solver_run(client, db, monkeypatch):
    make_schedulable_state(db)
    active = SolverRun(
        id="active-run",
        status=SolverRunStatus.RUNNING,
        correlation_id="corr-active",
    )
    db.add(active)
    db.commit()

    monkeypatch.setattr(
        solver_run_service,
        "trigger_solver_job",
        lambda _payload: pytest.fail("active run should block trigger"),
    )

    response = client.post("/solver/start")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "solver_run_active"


def test_start_returns_no_work_status_without_trigger(client, db, monkeypatch):
    make_room(db)
    db.commit()

    monkeypatch.setattr(
        solver_run_service,
        "trigger_solver_job",
        lambda _payload: pytest.fail("no-work run should not trigger a job"),
    )

    response = client.post("/solver/start")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["job_id"] is None
    assert body["scheduled_count"] == 0
    assert body["unscheduled_count"] == 0
    assert body["partial_success"] is False


def test_start_defensive_integrity_failure_is_structured(client, db, monkeypatch):
    make_lecturer(db)
    make_room(db, capacity=1)
    make_unit(db, student_ids=["s1", "s2"])
    make_session(db)
    make_assignment(db)
    db.commit()

    monkeypatch.setattr(
        solver_run_service,
        "trigger_solver_job",
        lambda _payload: pytest.fail("integrity failure should block trigger"),
    )

    response = client.post("/solver/start")

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "solver_integrity_failed"
    assert "Saved timetable state failed solver integrity checks" in body["error"]["message"]


def test_start_trigger_failure_marks_run_failed(client, db, monkeypatch):
    make_schedulable_state(db)

    def fail_trigger(_payload):
        raise TriggerClientError("boom")

    monkeypatch.setattr(solver_run_service, "trigger_solver_job", fail_trigger)

    response = client.post("/solver/start")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "solver_job_trigger_failed"
    run = db.query(SolverRun).one()
    assert run.status == SolverRunStatus.FAILED
    assert run.failure_code == "trigger_failed"


def test_status_returns_frontend_friendly_shape(client, db):
    run = SolverRun(
        id="run-1",
        status=SolverRunStatus.SUCCEEDED,
        trigger_job_id="job-1",
        correlation_id="corr-1",
        scheduled_count=3,
        unscheduled_count=1,
        partial_success=True,
    )
    db.add(run)
    db.commit()

    response = client.get("/solver/status/run-1")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "solver_run_id": "run-1",
        "status": "succeeded",
        "job_id": "job-1",
        "created_at": body["created_at"],
        "updated_at": body["updated_at"],
        "scheduled_count": 3,
        "unscheduled_count": 1,
        "partial_success": True,
        "failure_message": None,
    }


def test_status_404_is_structured(client):
    response = client.get("/solver/status/missing-run")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "solver_run_not_found"


# --- Internal solver execution endpoint (Unit 56) ---

from fastapi.security import HTTPAuthorizationCredentials  # noqa: E402

import solver.job as solver_job_module  # noqa: E402
from api.errors import AppError  # noqa: E402
from auth.deps import require_internal_token  # noqa: E402
from config import settings  # noqa: E402


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_internal_token_fails_closed_when_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "solver_internal_token", None)
    with pytest.raises(AppError) as exc:
        require_internal_token(_creds("anything"))
    assert exc.value.status_code == 503
    assert exc.value.code == "internal_token_unconfigured"


def test_internal_token_rejects_missing_credentials(monkeypatch):
    monkeypatch.setattr(settings, "solver_internal_token", "secret")
    with pytest.raises(AppError) as exc:
        require_internal_token(None)
    assert exc.value.status_code == 401
    assert exc.value.code == "invalid_internal_token"


def test_internal_token_rejects_wrong_token(monkeypatch):
    monkeypatch.setattr(settings, "solver_internal_token", "secret")
    with pytest.raises(AppError) as exc:
        require_internal_token(_creds("nope"))
    assert exc.value.status_code == 401
    assert exc.value.code == "invalid_internal_token"


def test_internal_token_accepts_correct_token(monkeypatch):
    monkeypatch.setattr(settings, "solver_internal_token", "secret")
    assert require_internal_token(_creds("secret")) is None


def test_execute_solver_run_delegates_to_runner_with_reference_only(db, monkeypatch):
    captured = {}

    class FakeResult:
        def to_dict(self):
            return {"status": "completed", "solver_run_id": "run-x"}

    def fake_run(session, payload):
        captured["session"] = session
        captured["payload"] = payload
        return FakeResult()

    monkeypatch.setattr(solver_job_module, "run_solver_job", fake_run)

    result = solver_run_service.execute_solver_run(
        db,
        solver_run_id="run-x",
        correlation_id="corr-x",
        admin_workspace_id="admin-1",
    )

    assert result == {"status": "completed", "solver_run_id": "run-x"}
    assert captured["session"] is db
    assert captured["payload"].solver_run_id == "run-x"
    assert captured["payload"].correlation_id == "corr-x"
    assert captured["payload"].admin_workspace_id == "admin-1"
    assert captured["payload"].snapshot_id is None
