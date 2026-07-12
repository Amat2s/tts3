"""Unit tests for the shared ``to_title_case`` text helper."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from services.text import to_title_case


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("john smith", "John Smith"),
        ("JOHN SMITH", "John Smith"),
        ("jOHN sMITH", "John Smith"),
        ("mary-jane", "Mary-Jane"),
        ("o'brien", "O'Brien"),
        ("d'angelo o'brien-smith", "D'Angelo O'Brien-Smith"),
        ("  ada   lovelace  ", "  Ada   Lovelace  "),
        ("ancient history", "Ancient History"),
        ("2025", "2025"),
        ("", ""),
    ],
)
def test_to_title_case(raw, expected):
    assert to_title_case(raw) == expected
