# Rest timer outside the app

Three layers, deliberately independent so a failure in one never takes the others
down:

| Layer              | Where it shows                 | Works when the app is              |
| ------------------ | ------------------------------ | ---------------------------------- |
| Deadline countdown | in-app rest panel              | foreground                         |
| Local notification | banner + sound at the deadline | backgrounded, suspended, or killed |
| Live Activity      | Dynamic Island + Lock Screen   | backgrounded or suspended          |

The first two are **live now** and need no Xcode work. The Live Activity needs one
target added in Xcode (below) — everything else for it is already written.

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

## Adding the Live Activity target (Xcode, ~3 minutes)

This is the one step that cannot be scripted safely: it means adding a target to
`project.pbxproj`, and hand-editing that file risks breaking the build for a
saving of two clicks.

1. Open `ios/App/App.xcworkspace` in Xcode.
2. **File → New → Target… → Widget Extension**.
   - Product Name: `DeadSetRestActivity`
   - **Uncheck** "Include Configuration App Intent"
   - **Check** "Include Live Activity"
   - Embed in: `App`
3. Xcode generates a folder of placeholder files. **Delete them** (move to trash) —
   the real implementation is already in `ios/App/DeadSetRestActivity/`.
4. Right-click the new group → **Add Files to "DeadSetRestActivity"…** and add:
   - `RestActivityAttributes.swift`
   - `RestLiveActivity.swift`
5. Select `RestActivityAttributes.swift` → File Inspector → **Target Membership**:
   tick **both** `App` and `DeadSetRestActivity`. This matters — the app requests
   the activity and the extension renders it, so both compile the same type. If
   only one has it, `Activity.request` fails at runtime with no visible error.
6. Add `RestMark` to the extension's asset catalog: drag `public/icon-192.png`
   into `DeadSetRestActivity/Assets.xcassets` and name the image set `RestMark`.
   (The Lock Screen layout references it; the Dynamic Island does not.)
7. Set the extension's deployment target to **iOS 16.2** or later.
8. Build. `RestActivityPlugin.swift` is already in the `App` target and registers
   itself with Capacitor automatically.

`NSSupportsLiveActivities` is already `true` in `ios/App/App/Info.plist`.

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
