# Unit 39 Spec: Backend Constraint Validation API

## Goal

Expose backend hard constraint validation through a protected API endpoint. The result should let authenticated frontend code request the current timetable's authoritative constraint violations.

## Design

- Keep this unit inside `backend/`.
- Use the constraint evaluation service from Unit 38.
- Backend validation is the authority for hard constraint state.
- Do not mutate timetable data during validation.
- Do not treat unscheduled sessions as violations.
- Do not add solver behavior in this unit.
- Do not add frontend behavior in this unit.

## Implementation

Add a protected validation endpoint, such as:

- `GET /constraints/validate`
- or `GET /timetable/validate`

The endpoint should:

- require authenticated admin access;
- load the current persisted timetable state;
- run the Unit 38 constraint evaluation service;
- return a predictable response containing all violations.

The response should include:

- `violations`;
- optional summary counts if useful;
- enough affected ids for the frontend to highlight invalid sessions and explain the issue.

Use the structured violation shape from the constraints module.

Do not return ORM models directly.

## Dependencies

No new package should be required.

This unit depends on:

- Unit 37 constraint definitions and conflict graph;
- Unit 38 constraint evaluation service;
- existing backend auth and API error helpers.

## Verification Checklist

- [ ] Protected validation endpoint exists.
- [ ] Endpoint requires authentication.
- [ ] Endpoint loads current persisted timetable state.
- [ ] Endpoint returns structured violations.
- [ ] Endpoint returns an empty violation list for valid states.
- [ ] Unscheduled sessions are not reported as violations.
- [ ] Validation does not mutate timetable state.
- [ ] API responses do not return ORM models directly.
- [ ] No frontend, solver, or job behavior is added.
