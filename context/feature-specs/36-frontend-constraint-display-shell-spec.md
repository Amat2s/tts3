# Unit 36 Spec: Frontend Constraint Display Shell

## Goal

Add the frontend UI shell for displaying timetable constraint violations. The result should prepare the timetable page to show validation status, blocked solver messaging, invalid card styling, and violation details without connecting to real backend validation yet.

## Design

- Keep this unit inside `frontend/`.
- Build display surfaces only.
- Do not add backend constraint API calls yet.
- Do not create fake violations.
- Do not block scheduling behavior yet.
- Do not implement solver UI beyond reserved blocked/validation messaging surfaces.
- Use `ui-context.md` status tokens and accessible warning treatment.
- Do not rely on color alone for invalid or warning states.

## Implementation

Add timetable validation display components for:

- compact validation status in the timetable action bar;
- violation alert area;
- invalid scheduled session card styling;
- violation details panel, popover, or expandable section;
- solver-blocked message area reserved for later solver units.

Create frontend violation display types if useful, but keep them aligned with the future backend shape:

- violation type;
- severity;
- affected session ids;
- affected room id where relevant;
- affected lecturer id where relevant;
- affected student ids where relevant;
- human-readable message.

Render empty/neutral states only until real validation data exists.

Do not introduce mock violation records in production UI.

## Dependencies

No new package should be required unless an existing shadcn/ui display component needs to be added.

Possible shadcn/ui additions:

- `Tooltip`;
- `Popover`;
- `Sheet`;
- `Separator`.

Only add one if it is directly used.

## Verification Checklist

- [ ] Timetable action bar has a validation status area.
- [ ] Violation alert/display component exists.
- [ ] Scheduled session cards have prepared invalid styling support.
- [ ] Violation details surface exists.
- [ ] Solver-blocked message area exists as a shell.
- [ ] Empty/neutral state renders without fake violations.
- [ ] Styling uses project tokens.
- [ ] Status treatment does not rely on color alone.
- [ ] No backend validation API is called.
- [ ] No constraint logic is implemented.
- [ ] No solver behavior is added.
- [ ] The frontend build command succeeds.
