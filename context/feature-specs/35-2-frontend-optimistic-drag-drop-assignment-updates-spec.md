# Unit 35/2 Spec: Frontend Optimistic Drag-and-Drop Assignment Updates

## Goal

Make drag-and-drop scheduling feel instant by applying optimistic TanStack Query cache updates for assignment mutations. The result should update the timetable UI immediately on drop, then confirm or roll back based on the backend response.

## Design

- Keep this unit inside `frontend/`.
- Treat this as a performance and UX refinement to Unit 35.
- Use TanStack Query optimistic updates for drag-and-drop assignment mutations.
- Update cached assignment and schedulable-session data immediately in `onMutate`.
- Roll back to previous cache snapshots in `onError`.
- Use server response data to finalize cache state on success.
- Avoid full refetch flicker where the successful response contains enough data to update the cache directly.
- Keep backend assignment persistence as the source of truth.
- Do not add new backend routes, constraint validation, solver behavior, or mock data.

## Implementation

Update drag-and-drop assignment mutations for:

- scheduling an unscheduled session;
- moving a scheduled session.

For schedule drops:

- cancel in-flight assignment and schedulable-session queries;
- snapshot previous `['assignments']` and `['schedulable-sessions']` cache data;
- immediately add an optimistic assignment to `['assignments']`;
- immediately remove the scheduled session from `['schedulable-sessions']`;
- roll back both caches if the mutation fails;
- replace or reconcile the optimistic assignment with the backend response on success.

For move drops:

- cancel in-flight assignment queries;
- snapshot previous `['assignments']`;
- immediately update the moved assignment location in cache;
- roll back if the mutation fails;
- write the backend response into cache on success.

Use temporary optimistic ids only if needed, and make sure they cannot leak into persisted state or later API calls.

Keep user-facing errors visible when rollback happens.

Do not use separate local shadow assignment state unless TanStack Query cache updates are not practical.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 33 manual scheduling integration;
- Unit 35 drag-and-drop persistence integration.

## Verification Checklist

- [ ] Dropping an unscheduled session updates the UI immediately.
- [ ] Drag-moving a scheduled session updates the UI immediately.
- [ ] Scheduling rollback restores the previous assignments and schedulable sessions if the backend rejects the mutation.
- [ ] Move rollback restores the previous assignment placement if the backend rejects the mutation.
- [ ] Successful schedule mutations reconcile cache data with the backend response.
- [ ] Successful move mutations reconcile cache data with the backend response.
- [ ] The UI does not flicker from unnecessary full refetches after successful drops.
- [ ] Backend persistence remains the source of truth.
- [ ] No mock assignment or session data is added.
- [ ] No backend, constraint, solver, or drag shell behavior is changed.
- [ ] Manual scheduling still works.
- [ ] The frontend build command succeeds.
