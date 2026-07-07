# TODO List

## Overview

The project is looking good, but there are a few final things to do before its ready for the customers. These are:

- Making the excel export work properly
- Adding a new constraint feature, where the user can add in soft constraints
- Add a go back to previous saves feature
- Add a soft constraint to make the timetable as similar as possible to the last save.
- Add another upload feature for lecture information.
- Bug fixes

## Export Feature

At the moment, the new excel spreadsheet created from the timetable doesn't look as it should. Create another spec file to carefully implement.

## Contraints tab

Add another tab, called Preferences, that takes soft constraints from the user. Generate several spec files to implement this.

## Saved tables feature

This includes a few things:

- change it so that Generate Timetable can run when it isn't saved, and if it runs with any impossible placements then they are not locked but the soft constraint is to move them away from where they are as little as possible. This is one spec file
- Everytime you save a timetable, it adds it to the saved timetable list. A button will allow you to open a modal where you can select previous timetables. This is several spec files

## Similar timetable

When the Generate Timetable runs, it checks the last saved timetable. If the session is saved on the last one, it will try to leave it where it was. This is a soft constraint.

## Upload Lecturers

Like the students upload, this will read the Lecturer information and fill it out accordingly

## Bug fixes/ UX problems

- When saving, can get stuck; make sure updates after successful save
- Lock download table if draft is not saved
