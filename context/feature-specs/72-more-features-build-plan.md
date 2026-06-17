# More Features Build Plan — Units 72–83

## Planning Rules

This batch extends the completed post-v1 adjustments with a mostly frontend-focused polish pass. The work is split so persisted contract changes, API type alignment, reusable parsing/styling utilities, timetable interaction changes, and final regression coverage remain separate.

Keep the existing product and architecture rules:

- frontend-owned user-facing timetable validation;
- timetable edits update a frontend draft first;
- backend assignment persistence happens only through explicit save;
- solver runs from saved backend state;
- no soft constraints, version history, imports/exports, student-facing views, lecturer-facing views, multi-admin collaboration, Redis, or object storage;
- styling must use `ui-context.md` tokens, not hardcoded colours;
- protected `components/ui/*` primitives must not be modified directly.

## Resolved Product Decisions

- Unit code structural format is exactly six characters: three letters followed by three numbers.
- Unit code uniqueness remains enforced.
- Unit code input should trim and uppercase for validation/submission.
- The subject/year parser is frontend-only for UI display, filtering, and subject colour selection.
- A valid parsed unit code must satisfy both:
  - structural format: `AAA999`;
  - parser criteria: first three letters are a supported subject prefix and the first digit/year is `1`, `2`, or `3`.
- Invalid unit codes disable unit create/save and show an invalid-unit warning.
- Subject prefixes and colours:
  - `HIS` — History — Orange;
  - `PHI` — Philosophy — Blue;
  - `THE` — Theology — Pink;
  - `LIT` — Literature — Dark Green;
  - `LAN` — Latin — Light Orange;
  - `GRE` — Greek — Light Green;
  - `SCI` — Science — Dark Blue.
- Subject colours require new CSS tokens that harmonise with the existing academic palette.
- Student titles are removed completely, including backend model/schema/UI references.
- Lecturer titles are restricted to:
  - `Mr`, `Ms`, `Mrs`, `Dr`, `Fr`, `A/Prof.`, `Prof.`.
- Existing lecturer title migration mappings:
  - `Dr.` → `Dr`;
  - `Mr.` → `Mr`;
  - `Prof.` → `Prof.`;
  - `Ms.` → `Ms`;
  - `A/Prof.` → `A/Prof.`.
- Unscheduled unit boxes have a consistent fixed width while height may grow with their session list.
- Unscheduled search matches unit code/name and unit teaching team lecturer names only; it does not search session type.
- The timetable action/notification/details UI is one sticky bar; it must not shift the page when messages or details open.
- Validation messages should display human time labels, not slot IDs such as `s4`.
- Drag preview should match timetable scheduled-card shape using live grid width, row height, and session duration.
- The drag preview should be centred width-wise on the pointer and vertically aligned around the first slot.
- Hover highlighting should cover every grid cell the session would occupy.
- If a session cannot be placed in a hovered cell, no grid cells highlight; no reason is shown until after the drop is attempted.
- Draft timetable state should persist in browser storage with a schema version and should clear after successful save.
- Restored drafts should still be cleaned up by existing blocking validation/automatic-unschedule rules.
- The `/timetable` page removes all page headers/descriptions between the navbar and sticky timetable action bar.
- The lunch row uses new lunch/mass colour tokens and displays `Lunch/Mass`.
- Navbar brand text becomes `Campion - Timetable`, using the title font as an intentional exception to the nav typography rule.
- The unit modal uses a two-column layout: unit identity/teaching team/students on one side, sessions on the other.
- The unit student selector gets a clear-all button next to the select-year-students action.
- Lecturer/student unit filters include subject filters derived from the frontend parser; lecturer unit filters also include year filters.

---

## 72. Backend Title and Unit Code Contract Cleanup

**System boundary:** `backend/`

**What it builds:**

- Remove student title from backend model, schema, service, and migrations.
- Restrict lecturer titles to the new allowed set.
- Migrate existing lecturer title enum/data values.
- Defensively validate unit code format as three letters followed by three numbers.
- Preserve unit code uniqueness.
- No backend subject parser or subject-colour logic.

**Visible result:**

Backend API contracts match the new title and unit-code requirements.

**Dependencies required first:**

Units 58–71.

---

## 73. Frontend API Types and UI Token Alignment

**System boundary:** `frontend/` + docs/style tokens

**What it builds:**

- Frontend DTO updates for student title removal and lecturer title values.
- Subject colour CSS tokens in `ui-context.md` and global CSS.
- Shared frontend unit-code parser utility.
- Slot label utility for validation display.
- No page-level UI redesign yet.

**Visible result:**

The frontend compiles against the new backend title contracts and has reusable subject/parser styling foundations.

**Dependencies required first:**

Unit 72.

---

## 74. Frontend Unit Code Parser, Subject Colours, and Unit Validation UX

**System boundary:** `frontend/`

**What it builds:**

- Unit-code parser display below unit-code fields.
- Unit create/save disabled when unit code is invalid.
- Invalid unit warning message.
- Subject-based unit colour assignment.
- Unit cards/scheduled cards/unscheduled cards use subject colour instead of generic hash colour.

**Visible result:**

Unit colour and unit validity are derived from unit code consistently in the UI.

**Dependencies required first:**

Unit 73.

---

## 75. Frontend Management Title Cleanup and Unit Filters

**System boundary:** `frontend/`

**What it builds:**

- Remove student title fields from `/students` forms and tables.
- Update lecturer title selectors to the new values.
- Add subject/year unit filters where requested.
- Keep filters frontend-only.

**Visible result:**

Students no longer have titles, lecturers use the new title list, and unit-related filters understand subject/year.

**Dependencies required first:**

Units 73 and 74.

---

## 76. Frontend Unscheduled Pool Sizing and Search Refinement

**System boundary:** `frontend/`

**What it builds:**

- Fixed-width unscheduled unit boxes with flexible wrapping across the page.
- Unit boxes retain equal width; height may grow.
- Search limited to unit code/name and teaching team lecturer names.
- Type/session-kind search removed.
- Existing scheduling/drag functionality preserved.

**Visible result:**

The unscheduled pool is cleaner, more uniform, and searches only the intended fields.

**Dependencies required first:**

Units 74 and 75.

---

## 77. Frontend Sticky Timetable Action Bar and Validation Message Consolidation

**System boundary:** `frontend/`

**What it builds:**

- Single sticky timetable action/notification bar.
- No separate text boxes that push page layout.
- Details panel opens as an overlay/dropdown above the timetable.
- Validation messages use human time labels, not slot IDs.
- All blocking/warning/save/solver messaging remains inside the bar.

**Visible result:**

Timetable feedback is stable, compact, and does not move the page.

**Dependencies required first:**

Unit 73.

---

## 78. Frontend Drag Preview and Hover Highlighting Upgrade

**System boundary:** `frontend/`

**What it builds:**

- Drag overlay shape matches the scheduled timetable card.
- Drag preview dimensions use live grid cell width and row height.
- Drag preview aligns correctly to pointer.
- Hover highlighting covers every cell the dragged session would occupy.
- Invalid hover targets show no highlight and no pre-drop reason.

**Visible result:**

Dragging visually matches final placement and invalid placement targets are quietly non-highlighted.

**Dependencies required first:**

Units 76 and 77.

---

## 79. Frontend Local Timetable Draft Persistence

**System boundary:** `frontend/`

**What it builds:**

- Browser-storage persistence for unsaved timetable draft.
- Schema versioning for stored draft data.
- Draft restore when returning to `/timetable` or refreshing.
- Clear stored draft after successful save.
- Automatic cleanup of restored drafts through existing validation/unschedule logic.

**Visible result:**

Unsaved timetable work is not lost when leaving the timetable page or refreshing the browser.

**Dependencies required first:**

Units 77 and 78.

---

## 80. Frontend Timetable Save, Clear, and Empty-Draft Bug Fixes

**System boundary:** `frontend/`

**What it builds:**

- Investigate and fix empty-timetable save behavior.
- Save button labels cleanly show `Save Timetable`, `Saving…`, and `Saved`.
- Clear-all remains draft-only and works with local draft persistence.
- Successful empty save persists an empty assignment set.

**Visible result:**

Saving an empty timetable works reliably and the save state is unambiguous.

**Dependencies required first:**

Unit 79.

---

## 81. Frontend Timetable Visual Styling and Navbar Polish

**System boundary:** `frontend/`

**What it builds:**

- Darker timetable borders using tokens.
- New `Lunch/Mass` lunch row styling with red background and gold text tokens.
- Remove timetable page headers/descriptions between navbar and display bar.
- Navbar brand text becomes `Campion - Timetable` with title font, existing brand colour, and bold weight.
- Solver button remains blue and says `Generate Timetable`.

**Visible result:**

The timetable workspace looks cleaner and more Campion-specific without changing scheduling behavior.

**Dependencies required first:**

Units 77 and 80.

---

## 82. Frontend Unit Modal Layout Polish

**System boundary:** `frontend/`

**What it builds:**

- Two-column unit modal layout.
- Unit code/name/teaching team/students on one side.
- Sessions on the other side.
- Fresh unit creation shows a no-sessions message in the sessions column.
- Student selector adds clear-all beside the select-year-students action.

**Visible result:**

The unit modal is easier to scan and supports the richer post-v1 unit model without crowding.

**Dependencies required first:**

Units 74 and 75.

---

## 83. More Features Regression, Docs, and Acceptance Pass

**System boundary:** full app verification

**What it builds:**

- Backend tests for title/unit-code contract changes.
- Frontend tests for parser, filters, sticky bar, draft persistence, drag-preview behavior where practical, save-empty behavior, and modal layout outcomes.
- Context docs/progress tracker updates.
- Manual acceptance checklist for the new polish batch.

**Visible result:**

The new UI and contract changes are verified without regressing v1/post-v1 scheduling behavior.

**Dependencies required first:**

Units 72–82.
