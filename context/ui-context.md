# UI Context

## Theme

Simple, comfortable university administration interface. The design language is light, calm, academic, and structured. It should feel like an internal timetable management tool for a small liberal arts college: professional, warm, readable, and orderly. Use warm off-white backgrounds, white surfaces, restrained maroon branding, and muted gold accents. The app should feel more like a refined university dashboard than a generic startup SaaS product.

Use **light mode only for v1**. No dark mode in v1.

## Colors

All components must use these tokens. Do not hardcode hex values directly in components.

| Role                       | CSS Variable               | Value     |
| -------------------------- | -------------------------- | --------- |
| Page background            | `--bg-base`                | `#FBFAF7` |
| Subtle page background     | `--bg-muted`               | `#F6F1EA` |
| Surface                    | `--bg-surface`             | `#FFFFFF` |
| Surface elevated           | `--bg-elevated`            | `#FFFDF9` |
| Surface warm               | `--bg-warm`                | `#F8F2E8` |
| Primary text               | `--text-primary`           | `#251F1F` |
| Secondary text             | `--text-secondary`         | `#5F5552` |
| Muted text                 | `--text-muted`             | `#8A7E78` |
| Inverse text               | `--text-inverse`           | `#FFFFFF` |
| Primary accent             | `--accent-primary`         | `#7A1F2B` |
| Primary accent hover       | `--accent-primary-hover`   | `#651923` |
| Primary accent soft        | `--accent-primary-soft`    | `#F5E9EB` |
| Secondary accent           | `--accent-secondary`       | `#C9A646` |
| Secondary accent hover     | `--accent-secondary-hover` | `#B28F35` |
| Secondary accent soft      | `--accent-secondary-soft`  | `#F7F0D8` |
| Border default             | `--border-default`         | `#E5DED2` |
| Border strong              | `--border-strong`          | `#CFC4B4` |
| Border subtle              | `--border-subtle`          | `#EEE7DC` |
| Focus ring                 | `--focus-ring`             | `#7A1F2B` |
| State error                | `--state-error`            | `#B4232A` |
| State error background     | `--state-error-bg`         | `#FCE8EA` |
| State warning              | `--state-warning`          | `#B7791F` |
| State warning background   | `--state-warning-bg`       | `#FFF4D6` |
| State success              | `--state-success`          | `#2E7D4F` |
| State success background   | `--state-success-bg`       | `#E6F2EC` |
| State info                 | `--state-info`             | `#2F5F8F` |
| State info background      | `--state-info-bg`          | `#E7EEF7` |
| Disabled background        | `--disabled-bg`            | `#E9E2D8` |
| Disabled text              | `--disabled-text`          | `#9A8F88` |
| Timetable grid line        | `--grid-line`              | `#D3C9B8` |
| Timetable grid strong line | `--grid-line-strong`       | `#A99A80` |
| Timetable grid border emphasis | `--grid-border-emphasis` | `#8A7B61` |
| Timetable lunch background | `--grid-lunch-bg`          | `#F6F1EA` |
| Timetable lunch/mass background | `--grid-lunch-mass-bg`    | `#7A1F2B` |
| Timetable lunch/mass text  | `--grid-lunch-mass-text`   | `#F7F0D8` |
| Timetable lunch/mass border | `--grid-lunch-mass-border` | `#C9A646` |
| Timetable hover cell       | `--grid-cell-hover`        | `#F7F0D8` |
| Timetable invalid cell     | `--grid-cell-invalid`      | `#FCE8EA` |

Timetable grid borders use the stronger grid-line/`--grid-border-emphasis` tokens for
a darker, clearer grid while preserving the light academic theme. The lunch row is a
`Lunch/Mass` divider styled with the dedicated lunch/mass tokens (do not reuse error
colours for it).

## Unit / Session Card Colors

Unit-based timetable cards take their colour from the unit's subject (see **Subject
Colors** below), derived from the unit-code prefix by the frontend parser. The muted
academic palette below is retained as a deterministic fallback for invalid or legacy
unit codes that do not parse to a supported subject (the stone variant is the default
fallback).

| Role                   | CSS Variable           | Value     |
| ---------------------- | ---------------------- | --------- |
| Unit maroon background | `--unit-maroon-bg`     | `#F5E9EB` |
| Unit maroon border     | `--unit-maroon-border` | `#7A1F2B` |
| Unit gold background   | `--unit-gold-bg`       | `#F7F0D8` |
| Unit gold border       | `--unit-gold-border`   | `#C9A646` |
| Unit blue background   | `--unit-blue-bg`       | `#E7EEF7` |
| Unit blue border       | `--unit-blue-border`   | `#2F5F8F` |
| Unit green background  | `--unit-green-bg`      | `#E6F2EC` |
| Unit green border      | `--unit-green-border`  | `#2E7D4F` |
| Unit purple background | `--unit-purple-bg`     | `#EFEAF7` |
| Unit purple border     | `--unit-purple-border` | `#7256A0` |
| Unit stone background  | `--unit-stone-bg`      | `#EFEAE4` |
| Unit stone border      | `--unit-stone-border`  | `#8A7E78` |

## Subject Colors

Subject colors are derived from the unit-code subject prefix by the frontend
unit-code parser (`frontend/src/lib/unit-code-parser.ts`). They are declared once
as design tokens; components must reference these tokens and never inline the hex
values. The hues are restrained academic colors chosen to harmonise with the warm
palette above.

| Subject    | Prefix | Background token          | Border token                  | Text token                  |
| ---------- | ------ | ------------------------- | ----------------------------- | --------------------------- |
| History    | `HIS`  | `--subject-history-bg`    | `--subject-history-border`    | `--subject-history-text`    |
| Philosophy | `PHI`  | `--subject-philosophy-bg` | `--subject-philosophy-border` | `--subject-philosophy-text` |
| Theology   | `THE`  | `--subject-theology-bg`   | `--subject-theology-border`   | `--subject-theology-text`   |
| Literature | `LIT`  | `--subject-literature-bg` | `--subject-literature-border` | `--subject-literature-text` |
| Latin      | `LAN`  | `--subject-latin-bg`      | `--subject-latin-border`      | `--subject-latin-text`      |
| Greek      | `GRE`  | `--subject-greek-bg`      | `--subject-greek-border`      | `--subject-greek-text`      |
| Science    | `SCI`  | `--subject-science-bg`    | `--subject-science-border`    | `--subject-science-text`    |

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

## Timetable Block Colors

Timetable blocks reserve room-specific `day + slot + room` cells and must read as
distinct from scheduled session cards. Block colour tokens are **separate from the
subject tokens** above and must not be reused for sessions. Unnamed blocks use the
grey/disabled `--block-empty-*` set; named blocks use one of three allowed colours
(`gold`, `light_blue`, `light_pink`). Components must reference these tokens and never
inline the hex values.

| Role                 | CSS Variable          | Value     |
| -------------------- | --------------------- | --------- |
| Block empty bg       | `--block-empty-bg`    | `#E9E2D8` |
| Block empty border   | `--block-empty-border`| `#CFC4B4` |
| Block empty text     | `--block-empty-text`  | `#8A7E78` |
| Block gold bg        | `--block-gold-bg`     | `#F7F0D8` |
| Block gold border    | `--block-gold-border` | `#C9A646` |
| Block gold text      | `--block-gold-text`   | `#7A4B16` |
| Block blue bg        | `--block-blue-bg`     | `#E7EEF7` |
| Block blue border    | `--block-blue-border` | `#2F5F8F` |
| Block blue text      | `--block-blue-text`   | `#234766` |
| Block pink bg        | `--block-pink-bg`     | `#F6E7EF` |
| Block pink border    | `--block-pink-border` | `#A5527D` |
| Block pink text      | `--block-pink-text`   | `#67304C` |

Rendering rules:

- Unnamed blocks render grey/disabled with no label, using the `--block-empty-*` tokens.
- Named blocks render the block name and selected colour (`gold` → `--block-gold-*`,
  `light_blue` → `--block-blue-*`, `light_pink` → `--block-pink-*` sets). No lock icon.
- Block cells have no left-border accent; this is the visual distinction from session cards
  (which always carry a coloured left border).
- Fall back to the grey `--block-empty-*` set if a colour is missing or unknown.
- **Rectangle merging**: contiguous cells of the same block group that form a rectangular
  region (consecutive room columns × consecutive slot rows) are merged into a single card.
  The top-left cell is the anchor; it renders the card with `width = N_rooms × cell width`
  and `height = N_slots × 3.5rem`. All other cells in the rectangle render no card visually
  but remain functionally blocked. Non-rectangular or gapped block groups produce multiple
  independent rectangles, each with its own anchor.
- Block cells live in the timetable grid, never in the unscheduled pool, and must stay
  visually distinct from session cards. During block-selection mode, selected cells use
  temporary token-based styling.

## AI / Solver Accent Variants

Use these only for solver-related UI, not general branding. The solver should feel helpful and technical, but not futuristic or flashy.

| Role                      | CSS Variable            | Value     |
| ------------------------- | ----------------------- | --------- |
| Solver accent             | `--solver-accent`       | `#2F5F8F` |
| Solver accent hover       | `--solver-accent-hover` | `#264D73` |
| Solver accent soft        | `--solver-accent-soft`  | `#E7EEF7` |
| Solver running background | `--solver-running-bg`   | `#EEF4FA` |
| Solver partial background | `--solver-partial-bg`   | `#FFF4D6` |
| Solver success background | `--solver-success-bg`   | `#E6F2EC` |
| Solver failure background | `--solver-failure-bg`   | `#FCE8EA` |

## Typography

| Role         | Font               | Variable       |
| ------------ | ------------------ | -------------- |
| UI text      | Inter              | `--font-sans`  |
| Heading text | Cormorant Garamond | `--font-serif` |
| Code/mono    | JetBrains Mono     | `--font-mono`  |

Typography rules:

| Context          | Font                            | Rule                                     |
| ---------------- | ------------------------------- | ---------------------------------------- |
| App navigation   | `--font-sans`                   | Use medium weight, compact sizing (the `Campion - Timetable` brand text is an intentional exception: title/serif font, bold, current brand colour) |
| Forms            | `--font-sans`                   | Prioritize readability and clarity       |
| Tables           | `--font-sans`                   | Use compact row text                     |
| Timetable grid   | `--font-sans`                   | Do not use serif fonts inside grid cells |
| Page titles      | `--font-serif`                  | Use sparingly for academic tone          |
| Section headings | `--font-sans` or `--font-serif` | Prefer sans for dense admin pages        |
| Time labels      | `--font-mono` or tabular sans   | Use consistent numeric alignment         |
| Code/debug text  | `--font-mono`                   | Only for technical IDs or logs           |

## Type Scale

| Role            | CSS Variable  | Value      |
| --------------- | ------------- | ---------- |
| Extra small     | `--text-xs`   | `0.75rem`  |
| Small           | `--text-sm`   | `0.875rem` |
| Base            | `--text-base` | `1rem`     |
| Large           | `--text-lg`   | `1.125rem` |
| Extra large     | `--text-xl`   | `1.25rem`  |
| Page title      | `--text-2xl`  | `1.5rem`   |
| Hero/title rare | `--text-3xl`  | `1.875rem` |

Usage:

| Context                 | Size                         |
| ----------------------- | ---------------------------- |
| Timetable card metadata | `--text-xs`                  |
| Timetable card title    | `--text-sm`                  |
| Table cells             | `--text-sm`                  |
| Form fields             | `--text-sm` or `--text-base` |
| Page descriptions       | `--text-sm`                  |
| Section headings        | `--text-lg`                  |
| Page headings           | `--text-xl` or `--text-2xl`  |

## Border Radius

| Context                 | Class          |
| ----------------------- | -------------- |
| Inline / small UI       | `rounded-sm`   |
| Buttons / inputs        | `rounded-md`   |
| Cards / panels          | `rounded-lg`   |
| Modals / overlays       | `rounded-xl`   |
| Badges                  | `rounded-full` |
| Timetable grid cells    | `rounded-none` |
| Timetable session cards | `rounded-md`   |

Radius rules:

| Rule                        | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| Keep radius modest          | The interface should feel formal and academic, not bubbly                |
| Use larger radius sparingly | Reserve `rounded-xl` for modals and elevated overlays                    |
| Keep grid geometry sharp    | Timetable cells should align precisely                                   |
| Cards may be softer         | Session cards and management panels can use `rounded-md` or `rounded-lg` |

## Component Library

Use **shadcn/ui on top of TailwindCSS**. Components live in `components/ui/`. Use the shadcn CLI to add new components rather than building common primitives from scratch.

| Component Type        | Library      |
| --------------------- | ------------ |
| Styling               | TailwindCSS  |
| UI components         | shadcn/ui    |
| Accessible primitives | Radix UI     |
| Drag and drop         | dnd-kit      |
| Icons                 | Lucide React |

Recommended shadcn/ui components:

| Use Case           | Component      |
| ------------------ | -------------- |
| Buttons            | `Button`       |
| Text fields        | `Input`        |
| Dropdown selection | `Select`       |
| Forms              | `Form`         |
| Tables             | `Table`        |
| Modal dialogs      | `Dialog`       |
| Side panels        | `Sheet`        |
| Warnings/errors    | `Alert`        |
| Labels/status      | `Badge`        |
| Hover explanations | `Tooltip`      |
| Menus              | `DropdownMenu` |
| Overflow areas     | `ScrollArea`   |
| Dividers           | `Separator`    |
| Tabs               | `Tabs`         |
| Cards/panels       | `Card`         |

## Layout Patterns

| Pattern              | Rule                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| App shell            | Top navbar, main content area, no permanent sidebar in v1              |
| Navbar               | Horizontal top bar with warm surface background and bottom border; left-corner `Campion - Timetable` brand in title font, centered nav links |
| Page header          | Title, short description, primary action on the right (the `/timetable` page omits this header between the navbar and the sticky action bar) |
| Management pages     | Table-first layout with create/edit via modal or side sheet            |
| Timetable page       | Sticky action bar first, main grid below, unscheduled session pool underneath |
| Timetable action bar | One sticky bar holding save state, solver button/state, blocking/warning messages, and validation details; it has a stable min-height and must not shift the page when messages change |
| Timetable grid       | Monday–Friday columns, rooms nested under each day, time slots as rows |
| Lunch divider        | Red/gold `Lunch/Mass` divider between AM and PM slots, using the lunch/mass tokens |
| Unscheduled pool     | Group sessions by unit in fixed-width boxes that wrap across the page (height may grow); use compact draggable cards |
| Constraint details   | Open as an anchored overlay/dropdown from the sticky action bar; do not insert a panel that pushes the timetable down |
| Modals               | Centered overlay with conservative shadow; the unit modal uses a two-column layout (identity/teaching team/students on one side, sessions on the other) that stacks on narrow screens |
| Side sheets          | Right-side sheet for editing entity details                            |
| Delete confirmation  | Always require confirmation for destructive actions                    |
| Empty states         | Centered text with one clear action where appropriate                  |

## Icons

Use **Lucide React**.

| Context              | Size          |
| -------------------- | ------------- |
| Inline metadata icon | `h-3.5 w-3.5` |
| Standard inline icon | `h-4 w-4`     |
| Button icon          | `h-4 w-4`     |
| Section/action icon  | `h-5 w-5`     |
| Empty state icon     | `h-8 w-8`     |

Icon rules:

| Rule                             | Description                                    |
| -------------------------------- | ---------------------------------------------- |
| Stroke icons only                | Use Lucide outline icons, not filled icon sets |
| Keep icons secondary             | Icons support labels; they do not replace them |
| Use warning icons for violations | Do not rely on red color alone                 |
| Use consistent sizing            | Avoid arbitrary icon sizes                     |
| Avoid decorative icon clutter    | Admin UI should stay calm and readable         |

## Interaction States

| State                  | Visual Treatment                                    |
| ---------------------- | --------------------------------------------------- |
| Hover                  | Slight warm background or border emphasis           |
| Focus                  | Visible maroon focus ring using `--focus-ring`      |
| Selected               | Maroon border or subtle maroon background           |
| Dragging               | Drag preview matches the scheduled-card shape using live grid cell width, row height, and session duration; centred width-wise on the pointer and aligned around the first slot |
| Drop target            | Muted gold highlight covering every grid cell the session would occupy; if the session cannot be placed in the hovered cell, no cells highlight and no reason is shown until after the drop is attempted |
| Invalid placement      | Danger border, danger background, warning icon      |
| Disabled               | Muted background and muted text                     |
| Solver running         | Solver accent soft background and loading indicator |
| Solver blocked         | Warning or danger alert with explanation            |
| Solver partial success | Warning alert with scheduled/unscheduled counts     |
| Solver success         | Success alert or compact success badge              |

## Design Invariants

| #   | Invariant                                                                                  |
| --- | ------------------------------------------------------------------------------------------ |
| 1   | The timetable grid must remain readable at all times.                                      |
| 2   | Invalid states must be visible, specific, and actionable.                                  |
| 3   | The solver button must explain why it is disabled.                                         |
| 4   | Scheduled and unscheduled sessions must be visually distinct.                              |
| 5   | Maroon is the primary brand color; gold is an accent only.                                 |
| 6   | Tables and forms should prioritize clarity over decoration.                                |
| 7   | Use light mode only in v1.                                                                 |
| 8   | Do not rely on color alone for status or constraint violations.                            |
| 9   | The UI should feel academic and institutional, not playful.                                |
| 10  | All styling should use tokens or Tailwind theme values, not repeated hardcoded hex values. |
| 11  | Timetable blocks must be visually distinct from scheduled session cards and empty cells; do not rely on colour alone — always show the lock icon (and the name for named blocks). |
