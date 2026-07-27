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

## Phase 2 (not yet built): app on the wrist

A native watchOS SwiftUI app (see today's plan, tick sets from the wrist)
requires a watch target that Xcode must generate:

1. Xcode → File → New → Target → watchOS → App ("Watch App for iOS App",
   attach to `App`).
2. Share data via WatchConnectivity from the Capacitor shell (a small
   `WCSession` bridge similar to HealthKitPlugin) or an App Group.
3. The watch UI is plain SwiftUI: plan list → tap set rows → send ticks back.

Doing step 1 by editing project.pbxproj manually is error-prone; run it in
Xcode (2 minutes), then the plugin pattern above extends naturally.
