# Training calendar

Implemented in the actual Deadset app on 12 September 2026. This is source code for the next app release; no App Store submission, device installation or deployment was performed as part of this change.

## Behaviour

- Plan and Progress now offer Week, Month, Year and All time views.
- Previous/next and Today controls navigate periods. Year months open the corresponding month; all-time years open the corresponding year.
- Week/month dates open day details with recorded sessions and volume, or the planned workout and exercise count.
- Plan provides a link to the existing weekday editor. Changes are to the recurring weekly plan, not a one-off calendar appointment.
- Completed sessions use red volume intensity. Upcoming recurring workouts use dashed outlines. Today and selection have separate markers.
- Period totals show completed training days and recorded volume in the user's preferred units.

## Data semantics

The component derives its contents from existing app state and requires no storage migration. Plan passes its displayed schedule; Progress resolves the active program, saved schedule or profile default.

Only finished, valid sessions through today count toward history. Duplicate session IDs are deduplicated while separate sessions on one day remain distinct. Legacy completed dates remain visible without inventing session details or volume. Future records and unfinished sessions are excluded. The current recurring schedule is shown only from today forward; it is never projected into historical dates as evidence of past plans or completed work.

## Implementation

- `src/components/TrainingCalendar.tsx`: shared interactive calendar.
- `src/components/TrainingHeatmap.tsx`: compatibility wrapper used by Progress.
- `src/routes/_tabs.plan.tsx`: calendar and existing weekly editor integration.
- `src/lib/training-calendar.ts`: date, history and plan helpers.
- `src/lib/training-calendar.test.ts`: calendar boundary and data integrity tests.

## Validation

- TypeScript, targeted ESLint and production build passed.
- Full source suite passed: 96 test files, 821 tests.
- Browser checks passed for all four scales at 320, 375 and 430px with no horizontal overflow or page errors.
- Period navigation, drill-down, Today, planned day details and empty state checked. Six final mobile screenshots inspected.
- Browser QA used the production component with explicitly labelled fictional example records. It did not exercise authenticated sync or install the native app.

Local QA files are in `artifacts/qa/training-calendar-2026-09-12/`, including `checks.json`, the interactive fixture and six screenshots. While the local Vite server is running, preview at `http://127.0.0.1:8798/artifacts/qa/training-calendar-2026-09-12/index.html`.

## Marketing handoff

This supersedes the old fixed-scale heatmap component. Existing marketing exports retain their original provenance, but should not be described as captures of the latest calendar. Future promotion should capture this component or the real app, label example data when used, and obtain a fresh review of the exact final media.
