# Unit 93 Spec: Backend Timetable Excel Export Template and API

## Goal

Add a protected backend Excel export endpoint that generates the current saved timetable as an `.xlsx` file using a fixed Campion timetable template. The exported workbook must preserve the uploaded template layout and styling exactly, changing only the timetable title, version text, lecturer key, saved classes, and saved timetable blocks.

## Design

- System boundary: `backend/`.
- Export from the **saved timetable state only**, not the frontend draft.
- Do not store generated exports in the database or blob storage.
- Keep a static blank export template in the repository.
- The static template should be derived from the uploaded `S2, 2025 Timetable` sheet, not the older `Timetable Template` sheet.
- Export a one-sheet workbook only.
- Preserve all template layout details:
  - sheet dimensions;
  - column widths;
  - row heights;
  - merged cells;
  - fonts;
  - fills;
  - borders;
  - alignment;
  - print/page settings where practical;
  - static timetable labels and later evening rows.
- Classes must match the class-cell styling from the template.
- Blocks must use the corresponding blocked/event styling from the template.
- Do not mutate assignment state during export.
- Do not introduce import/export blob storage.

## Implementation

### Dependency

Add backend Excel template editing support.

Recommended dependency:

- `openpyxl`

Use it because the export must copy and mutate an existing `.xlsx` template while preserving styles.

### Template file

Add a static template file, for example:

```text
backend/export_templates/campion_timetable_export_template.xlsx
```

Prepare it from the uploaded workbook as follows:

- take the `S2, 2025 Timetable` sheet as the source layout;
- remove the other sheets;
- clear existing class/event values from timetable grid cells that should be app-populated;
- preserve all styling in those cells;
- keep fixed/static template content:
  - day headers;
  - room headers;
  - time labels;
  - `Mass/Lunch` row;
  - later evening rows;
  - notes area;
  - lecturer/tutor key area layout;
- set version text to static `Version 1`.

Do not keep old semester classes such as old lectures/tutorials, `SCHOLA`, `Augustine Academy`, `The Compass Program`, or old `FORMAL HALL` values unless they are intended to be static forever. Those should instead come from current timetable blocks if required.

### Export route

Add a protected route:

```text
GET /timetable/export.xlsx?title={title}
```

Rules:

- requires authenticated admin;
- validates `title` as a non-empty trimmed string;
- streams an `.xlsx` response;
- response filename should use a safe slug of the title plus current date, for example:
  - `semester-2-2026-timetable-2026-06-20.xlsx`;
- if title is invalid, return a structured `422` error;
- if export generation fails because saved timetable data cannot map to the template, return a structured `422` or `409` error.

### Export service

Create a dedicated service module, for example:

```text
backend/services/timetable_excel_export.py
```

The service should:

1. Load the static workbook template.
2. Populate the title cell from the requested title.
3. Set static `Version 1` in the existing version area.
4. Load saved assignments and timetable blocks from canonical database data.
5. Validate all scheduled assignment room names exist in the fixed template room map.
6. Generate session labels.
7. Generate tutorial letters.
8. Write sessions and blocks into the mapped Excel cells.
9. Generate the lecturer/tutor key from lecturers used in exported sessions.
10. Return an in-memory workbook stream for the route.

### Fixed sheet mapping

Use explicit constants rather than trying to infer the template dynamically.

The modern template sheet range is `A1:AP33`.

Fixed room order per day:

```text
PDS, L1.05, Bromley, L1.08, Dawson, L1.10, L1.12, JTW
```

Days map left to right as:

```text
Monday, Tuesday, Wednesday, Thursday, Friday
```

Room columns are repeated in 8-column blocks per day:

```text
Monday:    B:I
Tuesday:   J:Q
Wednesday: R:Y
Thursday:  Z:AG
Friday:    AH:AO
```

Current app slots map to the main visible slot rows:

```text
s1  9:00-9:50    row 6 + row 7
s2  10:00-10:50  row 8 + row 9
s3  11:00-11:50  row 10 + row 11
s4  1:30-2:20    row 14 + row 15
s5  2:30-3:20    row 16 + row 17
s6  3:30-4:20    row 18 + row 19
s7  4:30-5:20    row 20 + row 21
```

Each app time slot fills a two-row visual band. For a one-slot session, populate/merge or fill both rows in that band so the visual class block fills the full time slot. For multi-slot sessions, merge/fill vertically across all included two-row bands.

Keep later evening rows static and out of the app slot mapping.

### Saved assignments

Export only saved scheduled assignments.

For each saved assignment:

- derive day/start slot/room from assignment;
- expand duration into occupied app slots;
- map those app slots to Excel two-row bands;
- write one visual class block spanning the whole range;
- preserve/copy the class-cell style from the template;
- do not export unscheduled sessions.

If a saved assignment uses a room name not present in the fixed room order, fail export with a structured error such as:

```text
export_room_not_in_template
```

Do not silently omit scheduled classes.

### Session labels

Use this format:

```text
UNITCODE SessionType (LecturerInitials)
```

Examples:

```text
HIS101 Lecture (SC)
THE202 Tutorial A (LH)
```

Rules:

- `Lecture` and `Tutorial` are title case.
- Lecturer initials are first-name initial + last-name initial, ignoring title.
- If initials duplicate, keep the same initials in cells for v1 and show both lecturers in the generated key.
- If lecturer name data is missing, use a clear fallback only if the data model allows it; otherwise fail export.

### Tutorial lettering

Generate tutorial letters export-only.

For each unit:

- include only scheduled tutorials that are actually exported;
- sort by:
  1. day order Monday-Friday;
  2. start slot order s1-s7;
  3. room order from the fixed template room list;
  4. stable session id as final tie-breaker;
- assign letters `A`, `B`, `C`, etc.;
- unscheduled tutorials do not consume letters;
- do not add a persistent tutorial-letter column in this unit.

### Timetable blocks

Export timetable blocks into the same grid.

Rules:

- named blocks export as their block name;
- unnamed blocks export as blank blocked cells;
- use the template blocked/event style rather than session-card style;
- group contiguous cells from the same block group into merged rectangles where possible, mirroring frontend rectangle merging;
- do not create fake sessions for blocks;
- if a block uses a room not present in the fixed template room list, fail export with a structured error.

`Mass/Lunch` remains static from the template even if no block exists.

### Lecturer/tutor key

Generate the lecturer/tutor key from exported session lecturers.

Rules:

- keep the existing lecturer/tutor key area layout;
- clear old names;
- write entries like:
  - `SC: Dr Steve Chavura`;
- use the lecturer title exactly as stored/displayed;
- include only lecturers used by exported saved sessions;
- sort key entries by initials, then full display name for deterministic output;
- preserve key-area styling.

### Error behavior

Structured errors should cover at least:

- missing/blank title;
- missing template file;
- room not present in template;
- assignment overlaps static blocked template content unexpectedly;
- invalid saved assignment slot/day shape;
- export generation failure.

Do not leak stack traces or filesystem paths.

### Tests

Add backend tests for:

- export endpoint requires auth;
- title is required;
- generated response has `.xlsx` content type/disposition;
- template loads and returns a valid workbook;
- one-slot session fills both visual rows;
- multi-slot session spans all expected visual rows;
- fixed room mapping by day/room/slot;
- unknown room fails export;
- lecture label format;
- tutorial letters generated by timetable order;
- unscheduled tutorials do not consume letters;
- lecturer initials and key generation;
- named block exports its name with block styling;
- unnamed block exports blank with block styling;
- block rectangle merging;
- no generated file is persisted to database/blob storage.

## Dependencies

- Units 84-88 complete.
- Student upload units may be independent.
- New backend package: `openpyxl`.

## Verification checklist

- Static template file is repo-owned.
- Export uses the modern `S2, 2025 Timetable` layout.
- Exported workbook contains one sheet only.
- Classes match the template class styling.
- Blocks match the template block/event styling.
- Fixed room/day/slot mapping is explicit and tested.
- Export fails clearly for rooms not in the template.
- Tutorial letters are deterministic and export-only.
- Lecturer key is generated from exported sessions.
- Export streams the workbook without storing generated files.
- Backend tests pass.
