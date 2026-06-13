"""Request/correlation ID middleware (Unit 49).

A pure-ASGI middleware that gives every HTTP request a stable ``request_id``
and binds it into structlog's context vars, so every log line emitted while
handling a request carries the same id without each call site passing it
explicitly. Solver flows additionally carry their own ``solver_run_id`` /
``correlation_id`` (Units 45/46); this request id correlates the synchronous
API surface (assignment saves, solver start/status).

It is pure ASGI on purpose: it never reads the request body, so no sensitive
payload (student lists, tokens) is touched while assigning correlation context.

Requires ``structlog.contextvars.merge_contextvars`` in the processor chain
(wired in :mod:`log.setup`).
"""

from __future__ import annotations

import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = b"x-request-id"


def _extract_request_id(scope: Scope) -> str:
    """Reuse an inbound ``X-Request-ID`` when present, else mint a new one."""
    for name, value in scope.get("headers", []):
        if name == REQUEST_ID_HEADER and value:
            return value.decode("latin-1")
    return uuid.uuid4().hex


class RequestContextMiddleware:
    """Bind a correlation id to logs and echo it back on the response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _extract_request_id(scope)
        # Expose to exception handlers via request.state (scope["state"]).
        scope.setdefault("state", {})["request_id"] = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                headers.append((REQUEST_ID_HEADER, request_id.encode("latin-1")))
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            structlog.contextvars.clear_contextvars()


def get_request_id(request) -> str | None:
    """Best-effort lookup of the current request's correlation id."""
    state = getattr(request, "state", None)
    return getattr(state, "request_id", None) if state is not None else None
