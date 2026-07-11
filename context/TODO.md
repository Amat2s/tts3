# TODO List

## Overview

The project is looking good, but there are a few final things to do before its ready for the customers. These are:

- Add a go back to previous saves feature
- Add a soft constraint to make the timetable as similar as possible to the last save.
- Text display in scheduled sessions
- Bug fixes

## Saved tables feature

This includes a few things:

- change it so that Generate Timetable can run when it isn't saved, and if it runs with any impossible placements then they are not locked but the soft constraint is to move them away from where they are as little as possible. This is one spec file
- Everytime you save a timetable, it adds it to the saved timetable list. A button will allow you to open a modal where you can select previous timetables. This is several spec files

## Similar timetable

- When the Generate Timetable runs, it checks the last saved timetable. If the session is saved on the last one, it will try to leave it where it was. This is a soft constraint.


## Bug fixes/ UX problems

- blocks scheduled over lunch are currently covering lunch rather than skipping over it. Make sure they don't cover lunch
- smaller text
- match how the excel file renders scheduled classes, same format in sessions (UNITCODE CLASSTYPE [ORDER] (LECTURERINITIALS))


## FINAL THINGS

- Order rooms on timetable (left/right) by order in rooms (top to bottom), be able to move room position
- Add seminars to session types, same function as tutorials, but they don't overlap their student sorting  


- Smaller text in scheduled blocks, check that they actually have the right format in the /timetable (UNITCODE CLASSTYPE [ORDER] (LECTURERINITIALS))