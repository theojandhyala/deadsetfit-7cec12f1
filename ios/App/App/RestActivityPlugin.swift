import ActivityKit
import Capacitor
import Foundation

/// Drives the rest-timer Live Activity (Dynamic Island + Lock Screen) from the
/// web layer.
///
/// The activity is deliberately "fire and forget": it is handed an end date and
/// the system counts down to it. DEADSET pushes no per-second updates — iOS
/// rate-limits frequent Live Activity updates, and a native timer is exact
/// anyway. That is also why rest keeps running correctly when the app is
/// suspended or killed mid-set.
@objc(RestActivityPlugin)
public class RestActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestActivityPlugin"
    public let jsName = "RestActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            // Enabled is a user setting (Settings → DEADSET → Live Activities),
            // so a device can support them while this user has them switched off.
            call.resolve([
                "supported": ActivityAuthorizationInfo().areActivitiesEnabled
            ])
        } else {
            call.resolve(["supported": false])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["started": false])
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false])
            return
        }

        // endsAt arrives as epoch milliseconds to match JavaScript's Date.
        let endsAtMillis = call.getDouble("endsAt") ?? 0
        guard endsAtMillis > 0 else {
            call.reject("endsAt is required")
            return
        }
        let endsAt = Date(timeIntervalSince1970: endsAtMillis / 1000)
        let totalSeconds = call.getInt("totalSeconds") ?? max(0, Int(endsAt.timeIntervalSinceNow))
        let exerciseName = call.getString("exerciseName") ?? "Next set"

        // One rest timer at a time: starting a new set replaces the old activity
        // rather than stacking pills in the island.
        endAllActivities()

        let attributes = RestActivityAttributes(exerciseName: exerciseName)
        let state = RestActivityAttributes.ContentState(endsAt: endsAt, totalSeconds: totalSeconds)

        do {
            _ = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: endsAt.addingTimeInterval(300)),
                pushType: nil
            )
            call.resolve(["started": true])
        } catch {
            // A failed activity must never break the in-app timer.
            CAPLog.print("RestActivity start failed: \(error.localizedDescription)")
            call.resolve(["started": false])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        endAllActivities()
        call.resolve()
    }

    @available(iOS 16.2, *)
    private func endAllActivities() {
        for activity in Activity<RestActivityAttributes>.activities {
            Task {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
