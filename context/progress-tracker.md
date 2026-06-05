# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- Unit 1 complete — frontend foundation

## Current Goal

- Begin Unit 2 (to be defined in the next feature spec)

## Completed

- **Unit 1: Repository, Frontend Bootstrap, and UI Foundation**
  - Scaffolded `frontend/` with Vite + React + TypeScript
  - Installed TailwindCSS v4 with `@tailwindcss/vite` plugin
  - Configured `vite.config.ts` with Tailwind plugin and `@` path alias
  - Configured `tsconfig.app.json` with strict mode and `@/*` path alias
  - Wrote `src/index.css` with all v1 design tokens from `ui-context.md`:
    - page backgrounds, surface colors, text colors
    - accent colors (maroon primary, gold secondary)
    - border colors, focus ring, state colors
    - timetable grid tokens, unit card tokens, solver accent tokens
  - Loaded Inter, Cormorant Garamond, and JetBrains Mono via Google Fonts
  - Initialized shadcn/ui (`base-nova` style, Tailwind v4, CSS variables)
  - Added shadcn/ui base components: Button, Input, Card, Table, Dialog, Alert, Badge, Select, Form, Label
  - Installed `@base-ui/react` (required by `base-nova` style components)
  - Removed default Vite demo UI; `App.tsx` renders only the styled foundation screen
  - Foundation page shows: app title (serif), description, status badges, feature checklist card
  - No mock data, no routing, no auth, no backend code
  - Root `README.md` with project description and frontend run instructions
  - Root `.gitignore`
  - `frontend/.env.example`
  - `docs/` placeholder

## In Progress

- None.

## Next Up

- Unit 2 (feature spec not yet written): likely React Router setup and app shell navigation

## Open Questions

- None from Unit 1.

## Architecture Decisions

- **shadcn/ui `base-nova` style with Tailwind v4**: shadcn 4.10.0 uses `base-nova` as the
  default style for new Vite projects with Tailwind v4. This style depends on `@base-ui/react`
  rather than `@radix-ui/react-*`. All future component additions should use `npx shadcn@latest add`.
- **`@tailwindcss/vite` plugin (Tailwind v4)**: No `tailwind.config.js` — configuration is
  CSS-based via `@theme` in `index.css`. Design tokens are CSS custom properties in `:root`
  and referenced via `var(--token-name)` in components per `ui-context.md`.
- **Path alias `@/*` → `src/*`**: Configured in both `vite.config.ts` and `tsconfig.app.json`.
  Root `tsconfig.json` also has paths for shadcn CLI compatibility.

## Session Notes

- shadcn 4.10.0 `init -d` fails at workspace config loading in monorepo layouts; workaround
  is to let it write `components.json` then add components individually via `npx shadcn@latest add`.
- The `form` component is not available via the `base-nova` registry; it was written manually
  using the standard shadcn form pattern with `react-hook-form` and `@radix-ui/react-label`.
