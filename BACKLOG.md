# DEADSET — Improvement & Feature Prompt

> Paste this as a working brief for a build session. It's prioritized: do Tier 0
> before scaling, then work down. Each item says _why it matters_ so scope can be
> cut intelligently, not randomly.

## Shipped

- ✅ **Push notifications (local)** — streak-at-risk warnings and duel/rival
  nudges, both scheduled on-device so they cost nothing to run and fire with
  the app closed. Real-time "your rival just logged" needs APNs; the full
  design is in `docs/AGENT-BRIEF.md` §6.1.
- ✅ **Live Activity + widgets** — workout on the Lock Screen and Dynamic
  Island; streak and rank on the Home Screen and Lock Screen.
- ✅ **Apple Watch app** — watchOS 9+, logs sets, holds and rest from the wrist.
- ✅ **Live session control** — add / swap / remove / reorder exercises during a
  workout, edit or delete any logged set (not just the last), per-exercise rest
  and cues editable mid-session and saved back to the plan.
- ✅ **Time & distance sets** — holds and carries get a stopwatch and a
  longest-hold record; conditioning logs distance. Neither pollutes tonnage,
  rep history, 1RM charts or the FIFA card. See `COMPETITORS.md`.
- ✅ **"Vs last session" bar** — live tonnage against the same workout last time.
- ✅ **Progress Catalogue** (`/catalogue`) — before/after photo comparison, journey
  stats, photo timeline + lightbox, PR wall with per-lift climb sparklines,
  "Share your week" recap card. Linked from the Progress tab.
- ✅ **Deeper cinematic onboarding** — why/sleep/dream questions, analyzing reveal,
  lock-in pledge.
- ✅ **Rest timer** — auto-starts after each set (Web Audio chime + vibrate),
  +15s / skip / turn-off; `restTimerSeconds` pref.
- ✅ **Repeat last workout** — one-tap restart on the workout day-picker.
- ✅ **Weekly recap share card** — 9:16 story-ready "My week" image.
- ✅ **Onboarding Pro conversion step** (web only) — Free vs Pro tick table,
  monthly/yearly pricing with save-33% badge, Go Pro → /upgrade or start free.
- ✅ **Pro promotion surfaces** — ProBanner now on Train, Progress and Diet
  (self-gated off iOS + Pro users + per-session dismiss).

## Context (read first)

DEADSET is a ranked, competitive fitness app — Vite + React + TanStack Router,
localStorage-first with Supabase sync, wrapped with Capacitor for iOS. The moat
is **status and competition** (grit points, ranks, leagues, head-to-head, PRs),
not AI. Hard constraints that must not be violated:

- **No AI / $0-per-user** — every feature must be free to run at scale (rule-based, not model-based).
- **Pro sells through Apple on iOS** — monthly (`org.deadsetfit.pro.monthly`)
  and annual (`org.deadsetfit.pro.annual`), each with a one-week introductory
  free trial, purchased through Apple's own sheet and observed by RevenueCat.
  Stripe still serves the web. The app never promises a trial Apple has not
  actually returned for that account.
- **Brand** — dark-only, `#E10600` red, heavy italic wordmark, "FORGE YOUR BODY".
- Keep all inputs DOM-owned (defaultValue + ref) — controlled `value=` freezes typing in iOS WKWebView.

---

## TIER 0 — Harden before you scale (these bite the moment real users arrive)

- ✅ **Server-authoritative ranked stats.** `saveProfile` rejects `grit_points`
  and `public_stats` outright; both are derived server-side in `saveUserState`
  under the service role, behind a `leaderboard-integrity` verdict.
- ✅ **Progress photos out of the 2 MB sync blob.** They live in a private
  `progress-photos` bucket, read through short-lived signed URLs. A stored
  photo measured ~122 KB for an ordinary shot and ~640 KB for a noisy one, so
  between three and sixteen check-ins filled the entire payload and paused
  cloud backup of _all_ training data. Existing inline photos migrate in the
  background on first load.
- ✅ **`updated_at` conflict guard on `user_state` sync.** The client sends the
  row version it last saw; a save from a device that has fallen behind is
  refused rather than allowed to clobber. Clients that send no version keep the
  old behaviour rather than being locked out.
- ✅ **`RestTimer` wired into the live workout.**

1. **Fix the FifaCard 1RM vs PR-list mismatch** (card shows Epley-estimated 1RM,
   list shows raw stored value — same lift, two numbers). _Why: reads as a bug,
   erodes trust in the stats._
2. **account-restore completeness** — stop dropping `injuries`/`weakness` and
   faking `startingWeightKg` on fresh-device rebuild.

## TIER 1 — Retention (make them come back daily)

- **Rest timer** with auto-start between sets, haptics + sound on native.
- ~~**Push notifications**~~ — streak-at-risk and rival nudges shipped as local
  notifications. Still open: real-time rival push (needs APNs), rest-day nudge,
  weekly recap.
- ~~**iOS home-screen widget**~~ — shipped (streak, rank, week, Lock Screen).
- **Logger depth**: supersets, drop sets, warm-up ramp sets, per-set RPE.
- **Per-exercise history & PR timeline** graphs.
- **"Repeat last workout"** one-tap quick start.
- **Rule-based deload / auto-regulation** suggestions (e.g. flag stalled lifts).

## TIER 2 — Growth & virality (the flywheel)

- **Weekly recap card** — auto-generated "Your week in DEADSET" (volume, PRs,
  streak, rank change), one-tap share to stories. _Why: free acquisition; every share is an ad._
- **Clubs / gyms / crews** — join your gym, gym-vs-gym leaderboards. _Why: social
  gravity + built-in invite reason._
- **Rivalries 2.0** — head-to-head with live progress, stakes, trash talk.
- **Seasons** — ranked resets with end-of-season badges/rewards. _Why: status +
  a recurring reason to re-engage and go Pro._
- **Achievements / badges** system.
- **Surface the referral loop** (already grants 30-day Pro) — make it visible and tracked.

## TIER 3 — Monetization sharpening (Pro must sell status, not utility)

- **Sharpen the Pro tier**: free stays genuinely great; Pro = deeper competition,
  status cosmetics, advanced insight. Write the one-line pitch per feature.
- **Pro-only cosmetics** — card themes, name colours, animated badges. _Why:
  near-zero build cost, high perceived value, pure status._
- **Gift Pro** + prominent annual discount.
- **(v1.1) Safari link-out** to web checkout on iOS via the External Purchase
  Link Entitlement (see ROADMAP.md) — do it as an approved app, not at first submit.

## TIER 4 — Delight & polish

- **Onboarding**: make the 3 deep questions (why / sleep / dream) skippable so
  people in a hurry aren't forced through all ~22 steps.
- **Haptics** throughout native; **empty states** with personality.
- **Exercise library richness** — form cues, muscle diagrams, technique notes.
- **Body-measurement photo comparison** slider (before/after).
- **Accessibility pass** — VoiceOver labels, contrast, dynamic type.

---

### How to use this

Pick a tier, confirm scope, then build + verify + ship one tier at a time. Never
break the three hard constraints above. Tier 0 is not optional before a real
launch push — everything else is upside.
