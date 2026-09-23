# DEADSET 1.3 — Strength You Can See

Status: submitted — Waiting for Review
Started: 6 September 2026  
iOS version/build: 1.3 (165)

Production baseline: App Store version 1.2. This update is built directly on that shipped product;
it is not based on the archived 1.1 build.

## Release promise

DEADSET 1.3 makes progress understandable at a glance and turns that insight into the next useful
action. The muscle-strength map is the signature surface; the plan and live logger are the data loop
that keeps it honest.

The 1.2 cinematic DEADSET opening, staged account setup, trial/paywall, friends and nearby flows,
Strength Map, weekly maps, and notification experience are release invariants. New work layers onto
those flows and must not replace them with an older implementation.

This is not a feature dump. Every addition must improve at least one of these moments:

1. Know what to train.
2. Log a working set without friction.
3. See what changed.
4. Know what to do next.
5. Share or compare progress safely.

## Scope and status

### Post-submission candidate — Time Fit and session receipt

- [x] Add a deterministic 20, 30 and 45 minute workout adapter to the Train session brief.
- [x] Preview every retained movement, reduced set and same-day omission before the live session starts.
- [x] Preserve exercise order and keep linked superset partners together.
- [x] Apply the adaptation only to the new live session; never mutate the saved programme or future targets.
- [x] Mark express sessions in the live logger with original-versus-active movement and set counts.
- [x] Add a completion receipt comparing genuine planned and completed working sets per movement.
- [x] Exclude warm-ups and drop sets from plan adherence while retaining their existing volume behaviour.
- [x] Show adjusted, skipped, on-plan and extra-work states plus recorded average RPE.
- [x] Add 7 regression cases; full checks pass with 100 test files / 833 tests.
- [x] Verify real components at 320/375/393/430px with 44px minimum controls, hidden vertical scrollbar and zero horizontal overflow.

This package is source for the next candidate after build 165. It has not been uploaded or submitted,
and its Pro purchase path has not been freshly exercised against StoreKit sandbox in this pass.

### Post-submission candidate — Return protocol

- [x] Detect a genuine 10-day-or-longer gap from completed sessions with logged work, ignoring unfinished, empty and future-dated records.
- [x] Offer a visible comeback session from Train when the selected day contains a workout.
- [x] Reduce planned loaded movements by approximately 10%, rounded to a loadable 2.5 kg boundary.
- [x] Remove one set only from prescriptions above two sets and set a conservative 3 RIR floor.
- [x] Preserve bodyweight targets and keep every change inside the single new session.
- [x] Label the return ramp in the live logger and explain it again in the completion receipt.
- [x] Add three focused regression cases covering gap evidence, normal rhythms, future data and immutable source sessions.

This is not medical or injury rehabilitation advice. An athlete with pain or an injury still needs an
appropriate professional; the protocol only avoids forcing stale training targets after time away.

### Training calendar — build 165

- [x] Add Week, Month, Year and All time views to Plan and Progress, with date navigation, drill-down and day details.
- [x] Distinguish recurring upcoming plans from actual completed history and connect Plan to the weekly editor.
- [x] Validate calendar boundaries and record integrity; full release checks passed with 821 tests on 12 September.
- [x] Upload and submit build 165. Apple reports WAITING_FOR_REVIEW, with automatic release after approval. Submitted 12 September 2026 at approximately 22:18 Europe/London.

See [calendar implementation and QA](training-calendar-2026-09-12.md).

### Session Flow — build 164

- [x] Replace the narrow horizontal exercise strip with a collapsible Session overview that shows full movement names, set counts and completion states.
- [x] Add movement search and an unfinished-only filter; preserve both when closing and reopening the overview.
- [x] Jump directly to the next unfinished movement, including earlier skipped work, without reordering the workout.
- [x] Show remaining working sets, completed movement totals and superset labels.
- [x] Add an isolated wall-clock session timer; its second-by-second updates do not rerender the parent workout or recalculate history.
- [x] Minimize/expand the rest timer without stopping it, keeping +15 seconds and Skip available with 44px controls.
- [x] Fix rest resetting when switching movements: each rest period has its own identity and initial absolute deadline.
- [x] Respect the manually selected movement at rest completion, and adjust the pending target when exercises are moved or removed.
- [x] Serialize native alert mutations so a delayed schedule cannot resurrect an already-cancelled rest alert.
- [x] Stop unnecessary timer state updates within the same visible second; avoid background polling renders and reconcile immediately on return.
- [x] Animate live/rest progress using transforms rather than width, respecting reduced-motion preferences.
- [x] Fix the global auto-rest off switch being overridden by an exercise's saved interval; explicitly choosing a new positive interval re-enables it.
- [x] Align header and workout totals with authoritative working-set counts, excluding warm-up/drop sets while retaining timed/distance conventions.
- [x] Prevent form controls from starting accidental exercise swipes; contain long exercise headings and stale active indices.
- [x] Restore keyboard focus after picking a movement and add accessible elapsed/rest/progress descriptions.
- [x] Preload bottom-navigation destinations on intent, without eagerly loading the entire app at startup.
- [x] Keep the 1.2/1.3 branding, cinematic opening, Strength Map, Performance Lab, onboarding, StoreKit, friends and all other recent features unchanged.
- [x] Add 38 regression cases for progress, navigation, time, native scheduling order and auto-rest preferences.

Browser checks used the real Live Workout route inside an isolated local fixture (no live account,
no Pro provider, no customer data or remote sync). Confirmed search, unfinished filtering,
empty search state, filter retention, record-set logging, timed-exercise navigation, focus return,
rest continuity across exercise changes, compact mode, +15-second extension and Skip.
Page/navigator/rest widths matched 320/375/393/430px; the tested paths had no horizontal overflow.
The fixture's initial setter mistake was corrected before exercising the app; no subsequent app
runtime errors were captured. Preview: `artifacts/qa/build-164/session-overview.png`.

Release/native verification and physical-device installation: pending final checks below.
This is a local development candidate, not an App Store upload or submission. Live billing,
remote social flows, notification delivery on a locked physical device and subjective haptic
feel have not been freshly end-to-end tested in this pass. Store screenshot 04 (live workout)
should be refreshed for the final listing because the session navigation has changed.

### Training block comparison and panoramic store images — build 163

- [x] Add Compare training blocks directly beneath the Strength Map's existing Performance Lab entry points.
- [x] Compare equal, adjacent 1-, 4- and 12-week periods with exact date ranges.
- [x] Compare training days, completed workouts, working sets, exercise coverage and actual lifting volume; keep timed holds and distance separate.
- [x] Show exercise-by-exercise period-best changes, with improved, unchanged, lower, new and previous-only filters.
- [x] Add exercise search, bounded pagination, evidence-day counts and limited-evidence guidance.
- [x] Preserve comparison period, search and filters when opening a record and returning.
- [x] Reuse semantic haptics, accessible tabs and reduced-motion-aware transitions without changing existing branding or membership flows.
- [x] Exclude unfinished workouts, warm-ups/drop sets, invalid/future data, legacy mirrors and self-reported PRs from completed-work comparisons.
- [x] Add 18 regression tests; preserve workout history and timed-set `reps: 0` conventions.
- [x] Design six App Store images as three connected panoramic pairs, using actual app screens with fictional local demonstration data.
- [x] Export ordered 6.9-inch and 6.5-inch PNG sets, preview spreads and a reproducible layout generator.
- [x] Create the App Store Connect 1.3 draft without changing the live 1.2 listing.
- [ ] Upload the new images: Chrome's file chooser is blocked by extension file-access permission; native file-picker fallback did not complete.
- [x] Install build 163 on the physical iPhone: installed successfully on 12 September 2026. Launch was blocked by the device lock; unlock and open DEADSET to inspect this development preview.

Verification on 10 September 2026: `npm run appstore:strict` passed with 92 test files / 778 tests,
TypeScript, ESLint, production build, CSS and Xcode-project checks, and readiness probes. Capacitor
iOS sync and the signed Debug iPhone/Watch Xcode build succeeded. Actual comparison components
were browser-tested at 320/375/393/430px, including period switching, filtering, searching, record
drill-down/back state, pagination/empty results, keyboard tab navigation, immutable fixture state
and no horizontal overflow. These fixture-based checks do not establish live billing, social,
sync or notification-delivery correctness. Build 163 has not been submitted for review.

12 September follow-up: App Store Connect had signed out. The user must sign back in before
the prepared images can be uploaded; the extension file-access requirement remains unverified.

See [store-image handoff and upload status](app-store-panorama-1.3.md).

### Performance Lab and competitor review — build 162

- [x] Research Stronger and Liftoff using their official product pages, App Store descriptions/reviews and Liftoff FAQ; distinguish marketing claims from verified usage.
- [x] Add prominent Rank roadmap and Record book entry points beside the existing Strength Map without changing its artwork or formula.
- [x] Sort next-rank opportunities by relative gap; show current/next tiers and exercise-specific versus approximate benchmark labels.
- [x] Add searchable, muscle-filtered, paginated records for estimated max, bodyweight reps, holds and distance.
- [x] Show best-set details, dated evidence, record age and clearly labelled self-reported check-ins.
- [x] Compare the latest six completed training dates and show change against the preceding comparable date.
- [x] Add a read-only, decimal-friendly kg/lb performance preview; no synthetic workout, PR or saved rank is created.
- [x] Preserve timed-set `reps: 0`, exclude warm-ups/drop sets and unfinished workouts, reject invalid/future dates and avoid duplicated legacy mirrors.
- [x] Explain missing/mismatched evidence and link missing muscle areas to the existing Muscle Lab.
- [x] Fix PR goal input units, validate against the all-time best and disable locked form controls for keyboard users too.
- [x] Preserve existing branding, motion, streaks, membership flows, social features and all recent additions; add no AI services or new purchases.
- [x] Add 50 regression tests covering record integrity, calculator boundaries and goal input.
- [x] Check actual components with isolated fixture state at 320/375/393/430px, including search/filtering, tabs, scroll reset, decimal input, preview immutability, pounds, dismissals, missing-data actions and goal add/remove/locked states.

See the [detailed comparison and complete addition list](stronger-liftoff-review-2026-09-10.md).
Browser checks use local fixture data and a mocked membership hook for the goal-editor tests;
they do not establish live purchase, sync, social or notification delivery correctness.
Build 162 release checks (10 September 2026): `npm run appstore:strict` passed with
91 test files / 760 tests, TypeScript, ESLint, production compilation, CSS and Xcode-project checks,
and readiness probes. Capacitor iOS sync passed. Performance Lab is a conditional chunk
(16.90 kB / 5.50 kB gzip), not loaded during the initial app launch.
The signed Debug iPhone/Watch Xcode build succeeded and its `CFBundleVersion` is 162.
Build 162 was installed and launched successfully on Theo's physical iPhone 16 Pro. This is a development
preview installation, not a TestFlight upload or App Store submission.

### Weekly momentum and honest daily goals — build 161

- [x] Surface a compact active-week streak on Train Today with current/best runs and a next-milestone countdown.
- [x] Keep the current Monday–Sunday week open; rest days do not break this new streak. Existing daily streaks remain separate.
- [x] Add an interactive eight-week history with exact training dates and explicit empty/open-week states.
- [x] Show earned 2/4/8/12/26/52-week milestones using the longest recorded run, retaining them after breaks.
- [x] Derive the weekly target from actual active-programme days, falling back to the current schedule; respect empty programmes.
- [x] Exclude malformed/future dates and count distinct training days, without rewriting workout history or adding synthetic sessions.
- [x] Keep the onboarding goal-date countdown and provide direct links to Plan and workout history.
- [x] Refresh weekly/daily streak views at local midnight and on return from background; use calendar arithmetic across DST.
- [x] Add Daily Quest progress bars, semantic selection haptics, keyboard-accessible disclosure and reduced-motion-aware transitions.
- [x] Fix protein/hydration quests being marked done before the full existing target; invalid values cannot earn completion.
- [x] Add 31 regression cases covering calendar boundaries, rest-day grace, history integrity, programme targets and goal completion.
- [x] Browser-test the new momentum component at 320/375/393/430px, history selection, keyboard, reduced motion, route links and midnight rollover.
- [x] Browser-test Daily Quests at 320px, including 80%-versus-100% completion and keyboard disclosure.

Verification scope: these browser checks isolate the real components with fixture state. They do not represent a fresh live-account, billing, social, or notification-delivery end-to-end audit.

Build 161 verification (10 September 2026): `npm run appstore:strict` passed (89 test files,
710 tests); Capacitor iOS sync and the signed Debug iPhone/Watch Xcode build succeeded. The built
app reports `CFBundleVersion = 161`. Theo's iPhone was unavailable, so this build has not yet been
installed on the physical device or submitted for review.

### 0. Routine Vault

- [x] Search saved programmes by routine name, split, exercise or target muscle.
- [x] Create colour-coded folders for goals, seasons, gyms or training blocks.
- [x] Pin favourite routines above the rest without changing the active week.
- [x] Deep-duplicate a programme so edits to the copy never alter the original.
- [x] Move routines between folders or return them to Unfiled.
- [x] Archive and restore old blocks instead of forcing permanent deletion.
- [x] Preserve deletion tombstones during cloud merges so stale devices cannot resurrect folders.
- [x] Keep every 1.2 programme valid through optional, backwards-compatible fields.
- [x] Provide distinct haptic feedback for pinning, filing, duplicating, archiving and restoring.
- [x] Keep all filter controls in a wrapping grid with no horizontal carousel or sideways scroll.

### 0.1 Apple Watch exercise history

- [x] Carry the last four completed performances for every live movement from the phone to the
      paired Watch.
- [x] Show the best set, completed working-set count, session date and performance direction for
      each recent session.
- [x] Support load/reps, timed holds and distance efforts without converting seconds or metres into
      repetitions or tonnage.
- [x] Exclude warm-ups, drop sets, unfinished workouts and the current live workout from history.
- [x] Keep the iPhone as the sole source of truth; the Watch displays the bounded projection and
      never owns or merges workout history.
- [x] Keep older phone payloads decodable during staggered iPhone/Watch updates.

### 0.2 Startup and motion performance

- [x] Keep first download behind a minimal native welcome shell without starting purchases, cloud
      sync or engagement watchers before the athlete chooses an account action.
- [x] Load the authenticated provider and sync shell only on routes that require it.
- [x] Defer recap, achievement, review and reminder layers until the browser's idle window.
- [x] Keep coaching, ranks, weekly analysis and reports data-rich while loading that bundle only
      when the athlete opens Train Insights.
- [x] Reduce the main production JavaScript entry from 152.06 kB to 41.38 kB (72.8%) and the Train
      entry from 59.67 kB to 47.68 kB (20.1%) without removing 1.2 features.
- [x] Tighten the DEADSET entrance and boot handoff timings while preserving Reduce Motion
      equivalents and the persistent readiness screen.

### 0.3 Muscle Playbook

- [x] Cover all 28 broad and specific Muscle Lab targets with deterministic training knowledge.
- [x] Adapt conservative weekly-set ranges to beginner, intermediate and advanced experience.
- [x] Adapt rep and progression guidance to size, strength and balance goals.
- [x] Put low recovery ahead of adding more volume and explain the current recommendation plainly.
- [x] Include target priorities, movement roles, repeatable technique cues, common mistakes and
      readiness checks without presenting the guidance as medical advice.
- [x] Present the knowledge in four compact animated panels with haptics, VoiceOver tab semantics,
      Reduce Motion support and no horizontal carousel.
- [x] Lazy-load the 19.40 kB playbook only when Muscle Lab opens, keeping the 41.39 kB main entry
      effectively unchanged.

### 0.4 Muscle Lab interaction and loading polish

- [x] Defer the exercise catalogue request until Muscle Lab is actually opened.
- [x] Wrap specific muscle-area choices into a two-column grid instead of a sideways carousel.
- [x] Show the complete rep guidance and clarify that weekly set ranges cover the broad muscle group.
- [x] Use accessible playbook tabs with arrow-key navigation, focus indicators and unique panel IDs.
- [x] Add lightweight DEADSET route-loading states with no artificial minimum wait or fake percentage.
- [x] Remove the welcome action reveal timer while preserving its existing branding and animations.
- [x] Tighten sheet transitions to 260 ms open / 180 ms close with reduced-motion alternatives.

Local component QA for build 158: Chromium at 320, 375, 393 and 430 px passed welcome-link,
horizontal-overflow, text-clipping, playbook keyboard/tab, sheet close/reopen and reduced-motion
checks, with no uncaught browser errors. A forced catalogue failure left the built-in guidance
usable; no catalogue request fired while the sheet was closed. This is scoped component QA,
not verification of live purchases, social accounts or physical-device accessibility.

### 0.5 Research-backed Exercise Finder

- [x] Search locally with abbreviations, muscle aliases and conservative typo tolerance.
- [x] Share forgiving search with Plan and live replacements without relaxing swap exclusions.
- [x] Browse saved and built-in movements while the full catalogue loads or is unavailable.
- [x] Combine muscle/equipment/beginner filters with Explore, In my week and Saved/custom views.
- [x] Render results in batches and provide clear/reset/retry/empty-state controls.
- [x] Open accessible anatomy and technique sheets with explicit external demonstration search.
- [x] Add to the actual active programme or schedule, prevent duplicate entries and show true outcomes.
- [x] Preserve known repeated loads and saved prescriptions through the existing plan update logic.
- [x] Classify new catalogue additions from primary muscles before secondary support muscles.

Chromium component checks passed at 320, 375, 393 and 430 px: offline catalogue fallback,
abbreviation/typo search, combined filters, empty/reset states, active-programme updates,
same-day duplicate protection and persistence across reload. No horizontal overflow or uncaught
browser errors occurred. Typing and filtering sent no additional catalogue requests. Tests used
local fixture data and intercepted network requests, not live customer accounts.

Research and the separate proposed 24-package backlog: [competitor review](competitor-review-2026-09.md).

### 0.6 Home day selector

- [x] Replace the seven-column home grid with a contained swipeable day rail, as requested.
- [x] Keep each day card 104 px wide, show a swipe hint, hide the rail scrollbar and bring the selected day into view.
- [x] Preserve day-selection haptics, schedule/programme labels and reduced-motion behaviour.
- [x] Confine sideways scrolling to this intentional control; the page itself does not overflow.

### 1. Signature Strength Map

- [x] Prominent placement near the top of Progress.
- [x] Front-and-back muscle visual driven by working-set history.
- [x] Warm-up sets excluded from strength evidence.
- [x] Bodyweight movements use bodyweight rather than pretending the load is zero.
- [x] Repeated logged days and real load/e1RM progress advance the personal score.
- [x] Uncovered muscles remain grey and say “No exercises set”.
- [x] Planned-but-unlogged areas tell the athlete that a first working set is needed.
- [x] Direct actions to cover plan gaps or start logging.
- [x] Plain disclosure that this is a personal progress signal, not a medical assessment or a
      leaderboard comparison.
- [x] Interactive muscle drill-down: contributing exercises, last/best estimated strength, change,
      and next working-set target.
- [x] Per-region weekly working sets, experience-scaled planning range, trend and a plain-English
      explanation of the next deterministic load/rep target.
- [x] Compact Strength Map pulse on Train surfaces the next uncovered, unlogged, or weakest area.
- [x] Athlete-entered setup baselines feed the same strength evidence pipeline as logged workouts.
- [ ] Side-by-side friend comparison that only uses public, server-validated stats.

### 2. Progress-to-plan loop

- [x] “Build this area” recommends suitable movements from the existing exercise catalogue.
- [x] Recommendations respect equipment and never duplicate a movement already in the week.
- [x] One accepted recommendation updates Plan, the next live workout, and map coverage state.
- [x] “Auto-cover every gap” selects one compatible movement per uncovered region and places each
      into the most relevant existing training day.
- [x] Deterministic injury-note rules remove conflicting movements from recommendations.
- [x] Preview every multi-exercise auto-cover change and require confirmation before saving it.

### 3. Gym-floor reliability

- [x] Complete immediate offline retry snapshot for set logging and conflict-safe reconnect.
- [x] Protect newer training history from stale second-device writes by merging append-only history.
- [x] Resume an interrupted workout with exercise, set, timer, and superset position intact.
- [x] Import DEADSET, Hevy, Strong and generic workout CSV history without deleting current data.
- [ ] Verify no horizontal overflow or keyboard obstruction on every supported iPhone width.

### 4. Social proof without fake numbers

- [ ] Friend comparison explains which stats are comparable and which are private.
- [ ] Server-validated PRs only in ranked comparisons.
- [x] Native Strength Map share text contains the selected personal score and lift progress, with no
      bodyweight, location, or health data.
- [ ] Branded image share card for the Strength Map.
- [ ] Deep link from a shared map to the sender’s public athlete profile.

### 5. Premium feel and accessibility

- [x] Native iOS haptic plugin and global light selection feedback for app buttons and links.
- [x] Strong success feedback for map plan changes, PR celebrations, and completed rest timers.
- [x] Reduce Motion equivalents for new Strength Map progress animations.
- [x] Accessible pressed state and status announcements for muscle selection and plan changes.
- [x] VoiceOver describes the anatomical visual and exposes every muscle region through adjacent
      selectable controls with pressed state.
- [ ] Dynamic Type and contrast verification.
- [ ] Loading, empty, error, offline, and partial-data states for the complete 1.3 flow.

## Non-negotiable release gates

- `npm run appstore:check` passes from a clean dependency install.
- `npm run appstore:strict` passes immediately before archiving.
- Release build succeeds for iPhone and the Rest Activity extension with the same version/build.
- Fresh signup, seven-day trial disclosure, purchase, restore, cancellation management, and expired
  entitlement are tested with StoreKit sandbox accounts.
- Password reset, logout, and account deletion pass on a physical iPhone.
- Plan → live workout → completed set → Strength Map update is tested online, offline, after relaunch,
  and after reconnect.
- No horizontal page scrolling, visible browser scrollbars inside the native shell, clipped controls,
  blank boot states, or keyboard-covered primary actions.
- App Store screenshots and release notes describe only behaviour present in build 160.

## Measurement

Track the funnel without per-user AI or new paid infrastructure:

- Progress tab opened.
- Strength Map seen.
- Map gap opened.
- Exercise recommendation previewed and accepted.
- First working set logged for a previously grey area.
- Strength Map shared.

The success signal is not screen views alone. It is athletes moving from a grey/unlogged region to a
tracked region and returning to update it.

## Coaching implementation

DEADSET 1.3 uses no AI model, generated coaching, or external recommendation API. Progression,
deloads, weekly reviews, muscle coverage, exercise suggestions and injury-note filtering are
deterministic functions of the athlete's own plan and logged sets, reps, loads and RPE/RIR data.
