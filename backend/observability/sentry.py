"""Sentry backend setup (Unit 49).

Sentry captures *unexpected* backend exceptions. Expected product errors
(:class:`api.errors.AppError` — validation failures, defensive assignment-save
rejections, solver-not-ready) are returned as normal structured API errors and
are never reported here.

The integration is fully environment-driven:

* It is enabled only when ``SENTRY_DSN`` is configured.
* The backend runs normally when the DSN is absent or the SDK is not installed
  (the import is lazy and every call is defensive).
* Observability must never become product logic — a Sentry failure can never
  break a request.

We deliberately disable Sentry's automatic log-to-event capture
(``event_level=None``). Events are created only through explicit
:func:`capture_unexpected_exception` calls, so the many ``logger.error`` /
``logger.warning`` calls used for *expected* solver/validation failures are not
mistaken for crashes.
"""

from __future__ import annotations

import logging

import structlog

from config import settings

logger = structlog.get_logger(__name__)

_sentry_enabled = False


def configure_sentry() -> bool:
    """Initialise Sentry when a DSN is configured. Returns whether it is active.

    Safe to call once at startup. Never raises: a missing DSN, a missing SDK,
    or an init failure all degrade to "Sentry disabled" so the backend keeps
    running.
    """
    global _sentry_enabled

    dsn = settings.sentry_dsn
    if not dsn:
        logger.info("sentry_disabled", reason="no_dsn")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
    except ImportError:
        logger.warning("sentry_unavailable", reason="sentry_sdk_not_installed")
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=settings.environment,
            # Do not attach request bodies / user PII (no student payloads,
            # auth tokens, or secrets reach Sentry).
            send_default_pii=False,
            # No performance tracing in v1.
            traces_sample_rate=0.0,
            # Keep log records as breadcrumbs but never auto-promote them to
            # events; only explicit captures create issues.
            integrations=[
                LoggingIntegration(level=logging.INFO, event_level=None),
            ],
        )
    except Exception as exc:  # pragma: no cover - defensive init guard
        logger.warning("sentry_init_failed", error=str(exc))
        return False

    _sentry_enabled = True
    logger.info("sentry_enabled", environment=settings.environment)
    return True


def sentry_is_enabled() -> bool:
    return _sentry_enabled


def capture_unexpected_exception(exc: BaseException, **tags: object) -> None:
    """Send an unexpected exception to Sentry when it is configured.

    A no-op when Sentry is disabled. Never raises — observability must not
    break the request path. ``tags`` are short, non-sensitive identifiers
    (e.g. ``request_id``, ``path``); never pass tokens, secrets, or payloads.
    """
    if not _sentry_enabled:
        return
    try:
        import sentry_sdk

        if tags:
            # Isolate tags to this capture where the SDK supports it; fall back
            # to a plain capture on older/newer APIs.
            new_scope = getattr(sentry_sdk, "new_scope", None)
            if new_scope is not None:
                with new_scope() as scope:
                    for key, value in tags.items():
                        if value is not None:
                            scope.set_tag(key, str(value))
                    sentry_sdk.capture_exception(exc)
                return
        sentry_sdk.capture_exception(exc)
    except Exception:  # pragma: no cover - never let capture break a request
        return
