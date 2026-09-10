# Stronger + Liftoff → DEADSET's next competitive update

Researched 10 September 2026. Product baseline: current DEADSET 1.3 work, built on shipped 1.2,
including build 161's weekly momentum, original branding and cinematic entry. No AI features added.

## What was examined—and what was not

The supplied screenshots identify **Stronger / @strongermobile** and **Liftoff – Ranked Gym
Workouts** (GymBros Inc.). I examined their current public feature pages, App Store descriptions,
visible reviews and Liftoff's detailed FAQ. This is not a hands-on audit of every screen, a
representative review survey, or access to either company's retention, revenue or active-user data.
The screenshot's social audience and advertised membership counts are not proof of paying users.
Ratings, chart positions and offers vary by country and time. No exact live in-app price was verified.

## Stronger: the product promise

Stronger advertises a bodyweight/sex-adjusted Strength Score, muscle-level ranks, quick logging,
automatic PRs, rest timers, adaptive/custom routines, group challenges, feeds, an exercise catalogue,
analytics, measurements, and Apple Health/Google Fit connections. Its feature page also advertises
AI routines; those are deliberately outside DEADSET's scope.
[Published features](https://www.strongermobileapp.com/features)

Its App Store description offers monthly/annual Pro subscriptions and a seven-day trial, with
limited functionality remaining free. Sampled reviews value visual progress and workout continuity.
They also describe confusion around editing, saved routines and exercise coverage; one reviewer
explicitly updated an earlier negative review to say their issues were fixed. Those reports do not
establish that the same problems remain in the current release.
[App Store listing and visible reviews](https://apps.apple.com/us/app/stronger-gym-workout-planner/id1621719397)

**Design inference:** its strongest selling point is translating a diary into an immediately readable
answer: “What changed in my strength?” The map is a useful social artefact because the before/after
is legible without a long explanation. That is a product hypothesis, not measured causal evidence.

## Liftoff: the progression game

Liftoff advertises exercise ranks, bodygraphs, leaderboards, friend activity, quests, achievements,
custom exercises/presets, sharing, nutrition features and Apple Watch support. Its shop includes
virtual currency and cosmetics. A visible reviewer describes next-rank motivation but questions
inconsistent ranks across exercises and wants more progression after reaching the top tier. Another
mentions limitations when heavier equipment is unavailable. These are individual reports, not a
verified audit of its scoring algorithm.
[App Store listing and reviews](https://apps.apple.com/us/app/liftoff-ranked-gym-workouts/id6448081563)

Its FAQ is unusually useful: ranks use bodyweight and estimated 1RM; its standalone rank calculator
does not save results. It describes a three-day workout-gap streak rule, purchasable streak restores,
four-month seasons, privacy controls, exercise-specific logging instructions, and optional Strava
sharing. Its website places ranks at the centre of the pitch.
[FAQ](https://liftoffrank.com/en/faq), [official website](https://liftoffrank.com/)

**Design inference:** visible distance to the next achievement makes the next visit feel purposeful.
DEADSET should adopt clear progress and optional discovery—not make users buy back their training
history, invent verified scores, encourage excessive workouts, or require public posts to value a lift.

## Feature comparison and implementation decisions

“Existing” means the relevant implementation is already in this repository, not that every live
production dependency was independently retested during this pass.

| Experience | DEADSET before this pass | Decision in this pass |
| --- | --- | --- |
| Signature muscle ranking | Strength Map and before/after sharing | Preserve the actual diagrams and add prominent roadmap/record shortcuts |
| Next-rank motivation | Tier thresholds existed inside individual rows | Add a sorted, filterable roadmap across lifts |
| Explain a rank | Aggregate values, limited source inspection | Add dated record evidence, source labels and mismatch warnings |
| Safe experimentation | Separate tools, no unified rank preview | Add a read-only “What if?” panel that cannot write stats |
| Broader personal progress | Logger supports reps, duration and distance | Add a searchable record book with four separate metrics |
| Recent lift comparison | Existing lift-history tools | Add six-date comparable-performance summaries alongside evidence |
| Personal goals after top rank | Existing PR Roadmap | Preserve it; fix pounds input, all-time-best validation, layout and haptics |
| Streaks and missions | Daily streaks, quests, build 161 weekly streak | Preserve them; do not introduce a competing streak definition |
| Muscle development guidance | Muscle Lab and deterministic playbooks | Link missing ranked areas directly into those existing tools |
| Programme organisation | Routine Vault, folders, copies and archive | Preserve, do not duplicate |
| Fast logger | Ghost sets, notes, rest, supersets, editing and timers | Preserve all tracking conventions and history |
| Exercise discovery | Forgiving Exercise Finder and catalogue | Preserve search, custom movements and active-plan integration |
| Social competition | Friends, crews, duels, ranks and sharing | Preserve; server-authoritative scores remain a separate backend priority |
| Apple Watch/Health/widgets | Native implementations already present | Build with them intact; new physical-device tests still required |
| Cosmetic economy/consumables | Existing competitive rewards | No new purchases or consumables introduced |
| Third-party social export | Existing share flows | Strava is deferred: requires a real registered integration and consent flow |

## Implemented: Performance Lab

1. Two prominent entry buttons immediately beneath the Strength heading.
2. Lazy-loaded Lab: no new service calls or heavy work on cold app launch.
3. Accessible Rank roadmap / Record book tabs with keyboard navigation.
4. Search across the athlete's recorded lift names.
5. Wrapping muscle filters, without a sideways filter carousel.
6. Bounded result lists with explicit Show more.
7. Relative-gap ranking: find which benchmark is closest, without prescribing a load.
8. Current tier, next tier, measured value and target benchmark together.
9. Exercise-specific versus generic muscle-group benchmark labels.
10. Top-tier state that points back to continuing personal progress.
11. Separate estimated-max, bodyweight-rep, hold and distance records.
12. Dated evidence: completed workout, legacy log, or self-reported check-in.
13. Best-set details and age, including explicit context for older records.
14. Recent best efforts on up to six distinct completed training dates.
15. Change versus the preceding comparable date, without calling two points a trend.
16. A paginated record trail behind each metric.
17. Read-only previews; no synthetic PR, session, rank or programme changes.
18. Decimal point/comma input; proper kg/lb conversion at the display boundary.
19. Weighted previews limited to 1–12 whole reps; no 500-rep rank inflation in the calculator.
20. No invented rank for distance or missing profile calibration.
21. A warning when the existing map's value is unsupported by the valid dated evidence.
22. Links into full lift history and the existing Muscle Lab for missing areas.
23. Haptics, reduced-motion-aware transitions, readable empty states and contained vertical scrolling.

The evidence engine excludes warm-ups/drop sets, unfinished workouts, malformed/future dates and
invalid values; failure working sets count. It deduplicates repeated session IDs and mirrored legacy
entries, retains real repeated sets, and never merges different exercise IDs because their names match.
These controls make the new view honest about its local evidence; they do **not** make it a
server-verified leaderboard or independently verify an athlete's reported performance.

## Useful work beyond competitor parity

The PR goal editor now respects the user's display units while retaining kg in storage, rejects a
target below the all-time recorded best rather than only the latest session, accepts decimal commas,
and keeps the selector and target usable at narrow widths. Existing goals, projections and membership
gates remain; projected dates are explicitly estimates, not promises.

## Still necessary—not claimed shipped

Verification for this package: 50 new regression tests; 760 total tests passing through
`npm run appstore:strict`, including TypeScript, lint, production compilation and readiness checks.
Real React components were tested in isolated browser fixtures at 320/375/393/430px for search,
filtering, keyboard tabs, scroll containment/reset, source details, invalid/decimal previews,
unchanged preview state, pound display, missing-data actions, dismissal and goal input/add/remove.
The goal-editor fixture mocked membership, not real StoreKit. The React review checklist shaped
conditional loading, memoised record indexing, DOM-owned inputs and accessible controls. No
live-customer data or new backend service was required for this package.

1. Server-authoritative public competition, with replay/duplicate validation and abuse tests.
2. Real APNs rival events with server opt-out, rate limiting and physical-device receipt tests.
3. Backup/restore proof on a clean device and recoverable sync diagnostics.
4. Personalised but deterministic return-from-break and time-budget workout previews.
5. Multi-week blocks and rescheduling conflict previews.
6. A documented exercise-standard audit: do not quietly replace historical scoring with a new
   formula. Equipment-specific comparisons need explicit limits and versioning.
7. Real onboarding/purchase/restore/account-deletion tests before submission.
8. Clear acquisition-to-first-workout and week-four-retention measurement, followed by tests of
   onboarding and share-card conversion. No forecast of ten million users is justified yet.

The scale objective is a direction, not an acceptance test. The next question is whether real new
athletes understand their first plan, complete their first session, trust the resulting map and return.
More features should serve those outcomes rather than obscure the logger.
