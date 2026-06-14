"""Domain helper for deriving a unit's year level from its unit code.

The product rule (Unit 58 spec): find the first digit in the unit code string.
That digit must be 1, 2, or 3 and becomes the unit's derived ``year_level``.
Codes without a valid first digit are rejected.

This module is pure and free of FastAPI/SQLAlchemy imports so it can be reused
by Pydantic schema validation, the unit service, and the Alembic backfill
migration without coupling them together.
"""

VALID_YEAR_LEVELS = (1, 2, 3)


class InvalidUnitCodeError(ValueError):
    """Raised when a unit code has no valid first digit in 1..3.

    Subclasses ``ValueError`` so Pydantic field validators surface it as a 422
    validation error, while still being a structured domain error type that
    services and migrations can catch explicitly.
    """


def parse_unit_year_level(code: str) -> int:
    """Return the derived year level (1, 2, or 3) for a unit code.

    The first digit found in the (whitespace-stripped) code determines the year
    level. Raises :class:`InvalidUnitCodeError` if there is no digit, or if the
    first digit is not 1, 2, or 3.
    """
    stripped = code.strip()
    for char in stripped:
        if char.isdigit():
            digit = int(char)
            if digit in VALID_YEAR_LEVELS:
                return digit
            raise InvalidUnitCodeError(
                f"Unit code '{stripped}' has first digit {digit}; "
                "the first digit must be 1, 2, or 3."
            )
    raise InvalidUnitCodeError(
        f"Unit code '{stripped}' has no digit; "
        "the year level must be derivable from a first digit of 1, 2, or 3."
    )
