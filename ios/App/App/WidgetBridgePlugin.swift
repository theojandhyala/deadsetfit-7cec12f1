import Capacitor
import Foundation
import WidgetKit

/// Publishes the numbers the home-screen widgets draw.
///
/// A widget runs in a separate process and cannot see DEADSET's training data,
/// which lives in the WKWebView's localStorage. So the web layer hands over a
/// small snapshot whenever the numbers change, this writes it into the shared
/// App Group container, and the widget reads it there.
///
/// If the App Group is missing — not enabled on the App ID, or a provisioning
/// profile without it — the write silently no-ops and widgets show their empty
/// state. That is deliberate: a failed widget update must never surface as an
/// error in the middle of a workout.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "Widgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        // Same reasoning as the other app-local plugins: a plugin that failed
        // to register is otherwise indistinguishable from one that registered
        // and was never called.
        let reachable = UserDefaults(suiteName: WidgetStore.appGroup) != nil
        NSLog("[DEADSET] Widgets plugin loaded; app group reachable: %@", reachable ? "yes" : "no")
    }

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve([
            // The App Group is the thing that can actually be missing at
            // runtime, so report on that rather than on the iOS version.
            "supported": UserDefaults(suiteName: WidgetStore.appGroup) != nil
        ])
    }

    @objc func publish(_ call: CAPPluginCall) {
        let snapshot = WidgetSnapshot(
            streak: call.getInt("streak") ?? 0,
            trainedToday: call.getBool("trainedToday") ?? false,
            todayLabel: call.getString("todayLabel") ?? "",
            todayExerciseCount: call.getInt("todayExerciseCount") ?? 0,
            rankLabel: call.getString("rankLabel") ?? "",
            rankColorHex: call.getString("rankColorHex") ?? "#E10600",
            gritPoints: call.getInt("gritPoints") ?? 0,
            rankProgress: call.getDouble("rankProgress") ?? 0,
            weekDone: call.getInt("weekDone") ?? 0,
            weekTarget: call.getInt("weekTarget") ?? 0,
            updatedAt: Date()
        )
        WidgetStore.write(snapshot)
        // Reload rather than letting the widget poll: the data only ever moves
        // when the athlete does something here, so a schedule would spend the
        // system refresh budget re-reading an unchanged file.
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["published": true])
    }
}
