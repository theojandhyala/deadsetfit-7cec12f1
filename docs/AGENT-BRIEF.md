# DEADSET — agent brief

A self-contained handoff. Paste the whole thing to ChatGPT, a fresh Claude
session, or a contractor. Nothing here assumes prior context.

---

## 1. What this is

DEADSET is a ranked, competitive iOS fitness app. The moat is **status and
competition** — grit points, ranks, leagues, crews, duels, PRs — not coaching
and not AI. The workout logger has to be good enough that it is never the
reason someone leaves; the competitive layer is what makes them stay.

**Stack:** Vite + React + TanStack Router + TypeScript. State is
localStorage-first with Supabase sync. Wrapped with Capacitor for iOS. There is
a native watchOS SwiftUI companion target and a WidgetKit extension hosting two
Live Activities and the home-screen widgets.

---

## 2. Hard constraints

Breaking any of these is worse than shipping nothing. Each exists because it
already cost something.

1. **No AI. $0 marginal cost per user.** Every feature must be rule-based and
   free to run at scale. A previous build called a model API per user with no
   revenue behind it — an unbounded bill — and every one of those features was
   removed. Do not reintroduce it in any form, including "just one small call".
2. **iPhone subscriptions use StoreKit only.** Never expose Stripe or an
   external purchase link in the native app. The monthly product is
   `org.deadsetfit.pro.monthly` and the selectable annual product is
   `org.deadsetfit.pro.annual`. A seven-day free
   introductory offer and the UK £5.99 price are configured in App Store
   Connect, not invented by the client. `StoreKitPlugin.swift` returns Apple's
   localized price, offer and eligibility, and the paywall only advertises the
   trial when those values confirm it. Subscription offer codes must use
   Apple's native redemption sheet. Private campaign codes are distributed
   directly to their intended recipients and must never be named in public UI.
   Preserve purchase, offer redemption, restore, manage, terms, privacy, logout
   and deletion access around the mandatory gate.
3. **Inputs must be DOM-owned** (`defaultValue` + ref). A controlled `value=`
   freezes typing in the iOS WKWebView.
4. **Brand:** dark only, `#E10600` red, heavy italic wordmark.
5. **Timers count down from a deadline, never by ticking.** iOS suspends JS
   timers in the background, which is where a phone spends most of a rest
   period. `scripts/appstore-check.mjs` enforces this.
6. **Haptics go through `src/lib/haptics.ts`**, which exposes one function per
   _meaning_ (set logged, PR, rest over), never per waveform. Two different
   events must never feel the same. `navigator.vibrate` does nothing in iOS
   WKWebView — never rely on it.

---

## 3. Architecture facts you will otherwise get wrong

- **Timed and distance sets store `reps: 0`** plus a `mode` field. Every
  existing `weight * reps` volume calculation therefore contributes zero for
  them _without knowing they exist_. Preserve this property. Do not add special
  cases to volume maths.
- **`isWorkingSet` and `countsForRecords`** (`src/lib/set-tracking.ts`) are the
  single source of truth for which sets count toward a plan and toward records.
  Warm-ups and drop sets fail both. Sets to failure pass both — a set taken to
  failure is a genuine attempt at the load.
- **The Apple Watch is a remote control, not a second source of truth.** It
  renders what the phone publishes and asks the phone to record sets. Every
  watch action carries an id and the phone deduplicates on it, because delivery
  can legitimately happen twice.
- **`ios/App/Shared/*.swift` compiles into multiple targets** so the phone,
  watch and widget extension cannot drift apart. Change once, all sides change.
- **Widgets cannot see app data.** Training state lives in WKWebView
  localStorage, invisible outside the web view. The app writes a
  `WidgetSnapshot` into the `group.org.deadsetfit.app` App Group and the widget
  reads it there.
- **`project.pbxproj` is edited by hand.** Run `npm run check:xcodeproj` after
  touching it _and after adding any `.swift` file_ — a file on disk but outside
  the project compiles into nothing and fails as "cannot find X in scope"
  somewhere unrelated.

---

## 4. What already exists

Do not rebuild these.

**Logger:** ghost sets (last session's numbers, struck through as you beat
them), rule-based progression suggestions with RPE, warm-up ramp, plate
calculator with per-exercise bar weight, supersets with correct round-robin
rest, drop sets, warm-up sets, sets to failure, per-set RPE, mid-workout
add/swap/remove/reorder, edit or delete any logged set, per-exercise rest and
cues editable on the gym floor, time and distance tracking with their own
records.

**Competitive:** grit points, ranks, leagues, crews, duels, badges, seasons,
share cards, referrals.

**Native:** HealthKit sync, rest-timer Live Activity, workout Live Activity,
home-screen and Lock Screen widgets, Apple Watch app (watchOS 9+) with
WatchConnectivity, haptics, StoreKit plumbing.

**Notifications (all local, all $0):** scheduled workout reminders, streak-at-
risk warnings (`src/lib/streak-notifications.ts`), and duel/rival nudges
(`src/lib/rival-notifications.ts`).

---

## 5. Verification — non-negotiable

Before claiming anything is done:

```
npm run check                    # tsc, eslint, vitest, build, CSS, Xcode project
node scripts/appstore-check.mjs  # App Store readiness
```

New logic needs tests. State plainly what you could not verify — for example,
Swift cannot be compiled without Xcode, and saying so is required, not
optional.

---

## 6. The work, in priority order

### 6.1 Real-time rival push (the biggest remaining piece)

**What exists today and why it is not enough.** `rival-notifications.ts`
schedules _local_ nudges from duel scores fetched when the app last opened:
"Marcus is ahead by 2,400 kg", "8h left and you're behind". These fire
reliably with the app closed, because they are scheduled ahead. What they
cannot do is fire _the moment a rival logs_, because the phone has no way to
learn that while it is asleep.

**Why this is still ~$0.** APNs itself is free. The whole delivery path fits
inside Supabase's free tier at this app's scale — one Edge Function invocation
per finished workout per duel opponent. This does not violate constraint 1,
which is about per-user _model inference_ cost, not about having a backend.
Confirm current Supabase free-tier limits before building.

**Design:**

1. **Token registration.** Add `@capacitor/push-notifications`. On launch,
   after sign-in, register and store the APNs token in a new `device_tokens`
   table: `(user_id, token, platform, updated_at)`, unique on `token`. Refresh
   on every launch — tokens rotate. Delete on sign-out.
2. **iOS capability.** Add the Push Notifications capability and the
   `aps-environment` entitlement to `ios/App/App/App.entitlements`, and enable
   it on the App ID. Remember `npm run check:xcodeproj`.
3. **Trigger.** When a finished session is written, fire a Postgres trigger (or
   call an Edge Function directly from the existing RPC that persists
   sessions). Do not poll.
4. **Fan-out.** In the Edge Function: find `active` duels containing this user,
   take each opponent, load their device tokens, and skip anyone whose
   `rival_alerts_enabled` is false. **The opt-out must be enforced server-side**
   — a client-side check is not an opt-out.
5. **APNs auth.** Token-based: a `.p8` key, Key ID and Team ID stored as
   Supabase secrets. Sign an ES256 JWT, cache it for its one-hour life, and
   send to `api.push.apple.com`. Never ship the `.p8` in the repo.
6. **Rate limit.** At most one rival push per opponent per 6 hours, tracked in a
   `rival_push_log` table. Someone doing three sessions a day must not
   notification-bomb their duel partner. This is the difference between a
   retention feature and an uninstall.
7. **Content.** Name the person and the number: "Marcus just logged 12,400 kg —
   he's 2,400 ahead." Deep link to `/challenges`.
8. **Handle failure.** A 410 from APNs means the token is dead — delete it.
   Never retry a 410.

**Acceptance:** a duel opponent finishing a workout produces exactly one push
within a minute, respects the opt-out, and stops entirely once the duel ends.

### 6.2 Routine folders

Strong groups routines into folders; DEADSET has programmes with no grouping.
Small, self-contained, and the last remaining organisational gap versus Strong.

### 6.3 Per-exercise history on the watch

The last four sessions for the movement currently on screen. The watch already
receives `ghost` (last session's sets) — this extends that payload.

### 6.4 Server-authoritative ranked stats

`BACKLOG.md` Tier 0, item 1, and still open. `grit_points` and `public_stats`
are client-writable, so leaderboards are spoofable. The entire Pro pitch is
status and competition — if the ladder can be faked, the moat is gone. This is
arguably more important than anything above; it is listed lower only because it
is a backend project rather than a feature.

---

## 7. Do not

- Add any per-user model API call.
- Add in-app purchase UI, prices, or purchase links to the iOS build.
- Change the `reps: 0` convention for timed sets.
- Push per-second updates to a Live Activity — iOS rate-limits them and drops
  the excess.
- Schedule widget timeline refreshes on a polling interval; the app reloads
  them when data actually changes.
- Claim something is verified that you could not run.

---

## 8. Working agreement

Pick **one** item. Confirm the scope. Build it, test it, verify it, and stop.
Five items done badly is worse than one done properly — and on a codebase where
a single wrong assumption about volume maths silently corrupts every athlete's
history, "badly" is expensive.
