"""Build the static Campion timetable export template (Units 93, 96).

This is a one-off, repo-owned build step. It derives the committed static
template ``campion_timetable_export_template.xlsx`` from the uploaded
``S2, 2025 Timetable`` source workbook (``assets/excel/Timetable S2 2025
DRAFT .xlsx``), so the export service can load a clean, stable layout and only
mutate the title, version, lecturer key, classes and blocks at request time.

Unit 96 (styling parity) made this a *blanked copy of the real template* rather
than a workbook rebuilt from scratch. Concretely it:

* keeps the single ``S2, 2025 Timetable`` sheet (removes any others);
* **preserves** the source's column widths, row heights, sheet-format
  properties, sheet view, page setup, margins, tab colour, and every static
  merged range, static cell value, and static cell style untouched (day/room
  headers, time labels, the static ``Mass/Lunch`` row, the evening rows incl.
  the static ``FORMAL HALL`` banner, the notes area, and the lecturer/tutor key
  layout);
* clears every app-populated class/event value from the timetable grid (the
  s1-s7 slot bands across all day/room columns) and normalises those cells to
  the template's own grey "empty cell" style (fill/font/alignment/border Side
  objects are *copied from a real template empty cell*, never reconstructed
  from guessed RGB), re-merging each room x slot cell into its 2-row band;
* bakes **template-derived NamedStyles** for each subject class and each block
  colour, copied directly from the template's own class/event exemplar cells,
  so the export applies real template styles instead of constructing new ones;
* clears the old lecturer/tutor key names (the export regenerates them) while
  keeping the key-area styling, and sets the version text to ``Version 1``.

Run from the ``backend`` directory:

    python export_templates/build_template.py

The generated ``.xlsx`` is committed to the repository; this script only needs
to be re-run if the source layout changes.
"""
from __future__ import annotations

from copy import copy
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, NamedStyle, PatternFill

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

# --- Template style exemplars (cells copied verbatim from the source sheet) ---
#
# These are the canonical example cells the template itself uses; their styles
# are copied rather than re-approximated. Subject codes are keyed by unit-code
# prefix and mirror services/timetable_excel_export.py.

EMPTY_EXEMPLAR = "D6"  # a real grey "empty" grid cell (fill d9d9d9)

SUBJECT_EXEMPLARS = {
    "HIS": "C6",   # History  (fill fcd5b5)
    "THE": "B6",   # Theology (fill e6b9b8)
    "LIT": "O8",   # Literature (fill c4bd97)
    "PHI": "G16",  # Philosophy (fill b9cde5)
    "GRE": "AK6",  # Greek    (fill d7e4bd)
    "LAN": "M6",   # Latin/Languages (fill fdeada)
}
# Unknown/legacy prefixes (e.g. SCI) fall back to a neutral white class cell.
DEFAULT_CLASS_EXEMPLAR = "K6"  # a real white grid cell (fill ffffff)

# Static-event exemplars used to derive block styling (the app's blocks reuse
# the template's blocked/static-event look rather than frontend block tokens).
GOLD_EVENT_EXEMPLAR = "Z22"   # FORMAL HALL: gold cc9900 fill, maroon 660033 text
BLUE_EVENT_EXEMPLAR = "R10"   # Augustine Academy: blue 0070c0 fill, black text
MAROON_EVENT_EXEMPLAR = "B12"  # Mass/Lunch: maroon 660033 fill, gold cc9900 text

# Named styles the export applies. Must match the names in
# services/timetable_excel_export.py.
SUBJECT_STYLE_PREFIX = "tt_class_"
DEFAULT_CLASS_STYLE = "tt_class_default"
BLOCK_STYLE = {
    "gold": "tt_block_gold",
    "light_blue": "tt_block_blue",
    "light_pink": "tt_block_pink",
    None: "tt_block_unnamed",
}

SOURCE = Path("assets/excel/Timetable S2 2025 DRAFT .xlsx")
OUTPUT = Path("export_templates/campion_timetable_export_template.xlsx")


def _empty_border(ws, col: int):
    """Empty-cell border: medium-black band top + day separators, thin-grey
    interior. Side objects are copied from a real template empty cell so the
    grid lines match the source exactly rather than being reconstructed."""
    from openpyxl.styles import Border

    src = ws[EMPTY_EXEMPLAR]
    medium = copy(src.border.top)     # template medium-black side
    thin = copy(src.border.bottom)    # template thin-grey (c6c6c6) side
    left = copy(medium) if col in DAY_START_COLS else copy(thin)
    right = copy(medium) if col == LAST_COL or (col + 1) in DAY_START_COLS else copy(thin)
    return Border(top=copy(medium), bottom=copy(thin), left=left, right=right)


def _class_named_style(name: str, exemplar) -> NamedStyle:
    """A NamedStyle that copies a template class cell's style verbatim."""
    ns = NamedStyle(name=name)
    ns.font = copy(exemplar.font)
    ns.fill = copy(exemplar.fill)
    ns.border = copy(exemplar.border)
    ns.alignment = copy(exemplar.alignment)
    ns.number_format = exemplar.number_format
    return ns


def _block_named_style(name: str, fill_src, text_src, class_exemplar) -> NamedStyle:
    """A block NamedStyle reusing a template event's fill + text colour with the
    class cell's readable 10pt font/border/alignment."""
    ns = NamedStyle(name=name)
    base = class_exemplar.font
    ns.font = Font(
        name=base.name, size=base.size, bold=True,
        color=copy(text_src.font.color),
    )
    ns.fill = copy(fill_src.fill)
    ns.border = copy(class_exemplar.border)
    ns.alignment = copy(class_exemplar.alignment)
    ns.number_format = class_exemplar.number_format
    return ns


def _register_named_styles(ws, wb) -> None:
    class_exemplar = ws[SUBJECT_EXEMPLARS["HIS"]]
    for prefix, coord in SUBJECT_EXEMPLARS.items():
        wb.add_named_style(_class_named_style(SUBJECT_STYLE_PREFIX + prefix, ws[coord]))
    wb.add_named_style(_class_named_style(DEFAULT_CLASS_STYLE, ws[DEFAULT_CLASS_EXEMPLAR]))

    # Blocks: gold / blue / maroon(pink) event styling, plus a grey "blocked"
    # style for unnamed blocks (the template's empty-cell look).
    wb.add_named_style(_block_named_style(
        BLOCK_STYLE["gold"], ws[GOLD_EVENT_EXEMPLAR], ws[GOLD_EVENT_EXEMPLAR], class_exemplar,
    ))
    wb.add_named_style(_block_named_style(
        BLOCK_STYLE["light_blue"], ws[BLUE_EVENT_EXEMPLAR], ws[BLUE_EVENT_EXEMPLAR], class_exemplar,
    ))
    wb.add_named_style(_block_named_style(
        BLOCK_STYLE["light_pink"], ws[MAROON_EVENT_EXEMPLAR], ws[MAROON_EVENT_EXEMPLAR], class_exemplar,
    ))
    unnamed = _class_named_style(BLOCK_STYLE[None], ws[EMPTY_EXEMPLAR])
    unnamed.border = _empty_border(ws, DAY_START_COLS[0] + 1)  # interior grid border
    wb.add_named_style(unnamed)


def _unmerge_grid(ws) -> None:
    for rng in list(ws.merged_cells.ranges):
        rows = set(range(rng.min_row, rng.max_row + 1))
        if rows <= GRID_ROWS and rng.min_col >= 2 and rng.max_col <= LAST_COL:
            ws.unmerge_cells(str(rng))


def _normalise_grid(ws) -> None:
    src = ws[EMPTY_EXEMPLAR]
    for start in DAY_START_COLS:
        for col in range(start, start + ROOMS_PER_DAY):
            border = _empty_border(ws, col)
            for top in SLOT_TOP_ROWS:
                for row in (top, top + 1):
                    cell = ws.cell(row=row, column=col)
                    cell.value = None
                    cell.fill = copy(src.fill)
                    cell.font = copy(src.font)
                    cell.alignment = copy(src.alignment)
                    cell.border = copy(border)
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

    # Bake template-derived class/block styles BEFORE blanking the grid, while
    # the exemplar class/event cells still carry their original styles.
    _register_named_styles(ws, wb)

    _unmerge_grid(ws)
    _normalise_grid(ws)

    # Static version text (style preserved).
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
