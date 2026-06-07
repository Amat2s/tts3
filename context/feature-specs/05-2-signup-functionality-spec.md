# Unit 05/2 Spec: Signup Functionality

## Goal

Add functional signup behavior to the existing frontend signup page so a new admin can create an account through Supabase Auth. The page UI already exists; this unit only wires the form behavior, validation, auth call, and post-signup flow.

## Design

Use the existing signup page layout and components without redesigning the screen. The signup page should feel like part of the same authentication flow as login, using the existing theme, form styling, loading state patterns, and error messaging.

The signup flow is still for the v1 admin-only system. Do not introduce roles, organization selection, invitations, multi-tenant workspace setup, or student/lecturer signup paths.

## Implementation

### Scope

Implement the frontend signup behavior for the existing signup page.

This includes:

- reading signup form values
- validating required fields before submission
- calling Supabase Auth signup
- showing loading state while the request is in progress
- showing clear user-facing errors when signup fails
- showing a successful next step after signup
- linking between login and signup pages if not already present

### Files / Areas

Likely frontend areas:

- existing signup route/page
- frontend Supabase auth client
- auth-related hooks or helpers
- route definitions if the signup route is not already registered

Do not modify backend auth enforcement in this unit unless a frontend signup flow cannot work without a minor config-alignment change.

### Behavior

The signup page should allow a new admin to create an account using email and password.

Required behavior:

- Email is required.
- Password is required.
- Password confirmation is required if the existing UI includes it.
- Password and confirmation must match when confirmation exists.
- Submission is disabled while signup is in progress.
- Supabase signup errors are shown in a friendly, non-technical way.
- On successful signup, the user should receive clear feedback about the next step.

Post-signup behavior should follow the Supabase project configuration:

- If email confirmation is enabled, show a message telling the user to check their email.
- If email confirmation is not enabled and a session is returned, redirect the user into the protected app, preferably `/timetable`.

### Out of Scope

Do not add:

- role-based signup
- organization or workspace creation
- invite-only access
- student or lecturer accounts
- backend user profile tables
- custom email templates
- password reset
- social login
- multi-admin collaboration

## Dependencies

No new package should be installed if Supabase Auth is already available from the previous auth units.

If the Supabase frontend client has not yet been installed, install only the official Supabase JavaScript client required to make the signup call.

## Verification Checklist

- [ ] The existing signup page submits to Supabase Auth.
- [ ] Required fields are validated before the auth request is sent.
- [ ] Password confirmation is enforced if the field exists.
- [ ] Loading state appears during submission.
- [ ] Signup failures show clear user-facing errors.
- [ ] Successful signup shows the correct next step based on Supabase email-confirmation behavior.
- [ ] The login page links to signup, and signup links back to login.
- [ ] No roles, organizations, multi-tenant behavior, or student/lecturer account paths were added.
