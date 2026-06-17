# More changes

Mostly UI changes, turn this into a full spec batch. Consult ui-context.md for styling.

## Changes

1. Unscheduled sessions pool.
   - Make each unit box a fixed size, a little smaller than the full row size at the moment, but still enough room to show all the information. Give them a little bit of room to change so that they can fit across the whole page, but make sure each box is the same size as every other box.
   - Remove type search from search bar; user should only be able to search by unit and lecturer.

2. Unit colours.
   - Each unit should be coloured based on what subject they teach. Upgrade the parser to detect type of class, first three chars should match one of these:
     - `HIS` - History (Orange)
     - `PHI` - Philosophy (Blue)
     - `THE` - Theology (Pink)
     - `LIT` - Literature (Dark Green)
     - `LAN` - Latin (Light Orange)
     - `GRE` - Greek (Light Green)
     - `SCI` - Science (Dark blue)
   - Parser should execute under the hood automatically (no parser controls or raw logic exposed in the UI). Disable create button in modal if Unit Code does not satisfy both parser outputs. Parser output is shown below unit code when it knows what class it is and what year; it can display [Class] [Colour] [Year level]

3. Titles
   - No student titles: remove them
   - Lecturer list: Mr, Miss, Mrs, Dr, Fr, Prof.
   - No dot except for Prof.

4. Top/warning bar
   - Everything should be displayed in the one bar - nothing outside
   - No text box should appear and move the page.
   - The show details extention should open above the timetable.
   - Instead of mentioning the slot name (e.g. s4), it should show its value (e.g. 1:30-2:20)

5. Drag and drop
   - when being dragged, sessions should have the same shape that they do on the timetable, this should be calculated dynamically by grid width and height, and session duration.
   - session draggable should center on mouse width-wise and center of first slot height-wise
   - All timetable grids that the session would cover should highlight when hovered over. If the session cannot be placed there, the grids should not highlight at all.

6. Save timetable draft state in local memory, so that it doesn't get wiped every time you leave the page.

7. Remove heading between navbar and the display bar above the timetable - unnecessary

8. Buggy save button - sometimes it won't save the timetable if its empty, check for any issues

9. Timetable styling
   - make the borders darker. The lunch bar should be a red with gold text that says Lunch/Mass

10. Navbar left corner title should be the same font as other titles, same colour as it is, bold, and should say "Campion - Timetable"

11. Units modal
    - Clean up the way its styled. Unit Code, Unit Name, teaching team and students on one side, sessions on the other.
    - Add clear all button for adding students, same line as select all first year students

12. Units filter in lecturer and student should filter by subject - calculated from parser in 2. Also lecturers should have year filter, calculated by parser.
