# Unit 96 Spec: Excel Export Styling Parity Fix

## Goal

Fix the timetable Excel export so the generated workbook visually matches the provided template exactly. The current export appears to place sessions in the correct timetable positions, but the workbook styling is not template-faithful: column widths, row heights, fills, fonts, borders, grid lines, static event styling, sheet settings, and some merged-region styling are visibly different.

This unit must not redesign the export layout. It must make the generated `.xlsx` reproduce the template layout and styling precisely while still populating the current saved timetable data.

## Design

- System boundary: primarily `backend/`, with frontend changes only if required to surface a clearer export error.
- Do not change timetable placement logic unless required to preserve the template's visual merge behavior.
- Do not recreate Excel styling from hardcoded guesses.
- The implementation must inspect the template workbook directly and copy or preserve its actual workbook/sheet/cell style definitions.
- The template is the visual source of truth. The generated workbook is wrong wherever it differs from the template outside intentionally dynamic class/block content.
- The generated file should still contain one populated timetable sheet only.
- The generated workbook must preserve the template's static layout, static rows, static text, print settings, row heights, column widths, merged-cell structure, fonts, borders, fills, alignments, and notes/lecturer-key area.
- Class/session placements may change cell values and dynamic merged regions, but their styling must be copied from the matching class styles in the template.
- Timetable blocks must use the matching blocked/static-event styles from the template, not the frontend block tokens.

## Current observed differences

The following differences were observed by comparing the current generated file `campion-timetable-2026-06-21.xlsx` with the uploaded template workbook's `S2, 2025 Timetable` sheet. These are examples, not an exhaustive list. The implementation AI must inspect and compare the files directly rather than relying only on this list.

### 1. Worksheet dimensions and structure

- Both files use an `A1:AP40` worksheet area, so the high-level sheet size is broadly correct.
- The generated workbook has 282 merged ranges, while the template sheet has 264. Some extra merges are expected for generated multi-slot classes/blocks, but static-layout merges must match the template exactly.
- The generated workbook appears to create new merged regions/styles during export rather than preserving the template's style structure and only modifying dynamic timetable areas.

### 2. Column widths are not template-faithful

The generated sheet explicitly writes custom widths and `bestFit` metadata across all 42 columns. The template only defines a small set of custom column widths and lets most room columns use the workbook default width.

Examples:

| Column |   Template width |     Generated width | Issue                                 |
| ------ | ---------------: | ------------------: | ------------------------------------- |
| A      |     `8.81640625` | `8.862142857142858` | Slight mismatch                       |
| B-F    | template default | `13.57642857142857` | Generated makes room columns too wide |
| G      |       `9.453125` |  `9.43357142857143` | Slight mismatch                       |
| O      |       `9.453125` |  `9.43357142857143` | Slight mismatch                       |
| AP     |     `8.81640625` | `8.862142857142858` | Slight mismatch                       |

Requirement: copy/preserve the template column model exactly. Do not run autofit and do not emit `bestFit`/custom-width columns for every column unless the template itself does so.

### 3. Row heights are substantially wrong

The generated workbook has incorrect row heights, especially in the timetable body.

Examples:

| Row   | Template height | Generated height | Issue                        |
| ----- | --------------: | ---------------: | ---------------------------- |
| 1     |          `13.5` |          `18.75` | Header spacing too tall      |
| 2     |          `28.5` |           `31.5` | Title row mismatch           |
| 4     |          `24.5` |          `18.75` | Day header too short         |
| 5     |            `33` |          `18.75` | Room header too short        |
| 6     |            `46` |         `25.125` | Timetable slot too short     |
| 7     |          `45.5` |         `25.125` | Second row of slot too short |
| 8     |          `45.5` |         `25.125` | Timetable slot too short     |
| 9     |            `46` |         `25.125` | Second row of slot too short |
| 27-33 |     `13.5` each |   mostly `18.75` | Notes/key area too tall      |

Requirement: every row height from the template must be preserved exactly unless a later explicit product decision changes the template. Each class timeslot visually occupies the template's two-row band; both rows must be filled/styled as one class block.

### 4. Sheet-level settings are not preserved

The generated worksheet is missing or changing important sheet properties:

- Template `sheetFormatPr` uses default row height `13` with spreadsheet dy-descent metadata; generated uses default row height `15`.
- Template has tab colour metadata; generated does not.
- Template has landscape page setup with scale `35`; generated has no `pageSetup`.
- Template has `fitToPage="1"`; generated has a blank/default page setup property.
- Template sheet view uses zoom scale `90`; generated has default view settings.

Requirement: worksheet-level settings, print/page setup, margins, tab colour, sheet view, freeze/selection metadata where relevant, and workbook-level presentation settings must be copied from the template.

### 5. Class cell colours are wrong

The generated export is using app/frontend subject colour styling rather than the Excel template's timetable class styles.

Examples:

- Generated `C6` uses a Literature-style app colour fill `#E4EFE8` with text colour `#244D39`.
- Template class cells use the template's own Excel fills/theme colours and generally black Trebuchet MS bold text.
- Generated History, Literature, Theology, Philosophy, Latin, Greek, and Science class cells do not match the existing subject/category styling in the template.

Requirement: class styles must be copied from the Excel template's own class examples or a template-derived style source. Do not use `ui-context.md` subject tokens, frontend timetable card colours, CSS colours, or manually approximated RGB values for the Excel export.

### 6. Fonts and font colours differ

Some generated cells are visually close but not style-identical. For exact Excel output, the implementation must copy actual font objects from the template.

Examples:

- Template class cells generally use Trebuchet MS, 10pt, bold, black/theme text.
- Generated class cells sometimes use subject-coloured text.
- Lecturer key cells in the generated workbook use explicit colour values and extra style records; template key cells use theme/tint colour styling.
- Static cells such as title, notes, headers, and key rows must preserve template fonts, not recreated equivalents.

Requirement: font name, size, bold/italic/underline, colour, family, theme/tint usage, and alignment must match the template styles.

### 7. Borders and grid lines differ

The generated workbook uses newly created border definitions, often with explicit RGB black/grey values. The template uses its own border definitions, including Excel automatic/indexed colours and specific medium/thin combinations.

Examples:

- Generated room/header/class cells have border definitions that are not style-identical to the template.
- Generated `K29` version cell has borders; the template version cell has no border.
- Static timetable grid lines and dynamic class borders are not being preserved consistently.

Requirement: borders must be copied from the template cells or template style source. Do not construct new approximate borders in code.

### 8. Static event styling is wrong or vulnerable

Static/event cells such as `SCHOLA`, `FORMAL HALL`, `Mass/Lunch`, later-time rows, and other non-class template content must retain template styling.

Observed example:

- Template `SCHOLA` is large maroon text on gold fill.
- Generated `Schola` is styled more like a small timetable block/class cell.

Requirement: static events that remain from the template should not be overwritten or restyled. If an app timetable block intentionally writes into a static/event-style area, it must use the template's blocked/static-event style, not class-card styling.

### 9. Notes, lecturer key, and version area differ

The generated notes/key area is not perfectly template-faithful.

Examples:

- Template rows 27-33 are height `13.5`; generated rows are mostly `18.75`.
- Lecturer key cells have different style objects.
- The version block should read `Version 1`, but retain the template's version cell styling exactly.

Requirement: the lecturer/tutor key may be generated from exported lecturers, but it must use the exact template key styles and row layout.

## Required implementation approach

The implementation AI must perform a template-driven style audit and fix. It must not treat the current generated file as close enough.

### Template source of truth

Use the uploaded/template-derived `S2, 2025 Timetable` sheet as the canonical visual contract.

The implementation must ensure that the backend asset used for export is a blanked copy of the real template sheet, not a workbook rebuilt from scratch.

The blank export template must preserve:

- all column widths;
- all row heights;
- default row height / sheet format properties;
- worksheet view settings;
- print/page setup;
- margins;
- tab colour where present;
- merged cells for static layout;
- static text and static rows;
- all fills, fonts, borders, alignments, protection flags, and number formats;
- notes and lecturer-key layout;
- later static timeslots and static event areas.

### Dynamic class writing

When writing session placements:

- Only change the intended dynamic class cells/ranges.
- Apply styles by copying from template class-style exemplars, not by constructing new style objects manually.
- Maintain the template's two-row-per-slot visual band.
- For a one-slot class, the full two-row band for that slot must be filled/styled as a single visual block.
- For a multi-slot class, the full multi-slot rectangle must be filled/styled across all included rows.
- The visible value should remain in the correct top-left cell of the merged/display range.
- The class text format remains `UNITCODE SessionType (Initials)`, with tutorials labelled `Tutorial A`, `Tutorial B`, etc. by timetable order.

### Dynamic block writing

When writing timetable blocks:

- Named blocks should display the block name.
- Unnamed blocks should remain blank but visually blocked.
- Block styling must come from the template's blocked/static-event styling.
- Rectangular block groups should merge as one visual rectangle where possible.
- Block/export styling must not use frontend block tokens.

### Static content protection

The export process must not restyle or clear static content unless explicitly required.

Static content includes, but is not limited to:

- day headers;
- room headers;
- time labels;
- `Mass/Lunch`;
- later static timeslot area;
- `FORMAL HALL`;
- note rows;
- lecturer/tutor key heading and layout;
- version cell/style.

If the export pipeline currently clears broad ranges and then rebuilds styles, that approach should be replaced with a narrower operation that clears only old class content and preserves the template's formatting.

## Verification requirements

The implementation must include tests/checks that prove style parity, not just placement correctness.

### Structural parity checks

Add backend verification that compares the exported workbook against the canonical template for all static/non-dynamic regions.

At minimum, verify:

- one exported sheet with the expected sheet name;
- worksheet dimension remains `A1:AP40`;
- column definitions match the template;
- row heights for rows 1-40 match the template;
- sheet format properties match the template;
- page setup and margins match the template;
- static merged ranges match the template;
- static cells retain the same styles;
- static cells retain the same values except intended title/version changes;
- no export step runs autofit or changes column widths globally.

### Style parity checks

For representative cells, compare full style objects against the template or template-derived style source:

- title row;
- day headers;
- room headers;
- time labels;
- each subject/category class style;
- lunch row;
- static event cells such as `SCHOLA` / `FORMAL HALL` if present;
- notes row;
- lecturer/tutor key heading;
- lecturer key body cells;
- version cell.

The checks should compare actual style components, not just visible values:

- font name/size/bold/italic/underline/colour;
- fill pattern and colour/theme/tint;
- border sides/styles/colours;
- horizontal and vertical alignment;
- wrap text;
- number format;
- protection flags where relevant.

### Render/manual verification

Automated checks are required, but the unit is not complete until the implementation AI also opens or renders the generated workbook and visually compares it with the template.

Manual acceptance must confirm:

- columns are the same width as the template;
- rows are the same height as the template;
- class blocks have the same visual weight and colours as the template;
- grid lines and borders match;
- fonts match;
- static event areas still look like the template;
- notes/key/version area matches;
- placements remain correct after styling fixes.

## Tests

Add/update backend tests for:

- exported workbook preserves template column widths;
- exported workbook preserves template row heights;
- exported workbook preserves sheet page setup and sheet format properties;
- exported workbook preserves static cell styles;
- generated class cells copy template class styles, not app subject tokens;
- generated blocks copy template blocked/event styles;
- note/key/version area styles match the template;
- multi-slot sessions fill/style every row in the two-row-per-slot visual bands;
- no unknown room/session placement changes are introduced by the styling fix.

Frontend tests are only needed if the export error/download UI changes.

## Dependencies

- Units 93-95 complete.
- Existing Excel export template asset exists in the backend workspace.
- Current generated placement logic is assumed mostly correct and should be preserved unless a styling/merge defect is found.

## Verification checklist

- Generated export uses the blanked real template workbook as its base.
- Generated export does not rebuild workbook styling from scratch.
- Column widths match the template.
- Row heights match the template.
- Fonts match the template.
- Colours/fills match the template.
- Borders/grid lines match the template.
- Static content remains static and styled exactly as the template.
- Session class cells use template-derived class styles.
- Blocks use template-derived block/static-event styles.
- One-slot classes fill the full two-row slot band.
- Multi-slot classes fill the full multi-slot visual range.
- Notes, lecturer key, and version area match the template styling.
- Exported timetable placements remain correct.
- Backend tests pass.
- Frontend tests/build pass if touched.
- Manual visual comparison against the template passes.
