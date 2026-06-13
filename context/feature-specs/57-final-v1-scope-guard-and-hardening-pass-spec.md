# Unit 57 Spec: Final V1 Scope Guard and Hardening Pass

## Goal

Run a final scope, architecture, UX, and safety pass to confirm the app matches the intended v1 product without accidental v2 complexity. The result should be a hardened v1 release candidate.

## Design

- Keep this unit as full-app verification and small corrective hardening only.
- Do not introduce new product features unless required to fix a v1 defect.
- Confirm the new scheduling architecture is preserved: frontend-owned draft scheduling/validation, explicit save, backend defensive save checks, backend solver constraint mirror.
- Confirm v1 excludes soft constraints, imports/exports, multi-admin collaboration, version history, student views, and lecturer views.
- Prioritize correctness, clarity, recoverability, and scope control.

## Implementation

### Scope

This unit should include a final pass over:

- app navigation;
- auth and protected routes;
- CRUD pages;
- timetable grid layout;
- unscheduled pool;
- frontend draft assignment state;
- manual scheduling;
- drag/drop scheduling;
- blocking validation;
- warning validation;
- automatic unscheduling after blocking data changes;
- explicit save behavior;
- backend defensive assignment save checks;
- solver gating;
- async solver flow;
- partial solver results;
- error handling;
- observability;
- deployment configuration;
- docs/progress tracker.

### Scope Guard Checklist

Confirm the app has not introduced:

- blob storage;
- Redis/caching infrastructure;
- soft constraints;
- student-facing views;
- lecturer-facing views;
- multi-admin collaboration;
- multi-tenant organizations;
- timetable version history;
- user-defined constraint rules;
- automatic student allocation;
- file imports/exports.

### Hardening Corrections

Small corrections are allowed when they fix implemented v1 behavior, such as:

- unclear disabled solver message;
- missing save failure message;
- inconsistent empty state;
- accidental hardcoded color;
- stale progress-tracker status;
- missing deployment env documentation.

Do not use this unit as a dumping ground for new features.

### Out of Scope

Do not add v2 features, soft constraints, import/export, version history, role-based student/lecturer views, multi-admin collaboration, or new infrastructure not already approved for v1.

## Dependencies

This unit depends on Units 1–56.

## Verification Checklist

- [ ] Frontend-owned validation architecture is preserved.
- [ ] Blocked placements are rejected immediately.
- [ ] Warning placements remain visible and block solver.
- [ ] Any validation issue blocks solver execution.
- [ ] Timetable edits persist only through explicit save.
- [ ] Backend defensive checks do not become normal UX validation.
- [ ] Solver uses backend constraint mirror for solver logic.
- [ ] No accidental v2 features are present.
- [ ] No blob storage, Redis, soft constraints, version history, or role views were introduced.
- [ ] All destructive changes require confirmation where relevant.
- [ ] All styling uses tokens or Tailwind theme values.
- [ ] Progress tracker and docs match actual implementation state.
- [ ] V1 acceptance flow passes or defects are documented.
