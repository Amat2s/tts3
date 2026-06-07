# Unit 6 Spec: Frontend Authenticated API Base Client

## Goal

Create the frontend API client foundation for authenticated backend requests. The result should allow the signed-in frontend to call a protected backend test endpoint with the current Supabase access token attached.

## Design

- Keep this unit focused on the frontend/backend auth connection.
- Reuse the existing Supabase auth state from Unit 5.
- Treat the backend as the authority for protected access.
- Centralize request, token attachment, `401` handling, and error parsing so future feature API clients can build on this foundation.
- Do not add product-specific API clients yet.

## Implementation

### Scope

Build the shared frontend API client foundation only.

This unit should include:

- backend base URL environment variable;
- shared request helper;
- Supabase access token attachment;
- base API error parsing;
- base `401` handling;
- a small authenticated backend verification call;
- a minimal visible or developer-verifiable test surface proving the connection works.

### Environment Configuration

Add a browser-safe frontend environment variable for the backend API base URL, such as:

- `VITE_API_BASE_URL`

Update `frontend/.env.example` accordingly.

Do not expose backend secrets, Supabase service keys, database credentials, or Trigger.dev secrets to the frontend.

### API Client Foundation

Create a shared API helper in the frontend, likely under `src/lib/api/`.

The helper should:

- read the backend base URL from the Vite environment;
- get the current Supabase session or access token;
- attach `Authorization: Bearer <token>` when a token exists;
- send JSON requests and parse JSON responses;
- handle empty responses safely;
- normalize backend errors into a frontend-friendly API error type;
- handle `401` responses consistently for future callers.

Keep this helper generic. Do not bake room, lecturer, student, unit, session, assignment, constraint, or solver concepts into it.

### Authenticated Verification Call

Add a small API function that calls the backend protected auth verification route from Unit 4.

This can be exposed through a temporary developer-only UI check, route-level effect, or simple callable helper, as long as the result is verifiable without adding product data behavior.

The goal is only to prove:

- the frontend can send the Supabase access token;
- the backend accepts authenticated requests;
- the frontend receives and parses the protected response;
- unauthenticated or expired sessions fail cleanly.

### Out of Scope

Do not implement:

- TanStack Query;
- room API client;
- lecturer API client;
- student API client;
- unit API client;
- session API client;
- assignment API client;
- constraint API client;
- solver API client;
- CRUD behavior;
- management page data wiring;
- timetable grid data wiring;
- global caching;
- retry policies beyond basic request failure handling;
- mock domain data.

## Dependencies

No new package should be required if Supabase Auth is already installed.

Do not install TanStack Query yet. It should be introduced when a real server-state integration needs it.

## Verification Checklist

- [ ] `VITE_API_BASE_URL` is documented in `frontend/.env.example`.
- [ ] A shared frontend API request helper exists.
- [ ] Authenticated requests attach the current Supabase access token.
- [ ] Backend API errors are parsed into a consistent frontend error shape.
- [ ] `401` responses are handled consistently.
- [ ] A protected backend verification call succeeds for a signed-in user.
- [ ] The same call fails cleanly when unauthenticated or when the token is invalid.
- [ ] No product-specific API clients have been added.
- [ ] No TanStack Query, Zustand, dnd-kit, CRUD behavior, or timetable data wiring has been added.
- [ ] No mock room, lecturer, student, unit, session, assignment, constraint, or solver data is present.
- [ ] The frontend build command succeeds.
