"""Backend observability (Unit 49).

Sentry exception capture, request/correlation ID middleware, and safe log
payload conventions. The structured-logging foundation itself stays in
:mod:`log.setup` (structlog); this package layers exception capture and
correlation context on top of it without replacing it.
"""

from observability.request_context import (
    RequestContextMiddleware,
    get_request_id,
)
from observability.safe_logging import MAX_LOGGED_IDS, id_sample
from observability.sentry import (
    capture_unexpected_exception,
    configure_sentry,
    sentry_is_enabled,
)

__all__ = [
    "RequestContextMiddleware",
    "get_request_id",
    "MAX_LOGGED_IDS",
    "id_sample",
    "capture_unexpected_exception",
    "configure_sentry",
    "sentry_is_enabled",
]
