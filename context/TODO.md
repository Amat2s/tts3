# TODO List

## Overview

The project is looking good, but there are a few final things to do before its ready for the customers. These are:

- Add a go back to previous saves feature
- Add a soft constraint to make the timetable as similar as possible to the last save.

- Add another upload feature for lecture information.
- Text display in scheduled sessions
- Bug fixes

## Saved tables feature

This includes a few things:

- change it so that Generate Timetable can run when it isn't saved, and if it runs with any impossible placements then they are not locked but the soft constraint is to move them away from where they are as little as possible. This is one spec file
- Everytime you save a timetable, it adds it to the saved timetable list. A button will allow you to open a modal where you can select previous timetables. This is several spec files

## Similar timetable

When the Generate Timetable runs, it checks the last saved timetable. If the session is saved on the last one, it will try to leave it where it was. This is a soft constraint.


## Text display in bug features
- match how the excel file renders it, same format in sessions

## Bug fixes/ UX problems

- [x] When saving, save button can freeze; make sure updates after successful save — done (Unit 106)
- [x] Lock download table button if draft is not saved — done (Unit 106)
- [x] Clear messages when a new one comes, unless they are timetable clashes — done (Unit 106)
- dragging sessions; drop slot should be positioned under mouse when dragging
- add one pixel height for slots per extra hour; too short atm when they cover 2+ hours
- can edit blocks when not saved; don't disable blocks
- change the way edit blocks works; click/toggle like preferences in creation mode
- Add course/lecturer/student filter and search to timetable, same row as extend + day filters, on the left side
- Room name text smaller when timetable is smaller; make extend view 2x narrower
- Catch errors when trying to delete something that database doesn't allow; tell user why they can't delete it yet, what is it tied to
