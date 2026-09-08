# DEADSET: research-backed update backlog

Researched 8 September 2026. Baseline: current 1.3 work built on shipped 1.2, not the archived app.

## What people actually value

This is a qualitative sample of public reviews and current vendor feature pages, not a representative
survey or a benchmark of installed competitors. A review reports one person's experience; it does
not prove a defect affects every user or remains unfixed. Public review pages mix dates and countries.
Vendor claims below describe their own products, not independent proof of superiority.

- **Strong:** a May 2 review explicitly asks for typo-tolerant exercise search, using “flys” as an
  example. Other visible reviews praise recurring notes and timers, while reporting Watch sync and
  frozen-session problems. This points to discoverability, continuity and reliability—not more
  decoration—as meaningful value. [Strong reviews](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577?platform=ipad&see-all=reviews)
- **Hevy:** sampled reviews praise low-friction logging, previous-workout comparisons, muscle-set
  statistics, custom exercises, consistency history and data export. One reports a Watch sync problem
  resolved by support. [Hevy reviews](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350?platform=iphone&see-all=reviews)
- **Hevy's published feature set:** logging, analysis and social sharing are connected; routines,
  folders and exercise notes are established expectations. DEADSET already has equivalents for many
  of these, so a duplicate screen would not improve it. [Hevy features](https://www.hevyapp.com/features/)
- **Stronger:** visible reviews ask for missing machine/custom exercises and flexible ordering; one
  questions a muscle score. Treat these as reasons to make exercise coverage and score evidence
  inspectable. [Stronger reviews](https://apps.apple.com/ie/app/stronger-gym-workout-planner/id1621719397?platform=iphone&see-all=reviews)
- **Stronger positions itself around** a strength score, muscle map and friend challenges. DEADSET
  should distinguish itself through a trustworthy map-to-plan-to-log loop, not copy its graphics or
  assert that a lifting score measures actual muscle size. [Stronger](https://www.strongermobileapp.com/)
- **Boostcamp:** its published feature set combines programme choice, workout tracking, analytics
  and customisation. Multi-week structure is a useful direction after the core logger is dependable.
  [Boostcamp features](https://www.boostcamp.app/features)

## Implemented in this pass: Exercise Finder

1. Local ranked search instead of a request for each keystroke.
2. Conservative typo tolerance, including a swapped adjacent letter.
3. Exercise vocabulary and abbreviations: DB, BB, RDL, flys/flyes, pecs and more.
4. Search across movement names, primary/supporting muscles and equipment.
5. Built-in and saved exercise browsing while the full catalogue is loading or unavailable.
6. Primary-muscle, specific-equipment and beginner-friendly filters that combine.
7. Dedicated Explore, In my week and Saved/custom collections.
8. Reset/clear controls and a recoverable no-results state.
9. Bounded result rendering with Show more, instead of thousands of initial rows.
10. Accessible detail sheets with anatomy, instructions, cues and explicit external demo search.
11. Add to the real active programme (or schedule), with truthful success/no-plan outcomes.
12. Duplicate protection, visible day membership and preservation of repeated known working loads
    through the already-tested plan update function.
13. Primary anatomy wins over supporting anatomy when converting new catalogue additions.
14. Shared forgiving search in Plan and live exercise replacements, without weakening swap safety.

No existing sessions are rewritten. Existing custom/timed prescriptions are retained. These changes
do not add an AI service, change membership access or alter 1.2 branding/launch animations.

## Next packages: more depth, with acceptance criteria

These are **proposed extensions or verification work**, not claims that they are implemented. Several
underlying features already exist; first audit them rather than creating another version.

| Priority | Package | Definition of a useful completed feature |
| --- | --- | --- |
| P0 | Backup health centre | Show actual last successful backup, pending changes and actionable failures; prove restore to a clean device. |
| P0 | Watch recovery diagnostics | Explain connection state; resume interrupted logging without duplicated sets; test offline/reconnect delivery. |
| P0 | Honest strength-map evidence | Every grade shows contributing working sets, recency and confidence; sparse evidence never looks like a verified elite rank. |
| P0 | Server-validated competition | Accepted sessions determine public rankings; client-edited point totals cannot win a duel. |
| P0 | Import safety preview | Extend existing imports with explicit mapping, unmatched movements, duplicate review and counts before writing history. |
| P1 | Universal pinned exercise notes | Equipment settings follow an exercise across programmes, distinct from notes for just today's workout. |
| P1 | Gym equipment profiles | Save home/hotel/main-gym availability; preview substitutions without applying one machine's load to another. |
| P1 | Time-budget workout preview | Offer a shorter session with clearly listed omissions; require confirmation and preserve the original week. |
| P1 | Multi-week blocks | Progress week-to-week targets, planned easier weeks and block history without duplicating a whole programme manually. |
| P1 | Missed-day rescheduling | Preview where a session moves and what conflicts it creates; never silently stack workouts. |
| P1 | Exercise identity tools | Rename safely and review potential duplicates without merging incompatible equipment or tracking modes. |
| P1 | Personal PR goals | Extend existing goals with rep-specific targets and honest progress; no invented completion date. |
| P1 | Deload review | Explain existing stall signals, show evidence and preview proposed changes; never force a heavier lift. |
| P1 | Target versus completed review | Contrast the planned sets/reps/effort with actual work and explain what changed next time. |
| P1 | Plateau evidence timeline | Distinguish insufficient data, changed rep ranges and true repeated comparable performances. |
| P2 | Friend comparison controls | Compare server-validated public results and map evidence, with privacy and clear bodyweight context. |
| P2 | Real rival push | APNs delivery after a verified event, opt-out enforced server-side, deduplication and rate limits. Requires credentials and physical-device delivery tests. |
| P2 | Crew weekly challenges | Opt-in, transparent scoring, timezone-safe deadlines and abuse controls. |
| P2 | Programme sharing previews | Show all movements/equipment and source before importing a friend's plan; never overwrite the active plan. |
| P2 | Share-card customisation | Choose which real stats appear; no fabricated transformation or health claims. |
| P2 | Progress-photo privacy | Private-by-default storage, explicit sharing and verifiable deletion, without bloating training backups. |
| P2 | Return-to-training flow | Review goals, schedule and starting targets after a break; avoid pressure to immediately match old PRs. |
| P2 | Personal exercise shortcuts | Favourites and recent movements with sensible local-first sync, not another mandatory onboarding screen. |
| P2 | Accessibility pass | Dynamic text, VoiceOver, contrast, reduced motion, keyboard-open layouts and one-handed touch targets on physical devices. |

## Release rule

Keep the signature map, editable week and fast logger central. Add one coherent package at a time,
test the state transitions, then test real screens. App Store readiness scripts are not proof of
working purchases, delivery, account deletion or approval. No claim of “perfect” substitutes for
device, backend and sandbox transaction evidence.
