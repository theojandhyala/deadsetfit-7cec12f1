# DEADSET — The Mega Prompt

> A research-grounded build brief to make DEADSET the best gym app on the store.
> Every recommendation is cross-referenced against (a) what real lifters ask for
> and abandon apps over, (b) what the top competitors do, and (c) what DEADSET
> already ships. Hand this to a build session and work top-down.

---

## 0. The three hard constraints (never break these)
- **No AI / $0-per-user.** Everything must be rule-based and free to run at scale. Where the market says "AI autopilot," DEADSET does **deterministic progression math** — same outcome, zero per-user cost.
- **Web-only Pro on iOS.** No prices/purchase UI on native iOS (App Store 3.1.1). Pro sells on web.
- **Brand:** dark, `#E10600`, heavy italic, "FORGE YOUR BODY." Rounded 22px panels, red glow, FIFA-card energy.

## 1. Positioning — the lane no one owns
The market is mapped and crowded, but there's an open lane:
- **Hevy** owns *social + simple + best value* (~$24/yr, Apple Watch, huge free tier).
- **Strong** owns *minimalist fast logging*.
- **Fitbod** owns *AI programming* (but ~$96/yr — resented as overpriced).
- **DEADSET owns *ranked competition + status*.** Nobody else makes "climb Bronze → Elite, weekly leagues, head-to-head, grit rank" the spine of the app. **This is the moat — double down on it.**

The research backs this: social accountability and gamification (leaderboards, badges, streaks) are top habit drivers (Cornell 2025 gym-attendance study; social-streak apps show **34% longer streaks**). DEADSET's competition system *is* a retention engine — treat it as the product, not a side feature.

**Nuance to respect:** Nike Run Club makes "beat your *past self*" central, not peer comparison, because peer ranking can demotivate beginners. So DEADSET must serve **both**: rank/leagues for the competitive, and a **"you vs you"** default (PRs, Ghost Mode, your own climb) so a Bronze beginner never feels like they're losing. Ghost Mode + PR detection already exist — surface the personal-progress story first, leaderboards second, and let the user lean competitive as they grow.

## 2. The retention engine (this is the whole game)
**71% of fitness-app users quit by month 3; 40% are gone in 24 hours.** Winning = designed for imperfection + return. Map every one of these to a concrete DEADSET mechanic:

| What kills retention (research) | DEADSET answer |
|---|---|
| Broken-streak guilt / loss aversion | **Streak Armor** (auto streak-freeze) — DEADSET already nails the #1 best-practice. Extend the *tone*: "welcome back," never "you failed." |
| Manual logging friction ("logging fatigue") | DOM-owned tap-to-log, prefilled from last session — keep it the fastest logger on the store. Add **Apple Watch standalone logging** (see §3). |
| Boring, repetitive workouts (16% quit) | Rule-based **variety engine**: suggest exercise swaps, rotate accessories, "try this variation." No AI needed. |
| Lack of personalization | The deep onboarding already personalizes; feed `motivation`/`goal`/`sleep` into copy and plan. |
| Difficulty calibration | **RPE/RIR effort logging → deterministic next-session suggestion** (see §3.1). |
| No early win | **First-session achievement is worth a 64% retention lift** (33% vs 20%). Guarantee a badge/PR/celebration in session 1 — even "first set logged" earns grit + a celebration. |

**The onboarding tension (be honest about it):** research says users decide in ~20 seconds and onboarding should feel like "start in 1 minute." DEADSET's onboarding is now ~22 cinematic steps. Resolution: keep the cinematic path as the *default emotional* experience **but** add a prominent **"Skip to training →"** quick-start that collects only goal + days + equipment, then backfills the rest later. Best of both: depth for those who want it, a 60-second path for those who don't.

## 3. Feature roadmap (priority order, research-justified)

### TIER 0 — Integrity & table stakes (before any scale push)
1. ✅ **Server-authoritative ranked stats** (DONE, verified): server derives grit_points + public_stats from the synced user_state blob via the service role; saveProfile rejects client values; the profiles_guard_privileged trigger reverts any authenticated write to those columns (verified live). Not bulletproof (blob is client-written) — true anti-cheat needs server-side set logging, a bigger build for if/when cheating appears at scale.
2. **Progress photos out of the 2 MB sync blob** → object storage. Silent data loss otherwise.
3. **updated_at sync conflict guard** (two-device last-write-wins clobbers data).

### TIER 1 — Match the 2026 logging standard (this is now expected, not optional)
1. ✅ **RPE / RIR effort logging** (shipped) per set, with a **deterministic progression suggestion**: "Last week 100kg×5 @ RIR 2 → try 102.5kg today." Rule-based tables, no AI. This is the single biggest feature gap vs Fitbod/Jefit/RepXP — and DEADSET can do it at $0.
2. ✅ **"Progression ready" nudges** (shipped) — the Progression Ready board on Progress scans every lift and shows what to load next; the logger flags ready lifts. Turns logging into coaching.
3. 🟡 **Drop sets + warm-up sets** (shipped) in the logger — tap the warm-up ramp to log warm-ups (excluded from volume/PRs); '+ Drop set' logs a marked finisher (counts volume, never a PR). Only **supersets** remain.
4. **Rich exercise library** — this is where Fitbod (1,600) and Load Muscle (4,000) win. Ship **400+ exercises minimum**, each with: muscle targeting, equipment filter, form cues, and a demo (looping GIF/video or clear animation). DEADSET has VideoModal — build the structured library behind it.
5. **Apple Watch app (standalone logging + rest timer on the wrist).** Hevy and Strong both have this; it's a top reason serious lifters pick an app (log without touching your phone). Native watchOS target — real engineering, high payoff.

### TIER 2 — Deepen the moat (competition + growth)
1. **Seasons** — ranked resets with end-of-season badges/rewards. Recurring re-engagement + status.
2. **Clubs / gyms / crews** — gym-vs-gym leaderboards. Built-in invite reason (social gravity).
3. **Rivalries 2.0** — head-to-head with live progress, stakes, banter.
4. **Achievements / badges system** — first-day achievement drives the 64% retention lift; build a broad, visible badge ladder.
5. **Push notifications** — the biggest single retention lever for a streak app: streak-at-risk, "your rival just logged," weekly recap. *(Native.)*
6. **Weekly recap share card** ✅ shipped — every share is free acquisition.

### TIER 3 — Monetization that sells status (not utility)
- **Pro = deeper competition + status cosmetics + advanced insight.** Keep the free tier genuinely great (Hevy's lesson: aggressive upselling is resented).
- **Pro-only cosmetics** (card themes, name colours, animated badges) — near-zero build, pure status, high margin.
- Gift Pro; prominent annual pricing.
- **(v1.1) Safari link-out** to web checkout on iOS via External Purchase Link Entitlement.

### TIER 4 — Delight & polish
- iOS home-screen **widget** (streak + today + rank).
- **Siri / voice** "log 100 kilos for 5."
- Body-measurement **photo comparison slider**; exercise history graphs.
- Full **accessibility** pass (VoiceOver, dynamic type, contrast).
- Haptics throughout; empty states with personality.

## 4. UX principles (from the research, applied)
- **Show the payoff instantly.** Home = today's plan + your progress + your rank, above the fold. DEADSET's Train screen already does this — protect it.
- **First 20 seconds decide.** The landing (now product-led) + a fast onboarding path must show value immediately.
- **Gamify without overwhelming.** Streaks/badges/leagues should feel rewarding, never nagging. Moderate the aggressive tone on the *return* path.
- **Low friction everywhere.** Every extra tap to log is a user lost.
- **Offline-first + cloud sync** (DEADSET is localStorage-first ✅) — never block training on a network.

## 5. What DEADSET already does right (keep, don't rebuild)
Streak Armor (best-practice streak-freeze), ranked leagues + head-to-head + grit (the moat), auto PR detection, Ghost Mode (you-vs-you), plate math + warm-ups, DOM-owned fast logging, rest timer, the Catalogue (before/after + PR wall + sparklines), programs (5/3/1, StrongLifts, PHUL, Arnold, nSuns), cinematic onboarding + commitment pledge, FIFA card, weekly recap share card, offline-first sync, Apple Health export.

## 6. The one-line brief
**Be the app that turns training into a ranked game you can't stop climbing — with logging as fast as Strong, a free tier as fair as Hevy, progression as smart as Fitbod (but rule-based and free), and a competition system nobody else has. Design every screen for the lifter who's about to quit, and give them a reason to come back tomorrow.**

---
### Sources
Retention/abandonment & streak-freeze: [Autentika](https://autentika.com/blog/why-do-users-abandon-fitness-apps), [GainStrong](https://getgainstrong.com/blog/why-fitness-apps-make-consistency-harder), [productgrowth.in](https://productgrowth.in/insights/healthtech/fitness-app-retention/). Competitor landscape: [sensai.fit](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit), [findyouredge.app](https://www.findyouredge.app/news/best-strength-training-apps-2026), [Hevy features](https://www.hevyapp.com/features/). 2026 feature standard (RPE/RIR, autopilot, Watch): [Jefit](https://www.jefit.com/wp/guide/7-best-ai-powered-progressive-overload-workout-trackers-of-2026-for-automated-strength-and-muscle-gains/), [findyouredge Apple Watch](https://www.findyouredge.app/news/best-strength-training-apps-apple-watch-2026), [RepXP](https://repxp.app/). UX/onboarding/gamification & first-day-achievement stat: [dataconomy](https://dataconomy.com/2025/11/11/best-ux-ui-practices-for-fitness-apps-retaining-and-re-engaging-users/), [Orangesoft](https://orangesoft.co/blog/strategies-to-increase-fitness-app-engagement-and-retention), [Amalgama onboarding](https://amalgama.co/the-psychology-behind-fitness-apps-onboarding/).
