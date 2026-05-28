## Goal
Make new attendance rows match your sheet's columns exactly:
`Scan ID | ID | Name | Institute | Date | In Time | Out Time | Duration | Employee/Student | Status`

## Changes

**`src/lib/sheets.functions.ts`**
- Update `ensureAttendanceSheet` headers to the 10 columns above (only writes headers if the sheet is brand new — your existing Attendance tab is untouched).
- Rewrite `appendAttendance` to write a row with:
  - **Scan ID**: random 8-char hex (`crypto.randomUUID().replace(/-/g,'').slice(0,8)`)
  - **ID**: studentId (e.g. `WIS00334`)
  - **Name**: student name
  - **Institute**: `INS003` (default)
  - **Date**: `M/D/YYYY` to match existing format (e.g. `5/23/2026`)
  - **In Time**: `HH:MM:SS` 24h local time
  - **Out Time**: blank
  - **Duration**: blank
  - **Employee/Student**: `Student`
  - **Status**: `Present`
  - Append range becomes `Attendance!A:J`.
- Update `getTodayAttendance` to read `A:J` and map new column indexes (studentId from col B, name from col C, time from col F) so the Session page keeps working.

**No UI changes** — Scanner, Session, Roster screens stay the same.

## Notes
- Existing rows in your sheet are not modified.
- If you later want Institute per-student, we can add an `Institute` column to the Students sheet and read from it.
