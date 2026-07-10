"""Shared text normalization helpers."""
import re

_TOKEN_PATTERN = re.compile(r"([-'\s]+)")


def to_title_case(value: str) -> str:
    """Title-case a name/label, capitalizing after spaces, hyphens, and apostrophes.

    Examples: ``"mary-jane o'brien"`` -> ``"Mary-Jane O'Brien"``;
    ``"ANCIENT HISTORY"`` -> ``"Ancient History"``. Non-alphabetic tokens
    (numbers, punctuation) are left untouched.
    """
    parts = _TOKEN_PATTERN.split(value)
    return "".join(
        part[:1].upper() + part[1:].lower() if part and part[0].isalpha() else part
        for part in parts
    )
