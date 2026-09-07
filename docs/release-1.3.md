# DEADSET 1.3 — Strength You Can See

Status: in development  
Started: 6 September 2026  
iOS version/build: 1.3 (155)

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
- App Store screenshots and release notes describe only behaviour present in build 155.

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
