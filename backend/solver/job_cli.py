"""CLI bridge for the async solver job (Unit 45).

The Trigger.dev solver task (``jobs/src/trigger/solverJob.ts``) is a Node
process and cannot import the Python solver services directly. This module is
the thin process boundary it invokes:

    python <path>/solver/job_cli.py            # payload JSON on stdin
    python <path>/solver/job_cli.py '<json>'   # payload JSON as first argument

It reads a :class:`SolverJobPayload` as JSON, opens a real database session,
runs :func:`run_solver_job`, and prints the structured
:class:`SolverJobResult` as a single JSON line on **stdout**. All lifecycle /
diagnostic logging is routed to **stderr** so stdout carries only the result
document.

Contract: this script *always* prints exactly one JSON result object on
stdout — even when the payload is malformed or the backend environment cannot
be loaded — so the Node caller can always parse an outcome. Tracebacks are
additionally written to stderr for debugging.

Exit code:
- ``0`` for a completed or partial run;
- ``1`` for a failed run, a malformed payload, or a setup error.

This bridge contains no solver business logic — it only wires stdin/stdout to
the backend runner. It is intended for local development verification; a
production Trigger.dev deployment is out of scope for this unit.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import traceback

# Self-bootstrap: make the backend package root importable regardless of the
# process working directory, so `solver`, `config`, and `db` resolve even when
# this file is invoked by absolute path.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def _failure_doc(message: str, *, failure_code: str, payload=None) -> dict:
    return {
        "status": "failed",
        "solver_run_id": getattr(payload, "solver_run_id", None) or "",
        "correlation_id": getattr(payload, "correlation_id", None) or "",
        "solver_status": None,
        "sessions_attempted": 0,
        "sessions_scheduled": 0,
        "sessions_unscheduled": 0,
        "is_partial": False,
        "timed_out": False,
        "duration_seconds": 0,
        "started_at": "",
        "completed_at": "",
        "message": message,
        "failure_code": failure_code,
        "newly_scheduled_session_ids": [],
        "remaining_unscheduled_session_ids": [],
    }


def _configure_logging_to_stderr() -> None:
    """Route structlog output to stderr so stdout stays result-only."""
    try:
        import structlog

        structlog.configure(
            processors=[
                structlog.processors.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
            logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
            cache_logger_on_first_use=True,
        )
    except Exception:  # logging must never break the bridge
        pass


def _read_payload(argv: list[str]):
    from solver.job import SolverJobPayload

    raw = argv[1] if len(argv) > 1 else sys.stdin.read()
    if not raw or not raw.strip():
        raise ValueError("No solver job payload provided (stdin/argument empty).")
    return SolverJobPayload.from_dict(json.loads(raw))


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv if argv is None else argv)
    _configure_logging_to_stderr()

    # --- Parse payload (no DB / heavy imports yet). ---
    try:
        payload = _read_payload(argv)
    except Exception as exc:
        traceback.print_exc()
        print(json.dumps(_failure_doc(f"Invalid solver job payload: {exc}", failure_code="invalid_payload")))
        return 1

    # --- Load backend environment + run. Any setup failure (missing .env,
    # bad DATABASE_URL, import error, DB connection) becomes a structured
    # failure on stdout instead of an uncaught traceback. ---
    try:
        from solver.job import SolverJobStatus, run_solver_job
        from db.session import SessionLocal

        db = SessionLocal()
        try:
            result = run_solver_job(db, payload)
        finally:
            db.close()
    except Exception as exc:
        traceback.print_exc()
        print(
            json.dumps(
                _failure_doc(
                    f"Solver job bridge failed before/at execution: {exc}",
                    failure_code="bridge_setup_error",
                    payload=payload,
                )
            )
        )
        return 1

    print(json.dumps(result.to_dict()))
    return 0 if result.status != SolverJobStatus.FAILED else 1


if __name__ == "__main__":
    raise SystemExit(main())
