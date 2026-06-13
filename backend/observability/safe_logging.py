"""Safe log payload conventions (Unit 49).

Logs should prefer counts and IDs over large payloads, and must never include
sensitive data: full student lists, auth tokens, database URLs, or Supabase
secrets. These small helpers make the safe shape the easy shape at call sites.

Rules of thumb:

* Log a count (``*_count``) instead of a collection of rows.
* When IDs genuinely aid debugging, log a bounded sample, not the full set.
* Never log a token, secret, connection string, or a student's personal data.
"""

from __future__ import annotations

from typing import Iterable

# Cap on how many ids we will ever place in a single log field, so a large
# request can never dump an unbounded payload into the logs.
MAX_LOGGED_IDS = 20


def id_sample(ids: Iterable[str], limit: int = MAX_LOGGED_IDS) -> list[str]:
    """Return at most ``limit`` ids for logging, preserving order.

    Use when a few ids help diagnosis but the full set could be large. Pair
    with a separate ``*_count`` field for the true total.
    """
    sample: list[str] = []
    for value in ids:
        sample.append(str(value))
        if len(sample) >= limit:
            break
    return sample
