# Unit 73 Spec: Frontend API Types and UI Token Alignment

## Goal

Align frontend API types with the updated backend title/unit-code contracts and add reusable foundations for subject parsing, subject colours, and human slot-label display. This unit prepares shared utilities and tokens only; it should not redesign route-level pages yet.

## Design

- Keep implementation inside `frontend/`, plus required updates to `ui-context.md` and global CSS token definitions.
- Do not modify backend code in this unit.
- Do not redesign the timetable, unit modal, or management pages yet.
- Keep the subject parser frontend-only.
- Subject colours must be CSS tokens, not repeated hardcoded values in components.
- The parser should be pure and deterministic so it can power:
  - unit-code field feedback;
  - subject colour selection;
  - subject filters;
  - year filters where derived from unit codes.
- Slot-label conversion should be centralized so validation and details display never show raw slot IDs to users.

## Implementation

### Frontend API type updates

Update frontend API clients and DTOs:

- Remove `title` from student DTO/input types:
  - `Student`
  - `StudentCreate`
  - `StudentUpdate`
  - any test fixtures.
- Update lecturer title union to exactly:
  - `Mr`
  - `Ms`
  - `Mrs`
  - `Dr`
  - `Fr`
  - `A/Prof.`
  - `Prof.`
- Update any helper display functions that previously assumed old dotted title values.
- Ensure the frontend compiles before route UI is changed.

### Subject colour tokens

Update `ui-context.md` and global CSS variables with a new subject colour section.

Use restrained academic colours that harmonise with the existing warm palette. Suggested token names:

| Subject    | Prefix | Background token          | Border token                  | Text token                  |
| ---------- | ------ | ------------------------- | ----------------------------- | --------------------------- |
| History    | `HIS`  | `--subject-history-bg`    | `--subject-history-border`    | `--subject-history-text`    |
| Philosophy | `PHI`  | `--subject-philosophy-bg` | `--subject-philosophy-border` | `--subject-philosophy-text` |
| Theology   | `THE`  | `--subject-theology-bg`   | `--subject-theology-border`   | `--subject-theology-text`   |
| Literature | `LIT`  | `--subject-literature-bg` | `--subject-literature-border` | `--subject-literature-text` |
| Latin      | `LAN`  | `--subject-latin-bg`      | `--subject-latin-border`      | `--subject-latin-text`      |
| Greek      | `GRE`  | `--subject-greek-bg`      | `--subject-greek-border`      | `--subject-greek-text`      |
| Science    | `SCI`  | `--subject-science-bg`    | `--subject-science-border`    | `--subject-science-text`    |

Recommended values:

| Token                         | Value     |
| ----------------------------- | --------- |
| `--subject-history-bg`        | `#F7E5D4` |
| `--subject-history-border`    | `#B86B2B` |
| `--subject-history-text`      | `#6B3515` |
| `--subject-philosophy-bg`     | `#E7EEF7` |
| `--subject-philosophy-border` | `#2F5F8F` |
| `--subject-philosophy-text`   | `#234766` |
| `--subject-theology-bg`       | `#F6E7EF` |
| `--subject-theology-border`   | `#A5527D` |
| `--subject-theology-text`     | `#67304C` |
| `--subject-literature-bg`     | `#E4EFE8` |
| `--subject-literature-border` | `#2F6B4F` |
| `--subject-literature-text`   | `#244D39` |
| `--subject-latin-bg`          | `#FAECD8` |
| `--subject-latin-border`      | `#D1903D` |
| `--subject-latin-text`        | `#7A4B16` |
| `--subject-greek-bg`          | `#EAF3DF` |
| `--subject-greek-border`      | `#7BA84A` |
| `--subject-greek-text`        | `#4F6D2E` |
| `--subject-science-bg`        | `#DFE9F2` |
| `--subject-science-border`    | `#244D73` |
| `--subject-science-text`      | `#1E3A56` |

These are allowed because they are declared once as design tokens, not hardcoded repeatedly across components.

### Frontend unit-code parser utility

Create a shared parser module, for example:

- `frontend/src/lib/unit-code-parser.ts`

It should export:

- supported subject metadata;
- `parseUnitCode(code: string)`;
- `isValidUnitCode(code: string)`;
- helpers for subject/year filter options.

Parser rules:

- Trim whitespace.
- Uppercase the code.
- Structural validity requires `^[A-Z]{3}\d{3}$`.
- Subject prefix is the first three characters.
- Year is the first digit in the normalized string.
- Year is valid only when it is `1`, `2`, or `3`.
- Subject is valid only when prefix is one of:
  - `HIS`
  - `PHI`
  - `THE`
  - `LIT`
  - `LAN`
  - `GRE`
  - `SCI`
- A fully valid unit code requires structural validity, known subject, and valid year.
- Return structured error reasons rather than just a boolean.

Suggested return shape:

```ts
type UnitCodeParseResult =
  | {
      valid: true;
      normalizedCode: string;
      prefix: SubjectPrefix;
      subjectName: string;
      colourName: string;
      yearLevel: 1 | 2 | 3;
      tokens: {
        background: string;
        border: string;
        text: string;
      };
    }
  | {
      valid: false;
      normalizedCode: string;
      reasons: UnitCodeInvalidReason[];
      partial?: {
        prefix?: string;
        yearLevel?: number;
      };
    };
```

### Slot label utility

Create or update a frontend slot display helper:

- Input: slot ID such as `s4`.
- Output: display range such as `1:30-2:20`.
- Use the existing timetable slot definitions as the source of truth.
- Include helpers for validation messages that mention affected slots.
- Do not duplicate hardcoded slot labels in validation modules.

### Tests

Add focused frontend tests for:

- unit-code parser valid cases;
- structural invalid cases;
- unknown subject prefix;
- invalid year digit;
- lower-case normalization;
- subject metadata/token mapping;
- slot ID to label conversion.

## Dependencies

No new dependencies expected.

## Verification checklist

- Student frontend types no longer include title.
- Lecturer title union matches backend contract.
- Subject colour tokens exist in `ui-context.md` and global CSS.
- Parser is frontend-only and reusable.
- Parser accepts only valid `AAA999` known-subject year-1-to-3 codes.
- Parser returns enough metadata for display and filters.
- Slot label helper maps raw IDs to human ranges.
- No route UI behavior is changed in this unit.
- Frontend tests and build pass.
