# What to hand to a scheduled assistant, and what not to

## The honest split

A coding agent in this repo and a scheduled ChatGPT task are not competing at
the same job, and pretending otherwise wastes both.

**A coding agent here** has the repo, can run `npm run check`, can see that
`fifa-stats.ts` already had a comment about mis-logged holds, and can push a
branch. It runs when you ask.

**A scheduled assistant** has none of that context, but it runs _without being
asked_, every day, against the live web. That is the only real advantage, and
it is a big one for exactly one category of work: **things that change while
you are not looking.**

So the split is not "which is smarter". It is: does the task need the codebase,
or does it need to happen on a schedule against the outside world?

## Worth automating

Each of these is recurring, outward-facing, and needs no repo access.

**1. App Store review watch — daily.**
New DEADSET reviews, grouped by theme, with a flag on any 1–2 star cluster or
any review mentioning crashes, sync, or lost data. Reviews are where data-loss
bugs surface first, and they surface days before you would notice otherwise.

**2. Competitor release tracking — weekly.**
Strong, Hevy, Boostcamp, Fitbod release notes. Fitness loggers ship visible
feature changes; knowing Strong shipped something the week it happens is worth
more than finding out in a review that says "Strong has this".

**3. ASO keyword refresh — monthly.**
Title, subtitle and keyword field against what is actually ranking. This is
iterative, data-driven, and genuinely better with live search data than with
a model's memory.

**4. Review-reply drafts — daily, alongside (1).**
Draft replies for the reviews that deserve one. You approve and post; nothing
is published automatically.

**5. Short-form content from real data — weekly.**
The repo already has share cards (`PRShareCard`, `WeeklyRecapCard`,
`StoryShareCard`) and a `tiktok_swipe/` directory. A weekly task turning the
week's actual PR and streak moments into hooks is real leverage — the content
is generated from things that really happened, not invented.

## Not worth automating

**Anything touching App Store compliance.** `ROADMAP.md` and `BACKLOG.md`
document a deliberate, high-stakes position on Guideline 3.1.1 — free app, Pro
on the web only, no in-app purchase UI or prices on iOS. A scheduled assistant
without that context will confidently suggest adding a purchase button. That
suggestion, acted on, costs a rejection.

**Code changes.** No repo, no `npm run check`, no `check-xcodeproj`. A patch
that cannot be validated is a liability, not a contribution.

**Anything about the data model.** The reason a plank stopped poisoning rep
history is that timed sets store `reps: 0`, so thirteen existing volume
calculations contribute nothing for them without knowing they exist. That is
not reconstructable from a description of the feature.

---

# The prompt

Paste this to brief another agent — ChatGPT, a fresh Claude session, a
contractor. It is written to be self-contained, and the constraints section is
the part that matters: every one of those rules exists because breaking it
costs real money or a rejection.

```
You are working on DEADSET, a ranked competitive iOS fitness app.
Stack: Vite + React + TanStack Router, TypeScript, localStorage-first with
Supabase sync, wrapped with Capacitor for iOS, plus a native watchOS SwiftUI
companion target.

HARD CONSTRAINTS — breaking any of these is worse than shipping nothing:

1. NO AI, and $0 marginal cost per user. Every feature must be rule-based and
   free to run at scale. A previous version called a model API per user with
   no revenue behind it; it was removed for that reason. Do not reintroduce it
   in any form, including "just one small call".
2. NO in-app purchase UI, prices, or purchase links on native iOS. Pro is sold
   on the web only. This is a deliberate App Store Guideline 3.1.1 position.
3. Inputs must be DOM-owned (defaultValue + ref). A controlled `value=` freezes
   typing in the iOS WKWebView.
4. Brand: dark only, #E10600 red, heavy italic wordmark.
5. Timers count down from a deadline, never by ticking. iOS suspends JS timers
   in the background, which is where a phone spends most of a rest period.
6. Native haptics go through src/lib/haptics.ts, which has one function per
   MEANING (set logged, PR, rest over). Never call the plugin directly, and
   never make two different events feel the same. navigator.vibrate does
   nothing in iOS WKWebView — do not rely on it.

ARCHITECTURE FACTS you will get wrong otherwise:

- Sets that measure time or distance store `reps: 0` and a `mode` field, so
  every existing `weight * reps` volume calculation contributes zero for them
  automatically. Preserve this. Do not add a special case to volume maths.
- `isWorkingSet` and `countsForRecords` in src/lib/set-tracking.ts are the
  single source of truth for which sets count toward a plan and toward
  records. Warm-ups and drop sets fail both; sets to failure pass both.
- The Apple Watch is a remote control, not a second source of truth. It renders
  what the phone publishes and asks the phone to record sets. Every watch
  action carries an id and the phone deduplicates on it, because delivery can
  legitimately happen twice.
- ios/App/Shared/WatchProtocol.swift compiles into BOTH the iOS and watch
  targets so they cannot drift. Change it once, both sides change.
- project.pbxproj is edited by hand. Run `npm run check:xcodeproj` after any
  change to it, and after adding any .swift file — a file on disk but not in
  the project compiles into nothing and fails somewhere unrelated.

BEFORE YOU CLAIM DONE: `npm run check` must pass (tsc, eslint, vitest, build,
CSS check, Xcode project check), and `node scripts/appstore-check.mjs` must
pass. New logic needs tests. Say plainly what you could not verify.

WHAT TO BUILD, in priority order — read BACKLOG.md and COMPETITORS.md first:

1. Live Activity / Dynamic Island for the running workout. A rest-timer Live
   Activity already exists (ios/App/DeadSetRestActivity) — extend that pattern
   to the session itself: current exercise, sets done, elapsed.
2. iOS home-screen widget: current streak, today's workout, rank.
3. Push notifications: streak-at-risk, "your rival just logged", weekly recap.
   Local notifications only — no server push, no per-user cost.
4. Routine folders — group programmes, the way Strong groups routines.
5. Per-exercise history on the watch: last four sessions for the movement
   you are on.

Pick ONE, confirm scope, build it, verify it, and stop. Do not do all five
badly.
```
