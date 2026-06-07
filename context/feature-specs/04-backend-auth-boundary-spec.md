# Unit 4 Spec: Backend Supabase Auth Boundary

## Goal

Add the backend authentication boundary before any protected product functionality is built. The result should let the backend verify Supabase-authenticated requests and reject unauthenticated access through a protected test route or backend test.

## Design

- Keep this unit inside `backend/auth/` and the backend API boundary.
- Treat backend authentication as authoritative. Frontend route protection later is only a user-experience layer.
- Add only the auth foundation needed for future protected routes.
- Do not create real product CRUD endpoints in this unit.
- Auth errors should use the base error response shape created in Unit 3.

## Implementation

### Scope

Build backend Supabase authentication support only.

This unit should include:

- Supabase JWT verification;
- current admin dependency;
- reusable protected-route dependency;
- standard unauthenticated/invalid-token error behavior;
- a minimal protected test endpoint or backend test proving the dependency works.

### Auth Boundary

Create backend helpers that future routes can reuse to require an authenticated admin.

The backend should not trust user IDs or ownership fields from the client. Future protected routes should get authenticated user context from this dependency instead.

### Protected Test Surface

Add the smallest useful protected surface to verify behavior. This may be a test-only route, a development-safe endpoint, or an automated backend test.

The visible result should prove:

- requests without a valid token are rejected;
- requests with a valid token can pass the auth boundary.

### Out of Scope

Do not implement:

- frontend login;
- frontend protected routes;
- authenticated frontend API client;
- room, lecturer, student, unit, session, or assignment APIs;
- role-based access control;
- multi-tenant workspaces;
- student or lecturer roles;
- database ownership rules beyond what is necessary for the auth dependency.

## Dependencies

Install only what is needed to verify Supabase JWTs on the backend, such as:

- a JWT verification library;
- cryptography support if required by the chosen JWT library;
- HTTP client support if needed for Supabase JWKS discovery.

Do not install frontend Supabase packages in this unit.

## Verification Checklist

- [ ] Backend auth helpers exist in the backend auth boundary.
- [ ] A current-admin/current-user dependency exists for future protected routes.
- [ ] Invalid or missing tokens are rejected.
- [ ] Auth failures use the standard backend error shape.
- [ ] A protected test endpoint or backend test proves the auth boundary works.
- [ ] No product CRUD routes have been added.
- [ ] No frontend auth code has been added.
- [ ] No role-based, multi-tenant, student-facing, or lecturer-facing access model has been added.
