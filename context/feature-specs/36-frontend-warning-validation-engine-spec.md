# Unit 36 Spec: Frontend Warning Validation Engine

## Goal

Add frontend validation for allowed-but-invalid placements. Warning placements remain scheduled and visible, but they block solver execution until resolved.

## Design

- Keep warning validation in frontend validation modules.
- Use the severity name `warning`.
- Warning issues do not reject placements.
- Warning-invalid assignments may be saved to the backend.
- Solver gating is based on the combined validation result.

## Implementation

### Scope

Build frontend warning validation helpers for the full draft timetable.

Warning rules include:

- lecturer overlap conflict;
- student overlap conflict;
- unit/session overlap conflict where applicable from existing unit and session data;
- lecturer availability conflict;
- other non-blocking conflicts already represented by v1 data.

### Issue Shape

Each warning issue should include:

- issue type;
- severity: `warning`;
- affected session ids;
- affected lecturer id when relevant;
- affected student ids when relevant;
- affected day and slot when relevant;
- human-readable message.

### Solver Gate

Expose a derived value such as `canRunSolver`, which is true only when there are no blocking or warning issues.

## Dependencies

Unit 35.

## Verification Checklist

- [ ] Lecturer overlap produces warning issue.
- [ ] Student overlap produces warning issue.
- [ ] Unit/session overlap produces warning issue where applicable.
- [ ] Lecturer unavailable slot produces warning issue.
- [ ] Warning placements remain scheduled.
- [ ] Warning placements may be saved.
- [ ] Solver gate is false whenever any issue exists.
