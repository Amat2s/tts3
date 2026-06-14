# Unit 58 - Upcoming changes

## Outline

Turn this spec into full spec files of all the changes I outline. Respect the boundaries between each layer, and all the other requirements as per the context files. Ask me clarifying questions before building

## Additions/Changes

1. Search bar/filter for units/lecturers/students/rooms. All should have search.
   - Room filter by type
   - Student filter by year level or units enrolled (see next change)
   - lecturer filter by units teaching (see next change)
   - units filter by year level (see later change)

2. An additional field should be added to lecturers and students.
   - units student is enrolled in should be able to be added in the students creation/edit modal. This should only be a UI/frontend change, the underlying structure should be the exact same. A change to one should mark a change to the other. On the `/students` page it should say for each student how many units they are in.
   - lecturers should see what classes they are teaching. This should also be shown on the `/units` page. This may require another table for unit_ids and lecturer_ids, but use other solutions if possible. Keep this in mind with another change I want to make later. The user cannot change what units a lecturer is teaching in lecturers modal, only in the units modal.

3. Some changes to units and sessions,
   - units should have a year level field, like the students field. All the students should still be able to be selected, but the year level field should automatically select all those students in that year.
   - students should have a search bar and filter by year level in the modal
   - the way lecturers work will be changed a fair bit. In the unit, multiple lecturers will be selectable, and each session should be assigned an individual lecturer. This at minimum, will require the session table to be changed. All the same rules should apply, just with lecturers judged individually for each session.
   - simplify the duration field, have it as a number field with plus and minus arrows either side. Have it displayed as `hours` not `slots`. Same limits as before, between 1 and 4 hours.
   - There are only two lecture types: Lecture and Tutorial. Every student is in the lecture for the class they are enrolled in. For tutorials, the students are randomly divided into each tutorial so that there is an even amount in each. This should be done behind the scenes, it doesn't have to be displayed. Sovling algorithm and anything else that uses this information should take it from a new table that contains this information.

4. Fix lecturer availability
   - currently it works fine, the only issue is the way its saved in the table which means it can't be altered. Propose a solution for this problem, whether that be to delete and remake every blocked slot each time they are edited, or something else.

5. Timetable page
   - unscheduled sessions, I want them redesigned. This should not change any functionality. Sessions in units should stack in one column, and units should stack across the page. The code and name of units shouldn't be shown in each session, just the unit. Sessions should sit inside unit boxes, with code and title above them. These boxes should disappear when no sessions are left in them. Unscheduled sessions should also have a search bar and year level filter.
   - there should be a clear all button for the timetable to unschedule all sesssions. It should display a waring dialog before clearing.
   - When all sessions are scheduled the area should show a session scheduling done message, or something like that.
   - The notifications bar above the timetable should be fixed or float above. It should not move the whole page.

6. Finishing touches
   - There are only 3 year levels, year 1, 2, and 3.
   - Save timetable button should show Saved when the timetable is saved, not just Save
   - Solver button should always be blue, and should say `Generate Timetable`

Be thourough, follow these exactly when making specs. Ask clarifying statements until it is clear. Always keep the context files in mind.
