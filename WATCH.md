# DEADSET × Apple Watch

## What ships today (HealthKit pairing)

The iOS app pairs with Apple Watch through Apple Health:

- **Watch → DEADSET**: workouts recorded on the watch (any app) import as
  finished sessions — they count toward streak, grit, weekly quests and the
  report card. Active energy shows on the Diet dashboard as "active burn".
- **DEADSET → Watch/rings**: finishing a DEADSET session writes a strength
  workout to Apple Health, closing rings and appearing in Apple Fitness.

Pieces:

- `ios/App/App/HealthKitPlugin.swift` — Capacitor plugin (authorization,
  queryWorkouts, todayActiveEnergy, saveWorkout)
- `ios/App/App/MyViewController.swift` — registers the app-local plugin
  (the Capacitor CLI only auto-discovers packaged plugins)
- `ios/App/App/App.entitlements` — HealthKit capability
- `Info.plist` — NSHealthShare/NSHealthUpdate usage strings
- `src/lib/health.ts` — JS bridge (no-op outside the native iOS shell)
- Settings → "Apple Watch & Health" — pairing UI + import/export toggles
- Import engine runs once per app open (`_tabs.tsx`); export happens on
  workout finish (`workout.live.tsx`)

Imported sessions are idempotent (keyed by HealthKit UUID) and skip
workouts DEADSET itself exported.

## Signing note

The HealthKit entitlement requires the capability to be enabled on the App ID
in your Apple Developer account. Xcode → target App → Signing & Capabilities
will surface this automatically on the next archive (HealthKit is already in
App.entitlements; Xcode syncs the App ID when signing).

## The app on the wrist

A native watchOS SwiftUI app, target `DeadSetWatch`, bundle
`org.deadsetfit.app.watchkitapp`, embedded in the iOS app.

### How it is wired

- `ios/App/Shared/WatchProtocol.swift` — the wire contract, **compiled into
  both targets** so phone and watch cannot drift apart.
- `ios/App/App/WatchConnectivityHub.swift` — owns the `WCSession` on the phone,
  activated from `AppDelegate` at launch.
- `ios/App/App/WatchBridgePlugin.swift` — Capacitor facade (`WatchBridge`),
  registered in `MyViewController` alongside the other app-local plugins.
- `ios/App/DeadSetWatch/` — the watch app: exercise list, set logger with
  Digital Crown, stopwatch for holds, distance logger, rest timer.
- `src/lib/watch.ts` — JS bridge (no-op outside the native iOS shell).
- `src/routes/workout.live.tsx` — publishes the live session and applies what
  the watch sends back.
- Settings → "DEADSET on Apple Watch" — live pairing/reachability status.

### The three decisions worth knowing

**The phone is the source of truth.** The watch renders published state and
asks the phone to record sets; it never owns training data. That removes merge
conflicts entirely, and means a watch-logged set runs through exactly the same
PR detection, grit award and rest handling as a phone-logged one — there is one
`logSetAt`, not two.

**The session is activated in `AppDelegate`, not in the plugin.** iOS suspends
the WKWebView the moment the app backgrounds, which is the normal state of a
phone while its owner is training. A `WCSession` that only existed while
JavaScript ran would drop every set logged with the phone in a pocket. The hub
receives and buffers natively; the web layer drains the buffer on resume.

**Every action carries an id, and the phone deduplicates on it.** The watch
sends immediately when reachable and queues via `transferUserInfo` when not,
with a fallback from the first to the second — so an action can legitimately
arrive twice. Logging the same set twice would inflate volume and award a
phantom PR.

### Signing

The watch target needs its own App ID, `org.deadsetfit.app.watchkitapp`, with
HealthKit enabled (it runs an `HKWorkoutSession` to stay awake between sets —
without one watchOS suspends the app as soon as the wrist drops). Automatic
signing will create it on first archive. The bundle identifier **must** stay
prefixed with the companion app's, and `WKCompanionAppBundleIdentifier` in
`ios/App/DeadSetWatch/Info.plist` must stay `org.deadsetfit.app`.

### Verifying the project file

The watch target was added by editing `project.pbxproj` directly rather than
through Xcode. `npm run check:xcodeproj` validates the result — balance, every
id defined and referenced, every target registered, every file reference
resolving to a real path — and runs as part of `npm run check`. It is not a
substitute for opening the project once, but it turns a parse failure into a
caught error rather than a confusing one.

---

# Live Activities and widgets

Both live in the **existing** `DeadSetRestActivity` extension rather than new
targets. It is already a `com.apple.widgetkit-extension`, and one WidgetBundle
can host Live Activities and home-screen widgets together — so this is one
target, one App ID and one provisioning profile instead of three.

`DeadSetWidgetBundle` in `RestLiveActivity.swift` lists everything the
extension provides:

- `RestLiveActivity` — the rest countdown (already shipped).
- `WorkoutLiveActivity` — the live session: current movement, sets against the
  plan, tonnage, PRs, and a running clock.
- `StreakWidget` — small home-screen plus all three Lock Screen accessory
  families.
- `RankWidget` — medium: rank, grit, rank progress and the week.

## The App Group is not optional

A widget runs in its own process and **cannot see the WKWebView's
localStorage**, where all DEADSET training data lives. The app therefore writes
a `WidgetSnapshot` into a shared App Group container and the widget reads it
there.

`group.org.deadsetfit.app` is declared in **both** `App.entitlements` and
`DeadSetRestActivity.entitlements`. It must also be enabled on both App IDs in
the developer account. **If it is not, the build will fail to install with an
entitlement mismatch — this is not a silent degradation.** Automatic signing
will offer to create the group on first archive.

## Why the widget never polls

`getTimeline` returns a single entry with `policy: .never`. The data only moves
when the athlete does something in the app, so the app calls
`WidgetCenter.reloadAllTimelines()` at that moment instead. A polling schedule
would spend the system refresh budget re-reading a file that has not changed.

For the same reason the web layer publishes only when the snapshot's _contents_
differ (`_tabs.tsx` compares the serialised payload). Publishing on every state
write — every set, every glass of water — would burn the reload budget and get
the app throttled out of the updates that matter.

## Why the session clock is never pushed

`startedAt` goes into the Live Activity's content state once, and iOS renders
elapsed time from it. Live Activity updates are rate-limited and over-budget
ones are dropped, so a clock that depended on them would stutter or freeze
exactly when the app is suspended — which, mid-set, it usually is. The app only
pushes an update when a set actually lands.

`end()` ends _every_ workout activity, not just the one this process started:
an activity outlives the app that requested it, so after a relaunch mid-session
the tracked id is gone while the card is still on the Lock Screen. Leaving one
there forever is the worst failure this feature has.
