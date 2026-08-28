import ActivityKit
import Capacitor
import Foundation

/// Drives the live-workout Live Activity.
///
/// Separate from `RestActivityPlugin` because the two answer different
/// questions and can be on screen together: rest is "how long until the next
/// set", this is "where am I in this session".
///
/// The session clock is never pushed. `startedAt` goes into the content state
/// once and the system renders elapsed time from it, so the only updates this
/// sends are when a set actually lands — which matters, because iOS rate-limits
/// Live Activity updates and drops the ones over budget.
@objc(WorkoutActivityPlugin)
public class WorkoutActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WorkoutActivityPlugin"
    public let jsName = "WorkoutActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    /// Held so update and end address the activity this app started, rather
    /// than searching `Activity.activities` and guessing at a stale one.
    private var activityId: String?

    override public func load() {
        if #available(iOS 16.2, *) {
            NSLog(
                "[DEADSET] WorkoutActivity plugin loaded; live activities enabled: %@",
                ActivityAuthorizationInfo().areActivitiesEnabled ? "yes" : "no"
            )
        } else {
            NSLog("[DEADSET] WorkoutActivity plugin loaded; Live Activities need iOS 16.2+")
        }
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            // Enabled is a per-app user setting, so a capable device can still
            // have them switched off.
            call.resolve(["supported": ActivityAuthorizationInfo().areActivitiesEnabled])
        } else {
            call.resolve(["supported": false])
        }
    }

    @available(iOS 16.2, *)
    private func contentState(from call: CAPPluginCall) -> WorkoutActivityAttributes.ContentState {
        // Milliseconds since epoch: the web layer's native unit, and unambiguous
        // across the bridge in a way an ISO string is not.
        let startedMs = call.getDouble("startedAtMs") ?? (Date().timeIntervalSince1970 * 1000)
        return WorkoutActivityAttributes.ContentState(
            exerciseName: call.getString("exerciseName") ?? "",
            setsDone: call.getInt("setsDone") ?? 0,
            setsPlanned: call.getInt("setsPlanned") ?? 0,
            volumeKg: call.getInt("volumeKg") ?? 0,
            // Falls back to labelling kilograms only if the web layer sent no
            // formatted string at all — never to a silently wrong unit.
            volumeText: call.getString("volumeText") ?? "\(call.getInt("volumeKg") ?? 0) kg",
            prCount: call.getInt("prCount") ?? 0,
            startedAt: Date(timeIntervalSince1970: startedMs / 1000)
        )
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
        // Starting a second activity for the same workout would stack two
        // identical cards on the Lock Screen; update the existing one instead.
        if activityId != nil {
            update(call)
            return
        }
        do {
            let activity = try Activity.request(
                attributes: WorkoutActivityAttributes(label: call.getString("label") ?? "WORKOUT"),
                content: ActivityContent(state: contentState(from: call), staleDate: nil)
            )
            activityId = activity.id
            call.resolve(["started": true])
        } catch {
            NSLog("[DEADSET] workout activity failed to start: %@", error.localizedDescription)
            call.resolve(["started": false])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *), let id = activityId else {
            call.resolve(["updated": false])
            return
        }
        let state = contentState(from: call)
        Task {
            guard let activity = Activity<WorkoutActivityAttributes>.activities
                .first(where: { $0.id == id })
            else {
                await MainActor.run { self.activityId = nil }
                call.resolve(["updated": false])
                return
            }
            await activity.update(ActivityContent(state: state, staleDate: nil))
            call.resolve(["updated": true])
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ended": true])
            return
        }
        activityId = nil
        Task {
            // Every workout activity, not only the one this process started: an
            // activity outlives the app that requested it, so after a relaunch
            // mid-session the tracked id is gone while the card is still on the
            // Lock Screen. Leaving one there forever is the worst failure this
            // feature has, and there is only ever one workout at a time.
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve(["ended": true])
        }
    }
}
