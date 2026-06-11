# Unit 31 Spec: Backend Saved Timetable Assignment Persistence and Protected Save API

## Goal

Add backend persistence for the latest saved timetable assignment state. The backend should allow the frontend to load saved assignments and explicitly save a complete assignment set, while defensively rejecting impossible persisted states without becoming the source of user-facing validation.

## Design

- Keep this unit inside `backend/`.
- Manual scheduling is frontend-draft-first. Do not design per-drop backend mutations.
- The backend stores the latest saved timetable state only.
- The backend may defensively reject impossible states, but normal UX validation belongs to the frontend.
- Warning-invalid assignments may be saved.
- Do not add a user-facing validation API.

## Implementation

### Scope

Build:

- timetable assignment SQLAlchemy model;
- assignment migration;
- assignment schemas;
- assignment service functions;
- protected API route to list saved assignments;
- protected API route to save/replace the full assignment set;
- optional protected API route to clear saved assignments if useful;
- defensive save checks for impossible persisted states.

### Assignment Shape

A saved assignment should include:

- assignment id;
- session id;
- day;
- start slot;
- room id;
- created/updated timestamps if consistent with existing backend models.

The response should include enough joined display data for the frontend scheduled-card model:

- session id;
- unit id;
- unit code;
- unit name;
- session type;
- duration;
- lecturer display name;
- student count;
- day;
- start slot;
- room id.

### Save Behavior

The save endpoint should replace the current saved assignment set with the submitted assignment set in one transaction.

The frontend is responsible for user-facing validation before save. The backend should still defensively reject impossible persisted states:

- room double-booking;
- room capacity too small;
- session crossing lunch;
- session running off the timetable;
- missing session, room, day, or start slot.

The backend must not reject these warning-level states:

- lecturer overlap conflict;
- student overlap conflict;
- unit/session overlap conflict;
- lecturer availability conflict.

### Room Deletion

If a room is deleted, saved assignments using that room should be removed/unscheduled by backend-controlled logic so orphaned assignments cannot remain.

### Out of Scope

Do not implement:

- frontend assignment API client;
- frontend draft state;
- drag-and-drop;
- user-facing validation endpoint;
- constraint warning calculation;
- solver behavior.

## Dependencies

No new backend package should be required.

## Verification Checklist

- [ ] Assignment model exists.
- [ ] Migration runs successfully.
- [ ] Protected list route returns saved assignments.
- [ ] Protected save route replaces the saved assignment set transactionally.
- [ ] Backend defensively rejects room double-booking.
- [ ] Backend defensively rejects insufficient room capacity.
- [ ] Backend defensively rejects lunch crossing.
- [ ] Backend defensively rejects off-timetable placement.
- [ ] Backend allows lecturer/student/unit/availability warning conflicts to be saved.
- [ ] No user-facing validation API has been added.
