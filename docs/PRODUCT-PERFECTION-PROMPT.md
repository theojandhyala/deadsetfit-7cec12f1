# DEADSET — product perfection execution prompt

> Paste this entire document into a fresh coding-agent session. It is an
> execution brief, not permission for a giant unreviewed rewrite. Work in
> vertical slices, prove each slice, and preserve athlete data above all else.

## Your role

You are the senior product engineer, iOS engineer, interaction designer,
quality lead, and pragmatic product strategist for DEADSET. You are taking an
already substantial app from “feature-rich but uneven” to a focused,
trustworthy, category-leading strength-training product.

Your job is not to add the maximum number of screens. Your job is to create the
best end-to-end experience for this loop:

1. Set a realistic weekly programme.
2. Know exactly what to do and what weight to use today.
3. Log a workout faster than paper.
4. Feel every important action through intentional haptics.
5. Immediately understand what the work changed.
6. See strength muscle by muscle, not as an abstract spreadsheet.
7. Compete, share, return, and progress without losing trust in the data.

Treat the strength body map and the weekly schedule as the two product anchors.
The logger must be excellent because it supplies the truth. Competition must be
excellent because it creates retention. Everything else must strengthen that
system or be removed from the critical path.

Do not promise that this app will make millions, is flawless, or has no bugs.
Build a product that has measurable reasons to retain and monetize, and prove
quality through explicit tests and device evidence.

---

## 1. Product thesis

DEADSET is a ranked, competitive iOS strength app. Its moat is the combination
of:

- a visible, personal strength identity;
- a muscle-by-muscle map that changes when real performance changes;
- a programme that turns that map into the next useful action;
- a fast, serious logger;
- ranks, leagues, crews, duels, challenges, PRs, and shareable proof.

The product must feel like a training instrument, not a generic wellness app.
It should be intense but legible, competitive but honest, advanced but quick.

The user should be able to answer these questions in seconds:

- What am I training today?
- What weight should I start with?
- What did I lift last time?
- Did I improve?
- Which muscles are strongest?
- Which muscles have exercises but not enough evidence?
- Which muscles have no exercises in my plan?
- What should I change next week?
- Where do I rank against myself, friends, and my current competition?

If a feature does not improve one of those answers, it is probably not a
priority.

---

## 2. Non-negotiable engineering constraints

Breaking any constraint below is a release blocker.

### 2.1 No per-user AI cost

- Do not add model calls, hosted LLM inference, generated coaching calls, or any
  feature whose marginal cost rises with user activity.
- “AI routine” outcomes must be achieved with deterministic rules, local data,
  tested progression logic, and transparent explanations.
- Do not label a deterministic feature “AI.” Call it adaptive, automatic,
  personalized, or rule-based as appropriate.

### 2.2 Native iOS purchase boundary

- Do not add prices, purchase buttons, checkout links, or external purchase
  calls to action inside the native iOS UI.
- Pro can be sold on the web. Preserve the deliberate App Store Guideline 3.1.1
  posture already documented in the repository.
- Existing entitlement and StoreKit plumbing must not be casually replaced.

### 2.3 Preserve data semantics

- Timed and distance sets store `reps: 0` plus a mode field.
- This is deliberate: every existing `weight * reps` volume calculation then
  contributes zero without special casing.
- Never “fix” timed sets by assigning fake repetitions.
- Never silently rewrite workout history during a feature migration.
- Use `isWorkingSet` and `countsForRecords` from
  `src/lib/set-tracking.ts` as the authority for set classification.
- Warm-up and drop sets do not count as working sets or records.
- Failure sets are genuine working attempts and count.

### 2.4 Inputs in the iOS web view

- User-editable inputs must remain DOM-owned: `defaultValue` plus a ref, read on
  submit.
- Controlled `value` plus `onChange` has frozen typing in the iOS WKWebView.
- For numeric entry, use `inputMode="decimal"`, `step="any"` where decimals
  are valid, custom validation, specific inline errors, and no browser-native
  validation bubbles.

### 2.5 Timers

- Timers count down from stored deadlines.
- Never implement countdown truth by decrementing a number once per second.
- iOS suspends JavaScript in the background. Deadline-based reconstruction is
  required for rest timers and Live Activities to agree.

### 2.6 Haptics

- Every haptic call goes through `src/lib/haptics.ts`.
- Add a named function for the meaning, not a waveform selected at the call
  site.
- `navigator.vibrate` is only a non-iOS fallback and is not an iOS solution.
- Respect the persisted haptics opt-out.
- Never let a haptic failure interrupt a workout or navigation.

### 2.7 Native target architecture

- The Apple Watch is a remote control for phone-owned workout truth.
- Every Watch action carries an id and the phone deduplicates it.
- Shared Swift under `ios/App/Shared` compiles into multiple targets.
- Widgets read a `WidgetSnapshot` from the App Group because they cannot see
  WKWebView localStorage.
- If a Swift file is added, also add it to the hand-maintained Xcode project
  and run `npm run check:xcodeproj`.

### 2.8 Verification honesty

- Never say a change is verified unless the relevant command or device flow
  was actually run.
- Never convert “compiled” into “works on phone.”
- Never convert “opened on phone” into “end-to-end flow passed.”
- State exactly what was run, on which platform, and what remains unverified.

---

## 3. Current architecture

Read `docs/AGENT-BRIEF.md` before editing anything. Then inspect the actual
working tree rather than assuming this prompt is newer than the code.

- Web layer: Vite, React, TanStack Router, TypeScript.
- Persistence: localStorage-first state with Supabase synchronization.
- Native iOS wrapper: Capacitor.
- Native integrations: HealthKit, Live Activities, widgets, haptics,
  WatchConnectivity, StoreKit plumbing.
- Watch: SwiftUI watchOS companion.
- Competitive system: grit points, ranks, leagues, crews, duels, badges,
  seasons, referrals, share cards.
- Logger: ghost sets, deterministic RPE progression, warm-up ramp, plate
  calculator, per-exercise bar weights, supersets, special set types,
  add/swap/remove/reorder, time/distance modes, cues, rest settings, editable
  history.
- Progress: PRs, volume, body measurements, photos, charts, lifetime workout
  history, strength grades, and body map.

Do not rebuild existing systems under a new name. Improve them in place.

---

## 4. Competitive evidence, dated 27 August 2026

Treat this as market evidence, not a design library to copy.

Official Stronger sources inspected for this brief:

- `https://www.strongermobileapp.com/features`
- `https://www.strongermobileapp.com/`
- `https://www.strongermobileapp.com/tools`
- `https://www.strongermobileapp.com/strength-score`
- `https://apps.apple.com/gb/app/stronger-gym-workout-planner/id1621719397`

The public Stronger feature set includes:

- a bodyweight- and gender-aware Strength Score;
- muscle-by-muscle ranks from Beginner through World Class;
- progress over weeks and months;
- fast set, rep, and weight logging with smart defaults;
- automatic PR detection and a rest timer;
- adaptive routines that adjust weight, sets, and reps;
- deload suggestions;
- prebuilt and custom programmes;
- groups, challenges, leaderboards, and activity feeds;
- a large exercise library with instructions, filters, muscle targeting, and
  custom exercises;
- generated routines based on goal, equipment, and experience;
- per-exercise strength curves;
- muscle-group volume and frequency;
- body measurements;
- Apple Health, wearable, and export integrations;
- warm-up and drop-set tracking;
- RPE, top-set, and back-off-set concepts;
- shareable workout summaries, achievements, and milestones.

The user-provided visual references additionally show:

- a front/back muscle map comparing an earlier state with “Now”;
- clearly labelled rank colours;
- grey or absent evidence where no strength can be inferred;
- an all-time, year-by-year workout heatmap with counts.

Do not copy Stronger’s brand, copy, illustrations, screenshots, exact layouts,
proprietary calculations, tier thresholds, or trade dress. Reach comparable
user outcomes with DEADSET’s own dark industrial design, rank system, wording,
math, and interaction model.

Competitor marketing claims are not automatically ground truth. Validate
behavior with available public evidence and the DEADSET product model. Mark
anything that cannot be independently confirmed as “reported publicly,” not
as a verified fact.

---

## 5. Definition of category-leading

DEADSET wins only if it is stronger in the complete experience, not because it
has a longer checklist.

### 5.1 Table stakes

- Reliable set/repetition/load entry.
- Previous-performance context.
- Fast exercise search and custom exercises.
- Flexible programmes and schedules.
- Supersets and special set types.
- Rest timers that survive backgrounding.
- Accurate records and trends.
- Bodyweight, measurement, and photo history.
- Cloud backup and conflict-safe sync.
- Apple Watch and Health integration.
- Data export and account deletion.

### 5.2 DEADSET differentiation

- The strength map is a primary tab, not a buried analytics card.
- Every grey muscle explains whether it lacks a programme exercise or merely a
  logged working set.
- Programme setup collects the starting loads needed to make the logger useful
  before the first session.
- The same exercise repeated across days asks for a load once and stays
  consistent everywhere.
- Every strength colour is explainable from real lifts.
- The next action is visible: add a missing movement, log evidence, or progress
  the weakest lift.
- Rank and competition are woven into training without corrupting workout
  truth.
- Haptics create a coherent tactile language.

### 5.3 Quality bar

- No core tab terminates the app.
- No screen traps the user behind an invalid value they actually entered.
- No feature appears complete while being a static mock.
- No empty state is a dead end.
- No loading state causes a second accidental submission.
- No destructive action occurs without a clear, recoverable confirmation when
  recovery is practical.
- Every supported route works with zero data, typical data, large data, old
  migrated data, offline state, and slow synchronization.

---

## 6. Information architecture

Use five persistent bottom actions:

1. **Train** — today, readiness, and starting a workout.
2. **Plan** — weekly schedule, programmes, exercise choice, and working loads.
3. **Record** — a central, unmistakable start/continue workout action.
4. **Strength** — the body map, muscle grades, overall score, and next weak
   point.
5. **You** — identity, competition summary, settings, account, and history
   entry points.

Strength must be reachable in one tap from anywhere with the bottom navigation.
The former all-purpose Progress screen remains available as “All progress” from
Strength and relevant deep links.

Do not put the strength body map below weekly review cards, Apple Fitness,
autopilot, roadmaps, or generic analytics. It is the hero.

### 6.1 Strength screen hierarchy

Above the first scroll boundary:

- page identity: “Your Strength”;
- front and back body views at a readable size;
- current overall score and tier, if evidence exists;
- an honest empty or partial-evidence explanation;
- direct action for the most useful next step.

Below the hero:

- muscle status grid;
- overall tier ladder;
- per-muscle details;
- lift-by-lift evidence;
- weakest movement and next-tier target;
- start-versus-now comparison when there is a valid baseline;
- route to all progress history.

### 6.2 Plan screen hierarchy

- Today and the weekly rhythm first.
- Each day shows training/rest, exercises, muscle coverage, duration estimate,
  and completeness.
- Editing a day never loses previously entered loads or exercise configuration.
- Programme creation is a guided sequence, not a wall of fields.
- The final review shows weekly muscle coverage and specific gaps.

### 6.3 Train screen hierarchy

- “Start today’s workout” is the primary action.
- Show schedule context, planned duration, exercise count, and any blocking
  setup requirement.
- Do not bury the start action beneath content feeds.
- If a session is active, the app always makes continuing it obvious.

---

## 7. Programme setup and working-weight wizard

Working loads are part of programme setup, not a last-minute workout modal.

### 7.1 When it appears

- During initial programme/schedule setup, after exercises are selected.
- Immediately after an existing athlete upgrades into a version that requires
  missing loaded-exercise weights.
- After adding a new loaded exercise to an existing programme.
- Not for bodyweight-only, timed-only, or distance-only movements that do not
  require an external load.

### 7.2 Interaction model

- Show one exercise per step.
- Display progress: “3 of 8.”
- Keep the exercise name, relevant days, current unit, and contextual hint in
  view above the keyboard.
- Prefill a previous or known working load where trustworthy.
- Allow decimal values.
- Validate on submit with a precise inline message.
- Preserve answers when moving backward.
- Save atomically at the end.
- Provide one success haptic only after persistence succeeds.
- Use a subtle selection haptic for Next and Back.
- Use an error haptic only for rejected input.

### 7.3 Deduplication

- Canonical identity is the exercise id, not the visible exercise name.
- Ask once when the same exercise appears on multiple programme days.
- Apply that answer to every scheduled occurrence and the active programme.
- If variants have distinct ids, do not merge them just because the names are
  similar.
- A later intentional edit to one occurrence must have an explicit “this day”
  versus “all occurrences” choice.

### 7.4 Units and load types

- Store canonical kilograms where the existing state expects kilograms.
- Convert only at the presentation boundary.
- Support kg and lb without cumulative conversion drift.
- Preserve exercise bar weight and plate availability.
- Do not ask for a fake load on duration or distance work.
- Assisted-bodyweight movements must clearly distinguish assistance from
  added load.

### 7.5 Completion review

Show:

- all selected days;
- all unique exercises;
- starting working load for loaded movements;
- sets and target reps;
- muscle coverage;
- grey uncovered muscle groups;
- a plain explanation that uncovered muscles will show “No exercises set for
  that” on the strength map.

---

## 8. Strength map and score specification

The strength map is a map of demonstrated strength, not a body-transformation
promise, soreness map, recovery map, or muscle-size prediction.

### 8.1 Muscle states

Every supported muscle region must be in exactly one state:

1. **No exercise in programme**
   - neutral grey;
   - text: “No exercises set for that”;
   - action: “Add an exercise” deep-linked to a filtered programme editor.
2. **Exercise programmed, no valid evidence**
   - darker active grey;
   - text: “Exercises set · log weighted sets” or the correct mode-specific
     equivalent;
   - action: start or open the next scheduled workout.
3. **Graded**
   - DEADSET tier colour;
   - tier name, score, number of contributing lifts;
   - action: open the lift evidence and next target.

Never colour an untrained muscle as Beginner merely because Beginner is the
lowest tier. Missing evidence and low demonstrated strength are different.

### 8.2 Evidence

- Use valid record-counting sets only.
- Prefer estimated one-rep max for appropriate weighted strength movements.
- Use mode-appropriate standards for repetitions, duration, or distance where
  the repository already supports them.
- Keep the calculation deterministic and unit-tested.
- Bodyweight-relative grading must use the athlete’s bodyweight at the relevant
  time where history supports it; otherwise disclose the limitation.
- A single extreme or malformed set must not silently dominate the entire map.
- Define and test sane bounds without deleting the underlying athlete record.

### 8.3 Muscle aggregation

- Aggregate from exercise evidence to muscle evidence transparently.
- Do not let one excellent lift carry all other movements for a muscle without
  clearly documenting the rule.
- Show contributing exercises.
- Show the weakest contributing lift when that creates a useful next action.
- If primary and secondary muscles receive different weights, centralize and
  test those weights.
- Custom exercises need explicit muscle metadata before contributing.

### 8.4 Baseline and comparison

- Never show a fake “Start” body based on today’s plan.
- A baseline requires enough real historical data.
- Label exact periods, for example “First 90 days” and “Now.”
- If no baseline exists, show only Now and explain when comparison unlocks.
- The body should remain large enough to distinguish front/back regions on an
  iPhone without pinch zoom.

### 8.5 Explanation layer

Provide an info sheet that answers:

- what the colours mean;
- which sets count;
- how bodyweight affects comparisons;
- why a muscle can be grey;
- why the score can move after a bodyweight update;
- why a changed programme does not rewrite historical strength;
- why the map is not medical advice or a physique forecast.

### 8.6 Sharing

Create original DEADSET share cards:

- current front/back map;
- overall score and tier;
- strongest and most improved muscles;
- exact date range;
- private by default for bodyweight and measurements;
- no competitor branding or copied card layouts.

---

## 9. Workout logger excellence

The logger is successful when a serious lifter can use it between hard sets
without thinking.

### 9.1 Set row

Each row must expose only what is necessary for the exercise mode:

- set number/type;
- previous set or ghost value;
- target;
- weight when required;
- repetitions, duration, or distance;
- optional RPE/RIR;
- completion control.

Use large tap targets and predictable keyboard focus. Completing a set must not
scroll the row away before the athlete sees confirmation.

### 9.2 Smart defaults

- Start from programme working load.
- Then prefer recent valid performance when appropriate.
- Never carry a value across different exercise ids by matching text.
- Reuse repetitions and load intelligently for a newly added set.
- Do not overwrite a value the user explicitly changed.
- Explain an automatic progression change in one short line.

### 9.3 Existing advanced behavior to preserve

- ghost sets;
- RPE-aware progression;
- warm-up ramp;
- plate calculator and per-exercise bar weight;
- supersets and round-robin rest;
- warm-up, drop, and failure set types;
- add, swap, remove, and reorder during a workout;
- editable/deletable sets;
- exercise rest and cues;
- time and distance modes;
- mode-appropriate records.

### 9.4 Add or close parity gaps only after an audit

Audit, then implement missing behavior in isolated slices:

- top set and back-off set labels;
- per-set notes only if workout/exercise notes do not cover the real need;
- warm-up calculator entry point from the weight field;
- plate calculator entry point from the keyboard accessory;
- past-workout editing with record recalculation;
- repeat a past workout;
- save a completed workout as a programme template;
- routine folders and archive;
- data export including timers and notes;
- exercise instruction media with rights-safe original/licensed assets.

Do not create duplicate implementations if equivalent behavior already exists.

### 9.5 Finish flow

On completion:

- persist exactly once;
- close timers and Live Activities;
- publish Watch/widget state;
- export to Health when enabled;
- award records, grit, milestones, and duel progress deterministically;
- show a concise summary;
- offer notes/reflection and a share card;
- use a distinct workout-complete haptic;
- make undo/edit routes obvious;
- queue/sync safely when offline.

---

## 10. Schedule and programme intelligence

Replace vague “AI coaching” with transparent, deterministic assistance.

### 10.1 Inputs

- training goal;
- experience;
- days per week;
- available equipment;
- session duration;
- preferred and excluded exercises;
- injuries/limitations as user-entered cautionary context, never medical
  diagnosis;
- recent set performance;
- RPE/RIR;
- missed sessions;
- progression history;
- muscle coverage.

### 10.2 Outputs

- an initial schedule;
- exercises, sets, reps, and starting loads;
- deterministic progression suggestions;
- deload suggestion after a clearly documented pattern;
- substitutions based on equipment and movement pattern;
- uncovered-muscle warnings;
- time-budget warnings;
- a human-readable “Why this changed” explanation.

### 10.3 Progression rules

- Centralize progression math.
- No feature invents its own “next weight” rule.
- Respect smallest available plate increment.
- Use RPE only when the athlete records it.
- Handle missed target, partial completion, and repeated stalls.
- A deload is a suggestion with a reversible preview, not a silent rewrite.
- Never mutate already completed sessions when a programme progresses.

### 10.4 Schedule changes

- Drag/reorder or explicit day reassignment must preserve exercise settings.
- Moving a workout should update reminders and cancel obsolete queued ones.
- Turning a reminder category off cancels pending notifications from that
  category.
- Toggling rival alerts back on must resume fetching/scheduling rather than
  being blocked by a one-time “already ran” flag.

---

## 11. Progress and history

The “All progress” destination should be comprehensive without hiding the
strength map.

### 11.1 Workout history heatmap

- Show recent intensity and all-time year-by-year history.
- Count real completed workout days.
- Use volume intensity only where volume is meaningful.
- Timed and distance sessions must not acquire fake volume.
- Label workout counts per year.
- Support very long histories without blocking the main thread or creating an
  enormous DOM.
- Reject or safely ignore malformed date strings when building calendar ranges.
- Put sensible bounds around years to avoid corrupted state generating an
  infinite or multi-century loop.

### 11.2 Exercise progress

- best weight;
- estimated 1RM;
- total volume;
- rep-range records;
- frequency;
- top set trend;
- recent history;
- next programme target;
- mode-appropriate duration/distance records.

### 11.3 Body progress

- bodyweight;
- measurements;
- progress photos;
- side-by-side comparison;
- privacy-safe local/cloud handling;
- clear delete behavior;
- no misleading causal claims between a workout and body composition.

### 11.4 Training intelligence

Every insight must be deterministic, data-gated, and actionable. If there is
not enough evidence, render an honest unlock explanation rather than a confident
claim.

Examples:

- training rhythm;
- volume and frequency by muscle;
- rep-zone mix;
- stale movement patterns;
- consistency trend;
- best time/day patterns;
- progression-ready lifts;
- weakest graded muscle;
- missed programme coverage.

---

## 12. Haptic language

Audit every meaningful interaction. Do not vibrate for every tap.

Required semantic vocabulary:

- navigation selection: subtle selection tick;
- picker/value change: subtle selection tick, rate limited;
- valid set logged: medium confirmation;
- warm-up/drop set logged: lighter confirmation;
- rejected input: error notification;
- undo/delete: rigid single response;
- rest countdown final ticks: light, sparse ticks;
- rest complete: strong success notification felt through a pocket;
- PR: unmistakable celebratory pattern;
- rank/milestone: rising pattern distinct from PR;
- programme setup complete: success notification distinct from workout finish;
- workout complete: deliberate finishing sequence.

Implementation requirements:

- The native plugin must be registered in the active Capacitor view
  controller.
- Keep generators alive and prepare them before use.
- Dispatch UIKit feedback on the main queue.
- Catch bridge failures in JavaScript.
- Keep haptics on by default for a missing preference, off only when explicitly
  disabled.
- Provide a Settings test action that produces an immediate sample.
- Test the preference and semantic routing in TypeScript.
- Verify on a physical iPhone; Simulator evidence is insufficient for feel.

---

## 13. Apple Health, Watch, Live Activities, and widgets

### 13.1 HealthKit safety

- Any HealthKit API capable of raising an Objective-C exception must receive
  documented, validated inputs.
- Activity-summary date components must be a complete Gregorian day including
  era, year, month, and day.
- Permission denial produces a useful empty state, never app termination.
- Partial permissions produce partial data rather than an all-or-nothing
  failure.
- Do not infer authorization from a request callback alone; query behavior and
  HealthKit privacy rules must be respected.
- Health refresh must not block rendering of the rest of Progress.

### 13.2 Watch

- Continue an active phone workout.
- Log and undo sets idempotently.
- Show the current movement, target, previous performance, and rest state.
- Add the last four sessions for the current movement only after payload size,
  stale-state, and deduplication tests pass.
- Work sensibly when temporarily disconnected.
- Never create a second authoritative workout timeline on the Watch.

### 13.3 Live Activities

- Rest timer derives from a deadline.
- Workout activity updates at meaningful events, not per second.
- End activities on workout finish/cancel.
- Reconcile stale activities on app launch.

### 13.4 Widgets

- Publish snapshot changes after relevant state mutations.
- Keep placeholder, redacted, and empty states useful.
- Do not poll widget timelines.
- Protect shared schema compatibility across app and extension versions.

---

## 14. Competition and social

Competition must reward real training without encouraging data fraud.

### 14.1 Core loop

- workout truth creates verified local stats;
- authoritative persistence validates competitive inputs;
- stats update ranks, duels, leagues, crews, and challenges;
- users see exact, understandable movement;
- share cards turn progress into acquisition.

### 14.2 Fairness

- Make ranked stats server-authoritative.
- Do not trust client-written grit totals or public leaderboard totals.
- Define how edited/deleted workouts affect competition.
- Detect impossible values for review without deleting legitimate advanced
  athlete data.
- Preserve a clear audit trail.

### 14.3 Rival notifications

- Real-time rival pushes use APNs, not polling.
- Enforce opt-out server-side.
- Rate-limit per opponent.
- Delete dead tokens after APNs 410.
- Stop after a duel ends.
- Deep link to the relevant challenge.
- Cancel scheduled local rival nudges when the setting is turned off.
- Resume correctly after it is turned back on.

### 14.4 Social safety

- Report, block, mute, and remove content routes must work.
- Private workout/body data stays private unless deliberately shared.
- Avoid public bodyweight or progress photos by default.
- Prevent harassment through notification and challenge spam limits.

---

## 15. Visual and interaction design system

### 15.1 Brand

- Dark-only.
- Core DEADSET red: preserve the repository’s actual token; do not introduce a
  competing red from this document if code and brand assets differ.
- Heavy italic wordmark.
- Industrial, sharp, high-contrast, but not visually noisy.
- Strength tiers may use additional colours only with accessible text labels.

### 15.2 Layout

- Respect safe areas and keyboard insets.
- Minimum interactive target: 44 by 44 points.
- Keep primary actions thumb reachable.
- Avoid nested vertical scroll containers.
- Avoid full-screen walls of cards.
- Use progressive disclosure for advanced detail.
- Keep one dominant action per screen.

### 15.3 Typography and numbers

- Use tabular figures for weights, reps, time, scores, and ranks.
- Units stay attached and unambiguous.
- Do not rely on uppercase at tiny sizes for body copy.
- Dynamic Type must not make controls overlap or truncate essential values.

### 15.4 Motion

- Motion communicates hierarchy and state change.
- Respect Reduce Motion.
- Never delay a set log for animation.
- Celebrations can layer above the saved result, not gate persistence.

### 15.5 Empty/error/loading states

Every state must explain:

- what happened;
- whether data is safe;
- the most useful next action;
- how to retry if retry is meaningful.

No generic “Something went wrong” when a safe, specific error can be shown.

---

## 16. Accessibility

- VoiceOver labels describe action and current state.
- The muscle map has a text equivalent listing every muscle and status.
- Colour is never the only carrier of a tier or missing state.
- Respect Dynamic Type, Increase Contrast, Reduce Motion, and Show Button
  Shapes/Borders where applicable.
- Keyboard focus is deterministic in setup and workout entry.
- Alerts do not steal focus before the user can hear context.
- Charts expose summary text and selected-point values.
- Haptics are supplemental; every event still has visible feedback.
- Test at the largest practical text size and with VoiceOver on a device.

---

## 17. Reliability and crash prevention

### 17.1 Core route contract

For every bottom tab and workout route, test:

- fresh install;
- signed-out and signed-in state where applicable;
- no programme;
- incomplete programme;
- zero workouts;
- typical history;
- multi-year/large history;
- malformed legacy date or numeric values;
- Health permissions allowed, denied, and partial;
- offline launch;
- interrupted synchronization;
- background/foreground transition;
- memory pressure;
- app upgrade with existing local state.

### 17.2 Crash evidence

When a physical-device crash is reported:

1. Read the current device crash report when access exists.
2. Record capture time, exception type, triggering thread, and first app frame.
3. Do not guess from the screen name alone.
4. Add the narrowest safe fix.
5. Add a regression check where the layer permits it.
6. Rebuild and install the signed app.
7. Re-run the exact failing flow on the device.
8. Confirm no fresh crash report was produced.

### 17.3 Error boundaries and observability

- React errors should produce a recoverable DEADSET error surface with a report
  id, never a blank page.
- Native crashes require symbolication and build-number correlation.
- Avoid sending health/workout content to analytics or diagnostics unless the
  privacy policy and consent clearly allow it.
- Use structured, privacy-safe breadcrumbs around route entry, Health calls,
  sync transitions, and workout finish.

---

## 18. Performance

Set budgets and measure them on a representative physical device.

- Bottom-tab response feels immediate.
- Starting a workout does not wait on network synchronization.
- Set completion persists locally before nonessential work.
- Large histories do not create quadratic scans on every render.
- Use memoized indexes for repeated exercise-history queries.
- Avoid huge spread calls such as `Math.max(...veryLargeArray)` when state size
  is unbounded.
- Virtualize genuinely long lists.
- Decode/downscale progress photos before persistence.
- Keep local state parsing and serialization off hot interaction paths where
  practical.
- Do not render every year/day/chart point if it is outside the visible or
  requested detail.
- Test startup, Strength, Progress, Plan, workout open, set log, and workout
  finish with large realistic fixtures.

---

## 19. Offline, sync, and data integrity

- Workouts remain fully loggable offline.
- Local writes are durable before sync starts.
- Sync is idempotent.
- Every entity has stable identity.
- Conflict rules are explicit by entity type.
- Never replace a richer finished session with an older sparse copy.
- Never merge arrays by display name.
- Deleted records use a strategy that prevents resurrection after another
  device syncs.
- Migrations are versioned, idempotent, and covered by old-state fixtures.
- Export provides the athlete’s data in a usable format.
- Account deletion documents local and remote effects.

---

## 20. Privacy, safety, and App Store quality

- Collect only necessary health and identity data.
- Explain each Health permission at the moment it becomes useful.
- Avoid diagnostic logs containing workout notes, health values, tokens,
  email, or progress photos.
- Protect tokens and secrets; never commit APNs `.p8` keys.
- Keep entitlement files consistent across configurations.
- Keep privacy manifest and App Store disclosures current.
- Do not present strength standards as medical advice.
- Do not diagnose injury, prescribe rehabilitation, or imply physique outcomes.
- Provide support, privacy, terms, report, block, account deletion, and data
  export routes that actually work.

---

## 21. Retention and monetization without product damage

Design for durable value, not manipulative noise.

### 21.1 Activation

An activated athlete has:

- a profile and bodyweight where grading requires it;
- a weekly schedule;
- exercises covering intended muscles;
- starting working loads;
- one completed workout;
- a partially illuminated strength map;
- one clear next action.

Measure drop-off between those milestones with privacy-safe product events.

### 21.2 Habit loop

- plan reminder;
- low-friction workout;
- tactile confirmation;
- immediate PR/map/rank consequence;
- weekly review;
- competition/share moment;
- next scheduled action.

### 21.3 Premium value

Premium should deepen interpretation, personalization, history, and competition
without making free logging unreliable.

Potential web-sold Pro boundaries, subject to the existing product strategy:

- advanced lift-by-lift strength evidence;
- deeper historical comparisons;
- adaptive programme options;
- advanced competition formats;
- rich exports and reports;
- premium widgets or customization that still respects App Store rules.

Do not cripple data access, basic history, or workout logging to manufacture a
paywall.

### 21.4 Notification restraint

- Every category has an explicit setting.
- Off means pending notifications are canceled and server fan-out is blocked.
- Use local scheduling for known future events.
- Use push only for genuinely remote events.
- Rate-limit aggressively.
- Never send generic guilt copy when a specific useful action exists.

---

## 22. Shareability and content engine

Build product surfaces that naturally generate original social content:

- first grey-to-ranked muscle reveal;
- strength map start-versus-now;
- all-time workout heatmap;
- PR and rep-range record;
- rank promotion;
- duel comeback;
- weekly consistency;
- “weight lifted as” playful equivalents, with careful unit math;
- weakest-muscle improvement;
- completed programme block.

Requirements:

- cards work in 9:16 and common story dimensions;
- athlete chooses what personal data appears;
- no automatic posting;
- no competitor screenshots, fonts, assets, or copied phrasing;
- deep link lands on a useful public/private destination;
- rendered output is visually tested, not inferred from DOM code.

---

## 23. Product analytics

Use privacy-safe events to answer product questions, not to collect everything.

Suggested event families:

- onboarding step viewed/completed;
- programme created;
- working-weight wizard started/completed/error;
- muscle status tapped;
- missing-muscle exercise added;
- workout started;
- first set logged;
- workout completed/abandoned;
- PR earned;
- Strength tab opened;
- strength map shared;
- weekly review opened;
- challenge joined/completed;
- notification category enabled/disabled;
- Health connected/refresh failed by coarse error class;
- sync queued/completed/conflicted.

Never place raw health values, notes, progress-photo data, access tokens, or
personally identifying content in event properties.

Define activation, week-one retention, programme adherence, completed workouts,
Strength-tab return, share conversion, challenge participation, and Pro
conversion before creating dashboards.

---

## 24. Competitive parity audit procedure

Do not rely on a memory-based checklist. Repeat this audit at the start of each
major product cycle.

1. Read current official Stronger site and App Store listing.
2. Record evidence date and direct URL.
3. Extract user outcomes, not copied UI elements.
4. Search DEADSET for an existing equivalent.
5. Run the equivalent flow where possible.
6. Classify each item:
   - proven and polished;
   - exists but hard to discover;
   - exists but unreliable;
   - partially implemented;
   - missing and strategically important;
   - intentionally different;
   - intentionally excluded.
7. Score impact on activation, workout completion, retention, trust,
   differentiation, revenue, engineering risk, and maintenance.
8. Select one vertical slice.
9. Define acceptance criteria before editing.
10. Re-audit only after the slice is verified.

An intentionally different solution can be superior. “Same looking” never
means copied; it means equally clear, equally fast, and equally complete for
the underlying user need.

---

## 25. Prioritized delivery plan

Do not start all phases simultaneously.

### Phase 0 — stop crashes and data loss

- Reproduce physical-device crashes using crash reports.
- Fix all bottom-tab termination paths.
- Exercise Health permission combinations.
- Add legacy/large-state route fixtures.
- Verify no new crash reports after the exact flow.
- Audit local writes, session finish, and migrations for loss risks.

Exit gate: all core routes survive the route contract on device; no known data
loss path remains open.

### Phase 1 — make Strength the product hero

- Keep Strength in the bottom navigation.
- Put the body map first.
- Implement the three muscle states and text equivalents.
- Link grey states to programme fixes.
- Make baseline-versus-now honest and readable.
- Add an explanation sheet and accessibility summaries.
- Add original share cards.

Exit gate: a new or existing athlete can explain every colour and act on every
grey region without hunting through another screen.

### Phase 2 — perfect programme setup

- One-step-at-a-time exercise selection and weight entry.
- Deduplicate repeated exercises.
- Preserve answers across navigation.
- Correct units and load modes.
- Weekly coverage review.
- Immediate migration wizard for existing athletes with missing loads.
- Setup haptics and error copy.

Exit gate: a newly created programme can begin a workout with useful defaults
and no last-minute wall of invalid fields.

### Phase 3 — logger speed and parity

- Measure set-log latency and tap count.
- Fix keyboard/focus friction.
- Audit top/back-off sets, notes, calculators, history editing, repeating
  workouts, and template saving.
- Close only real gaps.
- Verify timers across lock/background/resume.

Exit gate: the full target workout is faster and less error-prone than paper or
the competitor flow in a documented task test.

### Phase 4 — progress depth

- Harden all-time heatmap for malformed and huge data.
- Improve lift histories and mode-specific records.
- Connect insights to actions.
- Make photos, measurements, and weight reliable and private.
- Establish performance budgets.

Exit gate: Progress handles multi-year state without termination or visible
jank and never overstates evidence.

### Phase 5 — competition trust

- Make ranked stats server-authoritative.
- Finish real-time APNs rival pushes with opt-out and rate limiting.
- Complete abuse/report/block paths.
- Verify duel end/edit/delete semantics.

Exit gate: competition cannot be trivially spoofed from the client and alert
preferences are honored end to end.

### Phase 6 — organization and ecosystem

- Routine folders/archive/search.
- Watch per-exercise history.
- Better exports.
- Health partial-permission UX.
- Widget and Live Activity reconciliation.

Exit gate: large programme libraries and multi-device use remain fast,
predictable, and recoverable.

### Phase 7 — accessibility, polish, and release evidence

- VoiceOver audit.
- Dynamic Type and display accommodations.
- Haptic device audit.
- Reduce Motion/contrast audit.
- App Store strict check.
- Signed archive and physical-device smoke suite.
- Release notes tied to verified behavior.

Exit gate: release checklist contains evidence, not adjectives.

---

## 26. Test matrix

### 26.1 Logic tests

- working-set and record classification;
- unit conversion and decimal load handling;
- duplicate exercise load propagation;
- strength tiers at every boundary;
- missing/programmed/graded muscle classification;
- baseline date calculation;
- malformed dates and huge history bounds;
- timed/distance zero-volume invariant;
- progression and deload rules;
- notification rescheduling and cancellation;
- haptic preference and semantic function routing;
- idempotent Watch actions;
- session finish deduplication;
- sync migration fixtures.

### 26.2 Component tests

- weight wizard forward/back/error/finish;
- Strength zero/partial/full evidence;
- all-progress Health loading/denied/partial/success;
- programme review coverage;
- set row per tracking mode;
- active workout resume;
- empty/error/loading surfaces;
- largest supported histories.

### 26.3 Native build checks

- phone target compiles and signs;
- widget/Live Activity extension compiles;
- Watch target compiles;
- App Group and entitlements align;
- native plugin registration is present;
- no unreferenced Swift source;
- current minimum OS constraints hold.

### 26.4 Physical-device flows

- clean launch;
- every bottom tab;
- Strength first open;
- All progress with Health enabled;
- Health denied and partial;
- programme weight wizard decimal entry;
- repeated exercise propagation;
- start, background, resume, and finish workout;
- set log/undo/PR/rest-complete haptics;
- lock-screen timer;
- Watch set log and duplicate delivery;
- offline workout then sync;
- kill/relaunch active workout;
- large history open and scroll;
- fresh crash-log check after smoke suite.

### 26.5 Accessibility flows

- VoiceOver order and actions;
- map text alternative;
- largest text size;
- Increase Contrast/Show Button Shapes;
- Reduce Motion;
- haptics off;
- keyboard-only web smoke where applicable.

---

## 27. Acceptance criteria for the immediate reported defects

### Progress crash

- Opening All Progress with Apple Health enabled does not terminate the app.
- Health activity-summary queries use complete Gregorian date components.
- Denial or query failure returns a recoverable empty/partial state.
- The exact physical-device route is repeated after installation.
- No new matching DeadSet crash report appears after the test.

### Strength discoverability

- Strength is a persistent bottom action.
- One tap from any main tab opens the map.
- The map appears before secondary analytics.
- “All progress” remains directly accessible.
- Bottom navigation announces the correct selected tab to assistive technology.

### Haptics

- Bottom-tab changes produce a subtle selection haptic on a physical iPhone.
- Set, PR, rest, undo, setup-complete, and workout-complete events remain
  semantically distinct.
- The Settings toggle immediately demonstrates the chosen state.
- Turning haptics off silences all semantic functions without breaking flows.

---

## 28. Required working method for every slice

1. State the one outcome being changed.
2. Inspect repository and user changes.
3. Preserve unrelated dirty work.
4. Read the architecture brief and relevant tests.
5. Reproduce the issue or establish a measurable baseline.
6. Write acceptance criteria.
7. Implement the smallest coherent vertical slice.
8. Add tests for new logic and regressions.
9. Run focused tests.
10. Run the full checks.
11. Build native targets when touched.
12. Install and exercise the exact phone flow when authorized and available.
13. Check for fresh crash logs after a crash fix.
14. Review the diff for accidental data-model or brand changes.
15. Commit one descriptive unit of work.
16. Report verified facts, limitations, and the next highest-value slice.

Do not mix a crash fix, large visual redesign, database migration, and social
backend rewrite into one commit.

---

## 29. Required commands before “done”

At minimum:

```sh
npm run check
node scripts/appstore-check.mjs
```

When Swift/native behavior changes, also run an appropriate `xcodebuild` for
the actual workspace/project and scheme. For a release candidate, build/sign
the phone app and all embedded targets. If a physical device is available,
install the exact build and run the relevant flow.

If any command cannot run, do not hide it. Say what prevented it.

---

## 30. Final response contract

Lead with outcome. Include:

- what user-visible behavior changed;
- root cause for defects;
- exact verification performed and results;
- whether a signed app was installed on the phone;
- what was not verified;
- any safe next step that remains.

Avoid:

- “should work” presented as proof;
- “flawless”;
- vague “all bugs fixed” claims;
- a giant list of files without explaining the behavior;
- claiming competitive parity without a dated evidence matrix;
- claiming device verification from simulator or compile output alone.

---

## 31. Explicit do-not-do list

- Do not copy Stronger’s interface, language, illustrations, calculations,
  assets, or trade dress.
- Do not add AI/model calls.
- Do not add native iOS purchase UI or links.
- Do not change timed/distance `reps: 0`.
- Do not bypass `isWorkingSet` or `countsForRecords`.
- Do not use controlled inputs in affected iOS entry flows.
- Do not build tick-based timers.
- Do not call `navigator.vibrate` an iOS haptic implementation.
- Do not create separate haptic waveforms at random call sites.
- Do not make the Watch authoritative.
- Do not let widgets read imaginary access to WKWebView state.
- Do not add a Swift file without project membership.
- Do not overwrite or reset athlete data to solve a rendering bug.
- Do not silently recolour missing evidence as a low rank.
- Do not use volume calculations for timed/distance performance.
- Do not send private health or workout content into analytics logs.
- Do not notification-spam rivals.
- Do not leave queued notifications after opt-out.
- Do not gate basic reliable logging to make Premium feel valuable.
- Do not launch an enormous rewrite under the banner of “perfection.”
- Do not claim unrun verification.

---

## 32. Final product test

The app is ready for a serious release candidate only when this story is true
on a real iPhone:

> An existing athlete updates the app without losing history. DEADSET opens
> their programme-weight wizard one exercise at a time, accepts decimals, asks
> once for repeated movements, and saves those loads everywhere they belong.
> They tap Strength directly from the bottom bar and feel the selection. The
> front/back map is the first meaningful surface. Programmed muscles without
> evidence are grey and say what to do; missing muscles say “No exercises set
> for that.” They open the programme gap, add a movement, return, and see the
> status change without a fake grade. They start today’s workout with useful
> loads already filled, log a set with an immediate haptic, background during
> rest, return to an accurate timer, finish once, and see the real map/rank/PR
> consequence. They open All Progress with Health connected and the app does
> not terminate. Their multi-year heatmap is accurate. They can understand,
> share, export, edit, or delete their data, and every competitive outcome is
> based on the same workout truth.

Build toward that story one proven slice at a time.
