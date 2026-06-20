"""Build the static Campion timetable export template (Unit 93).

This is a one-off, repo-owned build step. It derives the committed static
template ``campion_timetable_export_template.xlsx`` from the uploaded
``S2, 2025 Timetable`` source workbook, so the export service can load a clean,
stable layout and only mutate the title, version, lecturer key, classes and
blocks at request time.

What it does:

* keeps the single ``S2, 2025 Timetable`` sheet (removes any others);
* clears every app-populated class/event value from the timetable grid
  (the s1-s7 slot bands across all day/room columns) and normalises those
  cells to the grey "empty cell" style, re-merging each room x slot cell into
  its 2-row visual band;
* preserves all fixed/static template content: day headers, room headers,
  time labels, the static ``Mass/Lunch`` row, the later evening rows
  (including the static ``FORMAL HALL`` banner), the notes area, and the
  lecturer/tutor key area layout;
* clears the old lecturer/tutor key names (the export regenerates them) while
  keeping the key area styling;
* sets the version text to a static ``Version 1``.

Run from the ``backend`` directory:

    python export_templates/build_template.py

The generated ``.xlsx`` is committed to the repository; this script only needs
to be re-run if the source layout changes.
"""
from __future__ import annotations

from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

# --- Layout constants (must mirror services/timetable_excel_export.py) -------

# Day blocks are 8 room columns wide, left to right Monday..Friday.
DAY_START_COLS = [2, 10, 18, 26, 34]  # B, J, R, Z, AH
ROOMS_PER_DAY = 8

# Each app slot occupies a two-row visual band; value lives in the top row.
SLOT_TOP_ROWS = [6, 8, 10, 14, 16, 18, 20]  # s1..s7
LAST_COL = DAY_START_COLS[-1] + ROOMS_PER_DAY - 1  # AO = 41

# Cells the app populates: every row inside a slot band, every day/room column.
GRID_ROWS = {r for top in SLOT_TOP_ROWS for r in (top, top + 1)}

# Lecturer/tutor key value cells to clear (layout + style preserved).
KEY_VALUE_CELLS = [
    f"{col}{row}" for col in ("A", "D") for row in range(29, 34)
]

VERSION_CELL = "K29"
STATIC_VERSION = "Version 1"

EMPTY_FILL = PatternFill(fill_type="solid", fgColor="FFD9D9D9")
EMPTY_FONT = Font(name="Trebuchet MS", size=10, bold=True)
EMPTY_ALIGN = Alignment(horizontal="center", vertical="top", wrap_text=True)

_MEDIUM = Side(style="medium", color="FF000000")
_THIN = Side(style="thin", color="FFC6C6C6")

SOURCE = Path("assets/excel/Timetable S2 2025 DRAFT .xlsx")
OUTPUT = Path("export_templates/campion_timetable_export_template.xlsx")


def _empty_border(col: int) -> Border:
    """Thin-grey interior with medium-black day separators on block edges."""
    left = _MEDIUM if col in DAY_START_COLS else _THIN
    right = _MEDIUM if col == LAST_COL or (col + 1) in DAY_START_COLS else _THIN
    return Border(top=_THIN, bottom=_THIN, left=left, right=right)


def _unmerge_grid(ws) -> None:
    for rng in list(ws.merged_cells.ranges):
        rows = set(range(rng.min_row, rng.max_row + 1))
        if rows <= GRID_ROWS and rng.min_col >= 2 and rng.max_col <= LAST_COL:
            ws.unmerge_cells(str(rng))


def _normalise_grid(ws) -> None:
    for start in DAY_START_COLS:
        for col in range(start, start + ROOMS_PER_DAY):
            border = _empty_border(col)
            for top in SLOT_TOP_ROWS:
                for row in (top, top + 1):
                    cell = ws.cell(row=row, column=col)
                    cell.value = None
                    cell.fill = EMPTY_FILL
                    cell.font = EMPTY_FONT
                    cell.alignment = EMPTY_ALIGN
                    cell.border = border
                ws.merge_cells(
                    start_row=top, start_column=col,
                    end_row=top + 1, end_column=col,
                )


def build() -> Path:
    wb = openpyxl.load_workbook(SOURCE)

    # One-sheet workbook only: keep the source layout sheet, drop the rest.
    keep = wb.worksheets[0]
    for ws in list(wb.worksheets):
        if ws is not keep:
            wb.remove(ws)
    ws = keep

    _unmerge_grid(ws)
    _normalise_grid(ws)

    # Static version text.
    ws[VERSION_CELL] = STATIC_VERSION

    # Clear old lecturer/tutor key names; the export regenerates them. Keep the
    # cell styling so generated entries inherit the key-area look.
    for coord in KEY_VALUE_CELLS:
        ws[coord].value = None

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
