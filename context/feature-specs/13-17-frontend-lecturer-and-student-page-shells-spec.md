# Units 13 and 17 Spec: Frontend Lecturer and Student Page Shells

## Goal

Create the frontend management page shells for lecturers and students. The result should make `/lecturers` and `/students` visually complete for their respective data types, while still displaying no real records until backend persistence exists.

## Design

- Keep this unit entirely inside `frontend/`.
- Build lecturer and student shells in the same implementation phase because they use similar table, dialog, form, empty-state, and delete-confirmation patterns.
- Keep the routes clearly separated:
  - lecturer UI belongs to `/lecturers` and lecturer feature files only;
  - student UI belongs to `/students` and student feature files only.
- Use the existing app shell, page header, empty-state component, theme tokens, and shadcn/ui components.
- Do not use mock lecturers, mock students, fake counts, fake availability data, or temporary application state as if it were real data.
- The pages should be ready for later API integration, but this unit should not fetch, create, update, or delete anything.

## Implementation

### Scope

Build the frontend-only shells for lecturer and student management.

This unit should include:

- `/lecturers` page structure;
- `/students` page structure;
- empty lecturer table shell;
- empty student table shell;
- lecturer empty state;
- student empty state;
- create/edit/delete dialog structures for lecturers;
- create/edit/delete dialog structures for students;
- lecturer form fields;
- student form fields;
- lecturer availability editor UI shell.

### Lecturer Page Shell

Update `/lecturers` so it has a complete management-page structure.

The lecturer page should include:

- page title and description specific to lecturers;
- primary action for adding a lecturer;
- empty table structure prepared for lecturer rows;
- empty state when no lecturer records exist;
- create lecturer dialog or sheet;
- edit lecturer dialog or sheet;
- delete confirmation dialog;
- fields for:
  - title;
  - first name;
  - last name.

Add the lecturer availability editor UI shell in this phase.

The availability editor should include:

- Monday-Friday structure;
- the same fixed time-slot structure used by the timetable;
- controls or selectable cells for marking available/unavailable slots;
- blank initial availability state;
- clear visual distinction between available and unavailable states.

The availability UI should not persist anything yet.

### Student Page Shell

Update `/students` so it has a complete management-page structure.

The student page should include:

- page title and description specific to students;
- primary action for adding a student;
- empty table structure prepared for student rows;
- empty state when no student records exist;
- create student dialog;
- edit student dialog;
- delete confirmation dialog;
- fields for:
  - title;
  - first name;
  - last name;
  - year level.

The student page should not contain lecturer availability controls.

### Shared UI Pattern

Lecturer and student shells may share reusable form/table/dialog primitives where that keeps the code clean.

Do not make the implementation so generic that route-specific behavior becomes unclear. Components and labels must still clearly distinguish lecturers from students.

### Out of Scope

Do not implement:

- backend lecturer persistence;
- backend student persistence;
- frontend API clients;
- TanStack Query integration;
- real create/edit/delete behavior;
- storing lecturer availability;
- assigning students to units or sessions;
- assigning lecturers to units or sessions;
- mock lecturer or student records;
- role-based lecturer/student user accounts;
- student-facing or lecturer-facing views.

## Dependencies

Install only frontend UI dependencies first needed by these shells.

Possible dependencies:

- additional shadcn/ui components if required, such as `Sheet`, `Textarea`, `Tooltip`, or `Separator`;
- Lucide icons if not already installed and useful for page actions or empty states.

Do not install TanStack Query, Zustand, backend libraries, or drag-and-drop dependencies in this unit unless already introduced by earlier units.

## Verification Checklist

- [ ] `/lecturers` renders a complete lecturer management shell.
- [ ] `/students` renders a complete student management shell.
- [ ] Lecturer UI uses lecturer-specific labels, copy, fields, and route structure.
- [ ] Student UI uses student-specific labels, copy, fields, and route structure.
- [ ] Lecturer form shell includes title, first name, and last name.
- [ ] Student form shell includes title, first name, last name, and year level.
- [ ] Lecturer availability editor shell exists and is visually understandable.
- [ ] Student page does not include lecturer availability controls.
- [ ] Delete confirmation dialogs exist for both lecturers and students.
- [ ] No real backend calls are made.
- [ ] No mock lecturer or student records are present.
- [ ] No auth, API, timetable scheduling, solver, or assignment behavior is changed.
- [ ] The frontend build command succeeds.
