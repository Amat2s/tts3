# Unit 97 Spec: Excel Export Template Fidelity Fix

## Goal

Make the generated timetable `.xlsx` visually match the **real** Campion
template exactly. The export currently places sessions in the correct cells but
its sizing, background shading, borders, and text positioning do not match the
template. This unit fixes those four defects by rebuilding the export template
from the correct source sheet and preserving that sheet's styling verbatim.

This unit must **not** redesign the export layout, change the day/room/slot
mapping, or change placement logic. The cell mapping is already correct (see
"Layout mapping is already correct" below). Only the _styling source_ is wrong.

## Root cause (important context for the implementer)

Units 93/96 built the export template asset
(`backend/export_templates/campion_timetable_export_template.xlsx`) and its
one-off builder (`backend/export_templates/build_template.py`) from a **stripped
`wijmo.xlsx` re-export** of the timetable. That re-export had lost the real
template's page setup, tab colour, sheet zoom, fine-grained row heights, default
column model, per-day background shading, and bold theme-coloured borders. Unit
96 then treated that stripped file as canonical and normalised the grid to a
single flat grey style, compounding the loss.

The **real pristine template is now present** at:

```
backend/assets/excel/Timetable S2 2025 DRAFT.xlsx
```

This workbook has three sheets: `Timetable Template`, `S2, 2025 Timetable `
(note the **trailing space** in the sheet name), and `S1, 2025 Timetable`. The
canonical sheet to export is **`S2, 2025 Timetable `** — it is the visual
source of truth for this unit. (The previous source file
`Timetable S2 2025 DRAFT .xlsx` — with a space before `.xlsx` — is the stale
stripped version and must no longer be used.)

Because the export service already loads a "blanked template" and only mutates
title/version/classes/blocks/key, **rebuilding that blank template from the
correct sheet fixes the majority of the defects on its own.** The remaining work
is to stop the builder from flattening the grid styling and to re-derive the
class/block style exemplars from the new sheet.

## Layout mapping is already correct — do not change it

The `S2, 2025 Timetable ` sheet uses exactly the mapping the export service
already encodes (`services/timetable_excel_export.py`), verified against the new
file:

- Worksheet dimension `A1:AP40`.
- Title cell `B2` (`Timetable: Semester 2, 2025`), version cell `K29`
  (currently `Version 4`).
- Day headers on **row 4** at columns `B, J, R, Z, AH` (Monday→Friday), each day
  an 8-column block.
- Room headers on **row 5**: `PDS, L1.05, Bromley, L1.08, Dawson, L1.10, L1.12, JTW` (matches `ROOM_ORDER`).
- Time labels in **column A**; app slots s1–s7 occupy two-row bands with top
  rows `6, 8, 10, 14, 16, 18, 20`.
- `Mass/Lunch` static row at **rows 12–13** (`A12` = `12.00 PM - 1.30PM`).
- Static `FORMAL HALL` at `Z22`; notes at `A27`; lecturer/tutor key heading
  `A28` with entries in columns `A`/`D` rows 29–33.

Do **not** alter `ROOM_ORDER`, `DAY_ORDER`, `_DAY_START_COL`, `_SLOT_TOP_ROW`,
`ORDERED_SLOTS`, the tutorial-lettering order, block rectangle merging, the
lecturer-key generation, or the no-persistence guarantee.

## The four defects to fix

Each defect below was confirmed by comparing the current committed export
template against the `S2, 2025 Timetable ` sheet of the new source. Treat these
as authoritative but still inspect the file directly.

### 1. Row and column sizes must match the template

The template lets **most room columns use the workbook default width** and only
sets custom widths on a small set of columns (`A`, `G`, `O`, `R`, `S`, `T`, `W`,
`Y`, `AE`; the rest are unset/default). The current export writes an explicit
`~13.57` width to **every** column.

Row heights also differ substantially. Template values (approx.): row 1 `13.5`,
row 2 `28.5`, row 3 `14.1`, row 4 `24.6` (day header), row 5 `33.0` (room
header), rows 6–11 `~45.6–45.95` (AM slot bands), row 12 `23.45`, row 13 `30.0`,
rows 14–24 `~45.95` (PM slot bands). The current export uses `18.75`/`25.125`/
`46.0` etc.

The template also carries sheet-level presentation the current export drops:
landscape orientation, page `scale 35`, `fitToPage`, sheet `zoomScale 90`, a
green tab colour (`FF00B050`), and `defaultRowHeight` `12.95`.

**Requirement:** every row height, every column-width definition (including
leaving default columns unset — do **not** emit explicit widths or `bestFit`
for columns the template leaves default), the sheet-format properties, page
setup, margins, tab colour, and sheet view (zoom) must be preserved exactly from
the template sheet. Do not run autofit.

### 2. Background slot colour — Tuesday and Thursday are white for contrast

The template shades day-blocks in an alternating pattern using **theme fills**:

- Empty grid cells in **Monday / Wednesday / Friday** blocks use `theme0`
  tint `-0.15` (a light grey).
- Empty grid cells in **Tuesday (cols J–Q) / Thursday (cols Z–AG)** blocks use
  `theme0` tint `0.0` (**pure white**) — this is the intended visual contrast
  between adjacent days.

The current builder normalises **every** empty grid cell to one flat grey
exemplar (`D6`), erasing the Tuesday/Thursday white contrast.

**Requirement:** the blank export template must preserve the template's per-day
empty-cell fills so Tuesday and Thursday remain white and Monday/Wednesday/Friday
remain grey. When the builder clears an example class value out of a populated
grid cell, it must reset that cell to **its own day-block's empty look** (white
for Tue/Thu, grey for Mon/Wed/Fri), not to a single global grey style. Copy
fills from real empty cells of the matching day type rather than reconstructing
RGB.

### 3. Borders must be bolder, darker, and more continuous

The template's grid borders are heavy and continuous: **medium** weight on the
top and bottom of every slot row, **medium** boxes around class cells, medium
left/right at day-block boundaries, and thin (but still dark, theme-coloured)
interior vertical separators between room columns. The current export downgrades
interior borders to thin light-grey (`c6c6c6`) and only draws a medium line at
each two-row band top, so the grid reads faint and broken up.

**Requirement:** grid, class, and block borders must be copied verbatim from the
template's own cells (theme/indexed colours and medium/thin `Side` weights
preserved). Do not reconstruct borders from approximated grey RGB. The blanked
empty cells must keep the template's medium row borders and dark interior
verticals so the exported grid has the same visual weight and continuity as the
template.

### 4. Text position — configure times, rooms, classes, and blocks separately

Alignment differs by cell category in the template and each must be matched
independently, not flattened to one alignment:

- **Time labels** (column A): horizontal `center`, vertical `center`, wrap
  `true` (the current export uses vertical `top`).
- **Day headers** (row 4) and **room headers** (row 5): horizontal `center`,
  vertical `center`.
- **Class cells**: match the template's class-cell alignment
  (`center` / vertical per the template exemplar / wrap `true`).
- **Block cells**: match the template's blocked/static-event alignment, derived
  from a real event cell (e.g. `FORMAL HALL` `Z22`), not the class alignment.

**Requirement:** verify and set the alignment of each category (times, rooms/day
headers, classes, blocks) from its corresponding template cell. Static
categories (times, headers) are preserved by the blank-copy approach; class and
block styles must carry the correct per-category alignment via their template
exemplars.

## Required implementation approach

### Rebuild the blank template from the correct sheet

Update `backend/export_templates/build_template.py` to:

- Point `SOURCE` at `assets/excel/Timetable S2 2025 DRAFT.xlsx` (no trailing
  space before `.xlsx`).
- Select the sheet **by name** `S2, 2025 Timetable ` (do **not** use
  `worksheets[0]` — that is now the generic `Timetable Template` sheet). Remove
  the other two sheets so the output is a single-sheet workbook.
- Keep the blank template a **verbatim blanked copy** of that sheet: preserve
  column widths (including unset/default columns), row heights, sheet-format
  properties, page setup, margins, tab colour, sheet view/zoom, and every static
  merged range, static value, and static style.
- Change the grid-blanking so it **preserves each empty cell's own fill and
  borders** (Tuesday/Thursday white, medium borders). Only clear the dynamic
  class/event **values** from the s1–s7 grid bands and reset each formerly
  populated grid cell to the empty look of **its own day block** — copied from a
  real empty cell of the same day type (grey exemplar for Mon/Wed/Fri, white
  exemplar for Tue/Thu). Re-merge each room×slot into its two-row band.
- Re-derive the baked class/block `NamedStyle`s from **real exemplar cells in the
  new sheet** (the new sheet uses theme-based fills, e.g. Theology `theme5/0.6`,
  History `theme9/0.6`, Literature `theme2/-0.25`). Re-locate the exemplar
  coordinate for each subject prefix (`HIS, THE, LIT, PHI, GRE, LAN`), the
  neutral default class style, and the block/event styles (gold/blue/pink from
  the template's own event cells; unnamed = the empty-cell look). Keep the
  `tt_class_*` / `tt_block_*` naming so the export service is unchanged.
- Regenerate and commit `campion_timetable_export_template.xlsx`.

### Keep the export service template-driven

`services/timetable_excel_export.py` should keep _applying_ the baked
`NamedStyle`s and preserving static content. Verify it does not reset row
heights or emit column widths, and that painting classes/blocks does not
overwrite the preserved per-day empty fills outside the painted rectangles.
Adjust only if a styling/merge defect is found; do not change placement,
mapping, tutorial lettering, block merging, or the no-persistence behaviour.

## Verification requirements

### Structural / style parity (backend tests)

Update `backend/tests/test_96_excel_export_style_parity.py` (and the Unit 93
suite where block-fill/style values change) to assert parity against the **new**
`S2, 2025 Timetable ` sheet. At minimum:

- one exported sheet named `S2, 2025 Timetable `, dimension `A1:AP40`;
- row heights for rows 1–40 equal the template;
- column-width definitions equal the template, including columns the template
  leaves default (assert those remain unset — no global explicit widths, no
  `bestFit`);
- sheet-format properties, page setup (landscape, scale 35, fitToPage), margins,
  tab colour, and sheet view zoom equal the template;
- empty Tuesday/Thursday grid cells are white and Monday/Wednesday/Friday grid
  cells are grey (assert the theme/tint fills);
- empty grid cells retain the template's medium row borders and dark interior
  verticals (not `c6c6c6` thin grey);
- static merged ranges and static cell styles/values match (except the intended
  title and `Version 1` changes);
- class cells copy the template's theme-based subject styles (not app subject
  tokens or approximated RGB);
- blocks copy the template's blocked/event styles;
- time labels are `center`/`center`/wrap; day and room headers `center`/`center`;
  class and block alignment match their template exemplars;
- no export step runs autofit or rewrites column widths globally;
- no placement/room/session behaviour changes (existing Unit 93 placement tests
  still pass).

### Manual acceptance

Open the generated workbook and the template side by side and confirm: columns
and rows are the same size; Tuesday/Thursday read white against grey
Monday/Wednesday/Friday; borders have the same bold, continuous weight; class
and block colours and text positions match; static areas (Mass/Lunch, FORMAL
HALL, notes, key, version) are unchanged; and placements remain correct.

## Scope and boundaries

- Backend-only (`backend/`): the template asset, `build_template.py`, possibly
  small `timetable_excel_export.py` adjustments, and the parity tests. No
  frontend, solver, schema, migration, or new-package changes.
- Do not change the download UI, the API route, the day/room/slot mapping,
  tutorial lettering, block rectangle merging, lecturer-key generation, or the
  in-memory / no-persistence guarantee.

## Docs to update

- `architecture-context.md` invariant 32 and `code-standards.md`
  (Data and Storage export rule) reference the canonical template path/filename
  and the styling-parity contract; update them to name the new source file
  (`assets/excel/Timetable S2 2025 DRAFT.xlsx`) and sheet (`S2, 2025 Timetable `),
  the preserved page-setup/tab-colour/zoom/row-height/default-column model, the
  per-day Tuesday/Thursday white empty-cell contrast, and the template-copied
  bold borders.
- Update `progress-tracker.md` when the unit lands.

## Dependencies

- Units 93–96 complete.
- The real pristine template exists at
  `backend/assets/excel/Timetable S2 2025 DRAFT.xlsx` with the
  `S2, 2025 Timetable ` sheet.

## Verification checklist

- Blank export template rebuilt from `S2, 2025 Timetable ` (not `worksheets[0]`,
  not the stripped file).
- Row heights match the template.
- Column widths match the template (default columns left unset; no autofit).
- Page setup, margins, tab colour, sheet zoom, and sheet-format props preserved.
- Tuesday and Thursday empty grid cells are white; Mon/Wed/Fri are grey.
- Borders match the template's bold, dark, continuous weight.
- Times, rooms/day headers, classes, and blocks each carry the correct
  per-category alignment.
- Class cells use template theme styles; blocks use template event styles.
- Static content unchanged except title and `Version 1`.
- Placements remain correct; backend tests pass.
- Manual visual comparison against the template passes.
