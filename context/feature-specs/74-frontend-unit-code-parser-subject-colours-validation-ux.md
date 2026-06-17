# Unit 74 Spec: Frontend Unit Code Parser, Subject Colours, and Unit Validation UX

## Goal

Apply the frontend unit-code parser to unit creation/editing and use parsed subject metadata to colour unit-related timetable cards. Unit create/save should be blocked when the code does not satisfy all parser criteria, and the UI should show concise parser feedback beneath the unit-code field.

## Design

- Keep this unit inside `frontend/`.
- Use the parser and tokens created in Unit 73.
- Do not add backend parser logic.
- Do not change the hidden scheduling allocation model or solver behavior.
- Unit colour selection should no longer use arbitrary hashing when a valid subject prefix is available.
- Parser output may be displayed below unit code as `[Class] [Colour] [Year level]`, e.g. `History · Orange · Year 1`.
- The UI should show an invalid-unit warning when the code fails structural, subject, or year criteria.
- Disable create/save when unit code is invalid.

## Implementation

### Unit form parser feedback

Update unit create/edit forms:

- Normalize display/submission to uppercase where practical.
- Run `parseUnitCode(code)` as the user types.
- If valid, show a compact success/info line under the unit-code field:
  - `History · Orange · Year 1`
  - `Philosophy · Blue · Year 2`
- If invalid, show a clear warning line under the field:
  - `Invalid unit code. Use three letters and three numbers, e.g. HIS101, with a supported subject prefix and year 1–3.`
- Do not expose internal parser implementation details in the UI.
- Disable create/save if the parse result is invalid.
- Keep backend save errors visible in case defensive backend validation still rejects.

### Unit form validity

Update form validity rules:

- Existing required fields still apply.
- Unit code must be parser-valid before submit.
- Unit name must still be required.
- Teaching team/session lecturer rules from the post-v1 model still apply.
- If unit code changes in edit mode and becomes invalid, the save button disables.

### Subject-based colours

Replace existing generic unit colour assignment with subject-based colour selection:

- For valid parsed unit codes, use subject colour tokens.
- For invalid/legacy unit codes that somehow exist from old data, use a safe fallback token such as stone.
- Apply subject colours consistently to:
  - unscheduled session cards;
  - scheduled timetable cards;
  - unit box accents;
  - unit labels/badges where a subject colour is already used.
- Do not display parser/subject internals on timetable cards beyond colour itself.

### Backward compatibility and fallback

The frontend may encounter saved records with invalid/legacy unit codes during transition. Handle them safely:

- Do not crash if parsing fails.
- Use fallback colour tokens.
- Show invalid code warning only in editable unit forms, not on every timetable card.

### Tests

Add/update frontend tests for:

- valid unit code enables create/save;
- invalid format disables create/save;
- unsupported subject prefix disables create/save;
- year outside 1–3 disables create/save;
- parser success line displays class, colour, and year;
- scheduled and unscheduled cards use subject token mappings;
- invalid saved code falls back without crashing.

## Dependencies

No new dependencies expected.

## Verification checklist

- Unit code parser runs in create and edit unit modals.
- Unit create/save is disabled unless the unit code satisfies all parser criteria.
- Invalid unit warning appears under the unit-code field.
- Valid parser display shows class, colour, and year level.
- Subject colour tokens drive timetable card colours.
- Generic hash-based unit colours are removed or retained only as a fallback.
- Invalid legacy codes do not crash the timetable.
- Frontend build and tests pass.
