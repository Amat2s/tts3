# Unit 50 Spec: Frontend Error Handling and Observability

## Goal

Standardize frontend loading, mutation error, timetable action error, save error, and solver error handling. Add frontend crash capture and a safe fallback UI without changing the frontend-owned validation model.

## Design

- Keep this unit inside `frontend/`.
- Use Sentry for unexpected frontend exceptions.
- Add an app-level error boundary.
- Standardize user-facing error states across management pages and the timetable workspace.
- Keep validation errors distinct from system errors: blocking/warning validation results are product state, not crashes.
- Keep the UI calm and token-driven according to `ui-context.md`.
- Do not add new scheduling, validation, assignment, or solver product behavior.

## Implementation

### Scope

This unit should include:

- frontend Sentry setup with environment variables;
- app-level error boundary;
- fallback screen for unexpected frontend crashes;
- shared helper/component patterns for API/mutation errors;
- timetable-specific error displays for:
  - failed assignment load;
  - failed save;
  - failed solver start;
  - failed solver status polling;
  - failed solver completion refresh;
- consistent loading and disabled states for save and solver actions;
- clear distinction between validation warnings and API/system errors.

### Error Boundary

The error boundary should wrap protected app routes or the full app shell.

The fallback UI should:

- explain that something unexpected happened;
- avoid technical stack traces;
- provide a simple refresh/reload action;
- preserve the app's visual language.

### Timetable Errors

Timetable errors should be actionable. For example:

- assignment load failure should say saved timetable data could not be loaded;
- save failure should say the current draft was not saved;
- solver start failure should say the solver could not be started;
- solver polling failure should say solver status could not be refreshed.

Validation states should remain separate:

- blocking validation stops a placement before it enters the draft;
- warning validation remains visible and blocks solver;
- neither should be displayed as an unexpected crash.

### Out of Scope

Do not implement backend observability, new validation rules, new assignment API behavior, new solver API behavior, new drag/drop behavior, or styling outside established tokens.

## Dependencies

This unit depends on Unit 48. Add only frontend Sentry/error-boundary dependencies if required.

## Verification Checklist

- [ ] Frontend Sentry is configured from environment variables.
- [ ] Frontend app still runs when Sentry DSN is absent.
- [ ] An app-level error boundary exists.
- [ ] Unexpected crashes show a safe fallback screen without stack traces.
- [ ] Timetable assignment-load errors are visible and actionable.
- [ ] Timetable save errors are visible and actionable.
- [ ] Solver start/status errors are visible and actionable.
- [ ] Validation warnings are not treated as crashes.
- [ ] Blocking validation feedback remains product feedback, not system error feedback.
- [ ] All new UI uses tokens/Tailwind theme values and no hardcoded hex values.
- [ ] Frontend build succeeds.
