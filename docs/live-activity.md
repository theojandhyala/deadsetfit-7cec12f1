# Rest timer outside the app

Three layers, deliberately independent so a failure in one never takes the others
down:

| Layer              | Where it shows                 | Works when the app is              |
| ------------------ | ------------------------------ | ---------------------------------- |
| Deadline countdown | in-app rest panel              | foreground                         |
| Local notification | banner + sound at the deadline | backgrounded, suspended, or killed |
| Live Activity      | Dynamic Island + Lock Screen   | backgrounded or suspended          |

All three are wired. The widget extension target was added to
`DeadSet.xcodeproj` on 2026-07-30, and Debug and Release both compile with the
extension embedded in the app bundle.

## Why it is built this way

The old timer decremented a counter with `setTimeout`. iOS suspends JavaScript
timers as soon as the app leaves the foreground, so locking the phone during rest
froze the countdown and it resumed from where it stopped — wrong by exactly the
time the phone was in a pocket, which is where it spends most of a rest period.

Everything now works from an **absolute deadline** (`endsAt`):

- `src/lib/rest-timer.ts` — deadline maths, notification scheduling, plugin bridge.
- `src/components/RestTimer.tsx` — recomputes from the clock every 250 ms and on
  `visibilitychange`/`focus`, so returning to the app never shows a stale number.
- The Live Activity is handed `endsAt` once and the **system** counts down to it.
  DEADSET pushes no per-second updates: iOS rate-limits frequent Live Activity
  updates, and a system timer is exact regardless of what the app is doing.

## Notifications

`@capacitor/local-notifications` was already wired for workout reminders
(`src/lib/device-reminders.ts`, ids 7100+). Rest alerts use id **7001** to stay
clear of that block.

Rest alerts are scheduled only when notification permission is **already granted**
— the prompt is never raised mid-set. Permission is requested by the existing
reminders toggle in Settings, so a lifter who has never enabled reminders gets the
in-app timer and the Live Activity, but no banner. That is the correct trade: an
OS permission dialog appearing between sets is worse than a missing banner.

## How the target was added

Not by hand: `project.pbxproj` is a graph of cross-referencing UUIDs across a
dozen sections, and hand-editing it is how projects get corrupted. It was done
with the `xcodeproj` library (the same one CocoaPods uses), scripted so it is
repeatable and reviewable:

```bash
gem install xcodeproj --user-install
ruby scripts/add-live-activity-target.rb
```

The script is idempotent — re-running reports what already exists rather than
adding a second target. What it configures:

- target `DeadSetRestActivity`, app-extension product type, iOS 16.2 minimum
- bundle id `org.deadsetfit.app.RestActivity`, team `89JWMU95AH`, automatic signing
- `RestActivityAttributes.swift` compiled into **both** app and extension, since
  the app requests the activity and the extension renders it — if only one has it,
  `Activity.request` fails at runtime with nothing logged
- an "Embed Foundation Extensions" phase plus a target dependency, so the `.appex`
  ships inside `DeadSet.app/PlugIns/`
- `Assets.xcassets` holding the `RestMark` image the Lock Screen layout draws

Two bugs this caught, both invisible to a glance in Xcode:

1. **`PRODUCT_NAME` was unset**, so the extension built as `.appex` with an empty
   name and collided with itself during the universal-binary step.
2. **`RestActivityPlugin.swift` was not in the App target.** That target lists its
   sources explicitly — there is no file-system synchronized group — so a Swift
   file dropped into `App/` is never compiled. The build passed while the plugin
   did not exist, which would have left the web layer with no `RestActivity`
   plugin and the island silently absent.

Verified by compiling, not by inspection:

```bash
cd ios/App && xcodebuild -project DeadSet.xcodeproj -scheme DeadSet -destination 'generic/platform=iOS Simulator' -configuration Release CODE_SIGNING_ALLOWED=NO build
```

Both configurations succeed. `DeadSet.app/PlugIns/DeadSetRestActivity.appex` is
present with `NSExtensionPointIdentifier = com.apple.widgetkit-extension`,
`MinimumOSVersion 16.2`, and the shared attributes type in both binaries.

## Verifying

On a device or simulator running iOS 16.2+:

1. Start a workout, complete a set so rest begins.
2. The pill appears in the Dynamic Island, counting down. Long-press to expand.
3. Lock the phone — the countdown continues on the Lock Screen.
4. At zero, the notification fires and the activity dismisses.
5. Tap **Skip** instead: both the activity and the pending notification clear.

If nothing appears, check Settings → DEADSET → **Live Activities** is on;
`isSupported()` reports that state and the app degrades silently when it is off.

## Deliberate limits

- **No push updates.** `pushType: nil`, so the activity cannot be updated from a
  server. Nothing here needs it: the countdown is local and the end date is known
  when rest starts.
- **One activity at a time.** Starting a new rest ends any existing one, so
  finishing sets quickly cannot stack pills in the island.
- **Live Activities cap at 8 hours** and iOS may end them sooner under memory
  pressure. Irrelevant for rest periods, worth knowing if this is ever reused for
  a whole-session timer.
