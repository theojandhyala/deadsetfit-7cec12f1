import Capacitor
import Foundation

/// Exposes the watch link to the web layer.
///
/// The plugin is a thin facade over `WatchConnectivityHub`: the hub owns the
/// WCSession and the buffer so that neither depends on JavaScript being alive,
/// and this class only translates between that buffer and Capacitor calls.
@objc(WatchBridgePlugin)
public class WatchBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchBridgePlugin"
    public let jsName = "WatchBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drain", returnType: CAPPluginReturnPromise)
    ]

    /// Mirrors RestActivityPlugin: a plugin that failed to register is
    /// otherwise indistinguishable from one that registered and was never
    /// called, which is how a whole feature can ship dead and stay green.
    override public func load() {
        let hub = WatchConnectivityHub.shared
        NSLog(
            "[DEADSET] WatchBridge plugin loaded; supported: %@, paired: %@",
            hub.isSupported ? "yes" : "no",
            hub.isPaired ? "yes" : "no"
        )
        hub.onAction = { [weak self] action in
            self?.notifyListeners("watchAction", data: Self.payload(for: action))
        }
        hub.onStatusChange = { [weak self] in
            guard let self else { return }
            self.notifyListeners("watchStatus", data: Self.statusPayload())
        }
    }

    deinit {
        // The web layer is going away; stop handing it actions and let them
        // buffer again rather than delivering into a dead listener.
        WatchConnectivityHub.shared.onAction = nil
        WatchConnectivityHub.shared.onStatusChange = nil
    }

    private static func statusPayload() -> [String: Any] {
        let hub = WatchConnectivityHub.shared
        return [
            "supported": hub.isSupported,
            "paired": hub.isPaired,
            "installed": hub.isWatchAppInstalled,
            "reachable": hub.isReachable
        ]
    }

    private static func payload(for action: WatchAction) -> [String: Any] {
        var out: [String: Any] = [
            "id": action.id,
            "kind": action.kind.rawValue,
            "sessionId": action.sessionId,
            "exerciseId": action.exerciseId,
            "weight": action.weight,
            "reps": action.reps
        ]
        if let mode = action.mode { out["mode"] = mode }
        if let seconds = action.seconds { out["seconds"] = seconds }
        if let meters = action.meters { out["meters"] = meters }
        return out
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(Self.statusPayload())
    }

    /// Publish the live session. An absent or empty `sessionId` clears the
    /// watch back to its idle screen, which is what finishing a workout does.
    @objc func publish(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId")
        let label = call.getString("label") ?? ""
        let exercises = (call.getValue("exercises") as? [[String: Any]]) ?? []

        let state = WatchSessionState(
            sessionId: (sessionId?.isEmpty ?? true) ? nil : sessionId,
            label: label,
            exercises: exercises.compactMap(Self.exercise(from:)),
            updatedAt: Date().timeIntervalSince1970 * 1000
        )
        WatchConnectivityHub.shared.publish(state)
        call.resolve(["published": true])
    }

    /// Everything the watch sent while the web layer was suspended.
    @objc func drain(_ call: CAPPluginCall) {
        let actions = WatchConnectivityHub.shared.drainPending()
        call.resolve(["actions": actions.map(Self.payload(for:))])
    }

    // MARK: - Decoding the JS payload

    private static func exercise(from raw: [String: Any]) -> WatchExercise? {
        guard
            let id = raw["id"] as? String,
            let name = raw["name"] as? String
        else { return nil }
        return WatchExercise(
            id: id,
            name: name,
            targetSets: intValue(raw["targetSets"]) ?? 3,
            targetReps: raw["targetReps"] as? String ?? "",
            weight: doubleValue(raw["weight"]) ?? 0,
            tracking: raw["tracking"] as? String ?? "WEIGHT",
            targetSeconds: intValue(raw["targetSeconds"]),
            restSeconds: intValue(raw["restSeconds"]) ?? 90,
            barKg: doubleValue(raw["barKg"]) ?? 20,
            ghost: ((raw["ghost"] as? [[String: Any]]) ?? []).map(set(from:)),
            sets: ((raw["sets"] as? [[String: Any]]) ?? []).map(set(from:))
        )
    }

    private static func set(from raw: [String: Any]) -> WatchSet {
        WatchSet(
            weight: doubleValue(raw["weight"]) ?? 0,
            reps: intValue(raw["reps"]) ?? 0,
            kind: raw["kind"] as? String,
            mode: raw["mode"] as? String,
            seconds: intValue(raw["seconds"]),
            meters: intValue(raw["meters"]),
            isPR: raw["isPR"] as? Bool ?? false
        )
    }

    /// JavaScript numbers arrive as NSNumber, but a value that round-tripped
    /// through JSON can also land as a String. Accept both rather than
    /// silently defaulting a real weight to zero.
    private static func doubleValue(_ raw: Any?) -> Double? {
        if let number = raw as? NSNumber { return number.doubleValue }
        if let text = raw as? String { return Double(text) }
        return nil
    }

    private static func intValue(_ raw: Any?) -> Int? {
        if let number = raw as? NSNumber { return number.intValue }
        if let text = raw as? String { return Int(text) }
        return nil
    }
}
