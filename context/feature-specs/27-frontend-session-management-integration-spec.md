# Unit 27 Spec: Frontend Session Management Integration

## Goal

Connect the inline session section inside the `/units` page to real backend session data. The result should let an authenticated admin add, edit, and delete sessions inside each unit without using separate session dialogs.

## Design

- Keep this unit in the frontend/backend connection boundary.
- Use the Unit 21 inline session UI structure.
- Use the Unit 26 session API client.
- Sessions must remain visually and behaviorally scoped inside units.
- Do not create standalone session pages, standalone session dialogs, or global session management screens.
- Use TanStack Query for server-owned session state.
- Keep local component state only for form interaction, dialog state, and temporary editing state.
- Do not store server-owned session data in Zustand.
- Do not connect sessions to the timetable unscheduled pool yet.
- Do not add assignment, drag-and-drop, constraint, or solver behavior.

## Implementation

### Scope

Wire inline session boxes on `/units` to real backend session persistence.

This unit should include:

- fetching sessions for units shown on the `/units` page;
- rendering real inline session boxes inside each unit;
- add-session behavior connected to backend creation;
- session type updates connected to backend persistence;
- duration updates connected to backend persistence;
- delete-session behavior connected to backend deletion;
- loading states for session lists and mutations;
- error states for failed session actions;
- query invalidation after successful session mutations;
- schedulable-session status display if already returned by backend and useful in the unit page.

### Data Loading

For each rendered unit, fetch its sessions using the session API client.

Use TanStack Query with clear query keys such as:

- `['units']` for unit records;
- `['unit-sessions', unitId]` for sessions under a specific unit.

Do not combine all session state into one ambiguous local object if TanStack Query can keep it resource-scoped.

If the number of units makes per-unit queries awkward, a consolidated backend/session list may be used only if the backend already supports it. Do not invent new backend endpoints in this unit unless Unit 25 explicitly added them.

### Inline Session Rendering

Each real session should render as an inline session box inside its parent unit.

Each session box should show editable controls for:

- session type;
- duration.

The session box should also show:

- delete action;
- mutation loading state where relevant;
- inline or nearby error state if an update/delete fails.

Do not open separate create/edit dialogs for sessions.

### Add Session Behavior

The existing add-session button should create a real backend session under the selected unit.

Use a safe default session payload, such as:

- `session_type: "lecture"`;
- `duration: 1`.

After successful creation:

- refresh the relevant unit session list;
- keep the user in the same unit context;
- show the new inline session box.

If creation fails:

- keep the current UI stable;
- show a clear error message near the session section.

Do not add optimistic creation unless rollback behavior is explicit and reliable.

### Update Session Behavior

Changing session type or duration should persist through the backend session update API.

Required behavior:

- update only the selected session;
- show disabled/loading treatment while that session update is running;
- refresh the relevant unit session list after successful update;
- show an actionable error if the update fails.

Duration options should stay within the backend-supported range:

- 1 slot;
- 2 slots;
- 3 slots;
- 4 slots.

Session type options should match the backend-supported enum:

- Lecture;
- Tutorial;
- Lab;
- Workshop.

### Delete Session Behavior

The delete button on each inline session box should delete that real session through the backend.

Required behavior:

- require a lightweight confirmation if the existing UI pattern supports destructive confirmation for nested records;
- otherwise make the delete action visually clear and reversible only if rollback is implemented;
- show mutation loading state;
- refresh the relevant unit session list after successful deletion;
- show an actionable error if deletion fails.

Because assignment persistence does not exist yet, no timetable cleanup is required in this unit.

### Unit Page Integration

This unit may update the `/units` page integration from Unit 24 only where needed to display and manage real sessions.

The `/units` page should continue to support:

- real unit list;
- real unit create/edit/delete;
- lecturer selector;
- student selector.

Do not modify lecturer or student management routes.

### Schedulable Status

If the backend returns schedulable-session information or if the session response includes enough context to infer it safely, the unit page may show a small status label.

A session should be considered schedulable when:

- it belongs to a unit;
- the unit has a lecturer;
- it has a valid session type;
- it has a valid duration.

Students are optional and should not make a session incomplete.

Do not build the timetable unscheduled pool in this unit. That belongs to the next timetable phase.

### Error and Loading States

Add clear states for:

- loading sessions under a unit;
- session creation in progress;
- session update in progress;
- session deletion in progress;
- session list fetch failure;
- mutation failure.

Errors should be visible and specific enough for the admin to act on.

Do not silently discard failed updates.

### Out of Scope

Do not implement:

- backend session routes;
- session API client functions;
- standalone session dialogs;
- standalone session management page;
- timetable unscheduled pool;
- schedulable sessions displayed under the timetable;
- assignment persistence;
- manual scheduling;
- drag-and-drop scheduling;
- constraint validation;
- solver behavior;
- optimistic updates unless rollback is explicit and reliable;
- Zustand session storage;
- mock sessions.

## Dependencies

No new package should be required if TanStack Query is already installed.

This unit depends on:

- Unit 24 frontend unit page integration;
- Unit 25 backend session persistence and protected API;
- Unit 26 frontend session API client.

## Verification Checklist

- [ ] `/units` displays real sessions inside their parent units.
- [ ] Session boxes are inline inside unit UI, not separate dialogs.
- [ ] Each unit fetches its real sessions from the backend.
- [ ] Add session creates a real backend session under the correct unit.
- [ ] Session type changes persist to the backend.
- [ ] Duration changes persist to the backend.
- [ ] Delete session removes the real backend session.
- [ ] Session mutations refresh the relevant unit session list.
- [ ] Session loading states are visible.
- [ ] Session mutation loading states are visible.
- [ ] Session errors are visible and actionable.
- [ ] Duration options are limited to 1–4 slots.
- [ ] Session type options match the backend enum.
- [ ] Students remain optional and do not block schedulability.
- [ ] Server-owned session data is not stored in Zustand or localStorage.
- [ ] No timetable unscheduled pool has been added.
- [ ] No assignment, drag/drop, constraint, or solver behavior has been added.
- [ ] No mock sessions are present.
- [ ] The frontend build command succeeds.
