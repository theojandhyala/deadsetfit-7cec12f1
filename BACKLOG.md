# DEADSET — Improvement & Feature Prompt

> Paste this as a working brief for a build session. It's prioritized: do Tier 0
> before scaling, then work down. Each item says _why it matters_ so scope can be
> cut intelligently, not randomly.

## Shipped

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
- **Web-only Pro on iOS** — no in-app purchase UI or prices on native iOS (App Store 3.1.1). Pro sells on the web; iOS stays gated. (Safari link-out is planned as v1.1 — see ROADMAP.md.)
- **Brand** — dark-only, `#E10600` red, heavy italic wordmark, "FORGE YOUR BODY".
- Keep all inputs DOM-owned (defaultValue + ref) — controlled `value=` freezes typing in iOS WKWebView.

---

## TIER 0 — Harden before you scale (these bite the moment real users arrive)

1. **Server-authoritative ranked stats.** `grit_points` and `public_stats` are
   currently client-writable via `saveProfile`, so leaderboards are trivially
   spoofable. Compute/validate rank and PR values server-side. _Why: the entire
   Pro pitch is status and competition — if the leaderboard can be faked, the
   moat is gone._
2. **Move progress photos out of the 2 MB sync blob** into Supabase Storage.
   Today, crossing the blob cap silently pauses cloud backup of ALL training
   data. _Why: silent, permanent data loss for your most engaged users._
3. **Add an `updated_at` conflict guard** to `user_state` sync. Two devices are
   last-write-wins and can clobber newer data. _Why: data loss once anyone uses
   phone + web._
4. **Wire the existing `RestTimer`** into the live workout (it's built but never
   mounted). _Why: a core gym-floor feature is missing for zero build cost._
5. **Fix the FifaCard 1RM vs PR-list mismatch** (card shows Epley-estimated 1RM,
   list shows raw stored value — same lift, two numbers). _Why: reads as a bug,
   erodes trust in the stats._
6. **account-restore completeness** — stop dropping `injuries`/`weakness` and
   faking `startingWeightKg` on fresh-device rebuild.

## TIER 1 — Retention (make them come back daily)

- **Rest timer** with auto-start between sets, haptics + sound on native.
- **Push notifications** (native): streak-at-risk, "your rival just logged",
  rest-day nudge, weekly recap. _Why: the single biggest retention lever for a streak app._
- **iOS home-screen widget**: current streak + today's workout + rank.
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
