# QR Attendance Web App

A mobile-friendly web app that scans student QR codes and appends attendance rows to your Google Sheet.

## How it works

1. You open the app on your phone, tap **Start Scanning**.
2. The phone camera scans a student's QR code (the QR encodes the student ID from your sheet).
3. The app looks up that ID in your sheet, marks the student **Present** with a timestamp, and shows a confirmation.
4. A session log shows everyone scanned so far, with undo.

## Pages

- **Home / Scanner** — big camera viewport, live QR scanner, success toast with student name after each scan.
- **Today's Session** — list of students scanned today, with time and an "undo" button per row.
- **Roster** — read-only view of students pulled from your sheet (to verify the connection works).
- **Settings** — sheet/tab name, duplicate-scan cooldown (e.g. ignore same student within 60s).

## Google Sheet structure

Your existing sheet should have a **Students** tab with at least: `StudentID`, `Name` (other columns are fine and preserved).

The app will create/use an **Attendance** tab with columns: `Timestamp`, `Date`, `StudentID`, `Name`, `Status` (always "Present" for now).

## Tech

- Frontend: TanStack Start (React) + Tailwind, mobile-first layout.
- QR scanning: `html5-qrcode` library running in the browser (uses the phone camera, no install).
- Google Sheets: Lovable's Google Sheets connector — you connect your Google account once; the app reads the Students tab and appends rows to Attendance via server functions.
- No database needed — the sheet is the source of truth.

## Out of scope (can add later)

- Face recognition, multi-teacher accounts, offline mode / PWA install, marking absentees, exporting reports.

After you approve, I'll build the UI, wire up the Google Sheets connector, and you'll be prompted to connect your Google account.
