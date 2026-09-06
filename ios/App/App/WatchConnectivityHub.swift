import Foundation
import WatchConnectivity

/// The phone half of the watch link.
///
/// This is deliberately a singleton that activates at launch rather than
/// something the Capacitor plugin owns. WatchConnectivity delivers queued
/// payloads to the *app*, often before — or entirely without — the web layer
/// running: iOS suspends the WKWebView the moment the app backgrounds, which
/// is exactly the state a phone is in while its owner is looking at their
/// wrist. If the session were only activated when JavaScript asked for it,
/// every set logged with the phone in a pocket would arrive at a delegate that
/// did not exist yet and be dropped on the floor.
///
/// So: the hub receives and buffers natively, and the web layer drains the
/// buffer whenever it next runs.
final class WatchConnectivityHub: NSObject {
    static let shared = WatchConnectivityHub()

    /// Actions received from the watch that JavaScript has not yet consumed.
    private var pending: [WatchAction] = []
    /// Ids already accepted, so a duplicate delivery cannot log a set twice.
    /// Bounded — this is a dedupe window, not an audit log.
    private var seenActionIds: [String] = []
    private static let seenLimit = 200
    /// Newest state we published, resent when the watch reconnects.
    private var lastState: WatchSessionState = .idle

    private let queue = DispatchQueue(label: "org.deadsetfit.watchhub")

    /// Set by the Capacitor plugin while the web layer is alive. When nil,
    /// actions accumulate instead of being delivered.
    var onAction: ((WatchAction) -> Void)?

    /// Called when reachability or pairing changes, so the UI can say so.
    var onStatusChange: (() -> Void)?

    private override init() {
        super.init()
    }

    /// Call once, from AppDelegate, at launch.
    func activate() {
        guard WCSession.isSupported() else {
            NSLog("[DEADSET] WatchConnectivity unsupported on this device")
            return
        }
        let session = WCSession.default
        session.delegate = self
        session.activate()
        NSLog("[DEADSET] WatchConnectivity activating")
    }

    // MARK: - Status

    var isSupported: Bool { WCSession.isSupported() }

    var isPaired: Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.isPaired
    }

    var isWatchAppInstalled: Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.isWatchAppInstalled
    }

    var isReachable: Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.isReachable
    }

    // MARK: - Publishing state

    /// Publish the live session to the watch.
    ///
    /// `updateApplicationContext` rather than `sendMessage`: it keeps exactly
    /// one payload — the latest — and delivers it whenever the watch next
    /// wakes. Losing an intermediate state is harmless because each payload is
    /// complete; failing to deliver the newest one would not be.
    func publish(_ state: WatchSessionState) {
        queue.sync { lastState = state }
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        do {
            try session.updateApplicationContext(WatchCodec.encodeState(state))
        } catch {
            NSLog("[DEADSET] watch publish failed: %@", error.localizedDescription)
        }
    }

    // MARK: - Draining actions

    /// Hand over everything the watch sent while JavaScript was not listening.
    func drainPending() -> [WatchAction] {
        queue.sync {
            let drained = pending
            pending.removeAll()
            return drained
        }
    }

    /// Record an inbound action, rejecting one we have already applied.
    /// Returns the action when it is new, nil when it is a duplicate.
    private func accept(_ action: WatchAction) -> WatchAction? {
        queue.sync {
            guard !seenActionIds.contains(action.id) else { return nil }
            seenActionIds.append(action.id)
            if seenActionIds.count > Self.seenLimit {
                seenActionIds.removeFirst(seenActionIds.count - Self.seenLimit)
            }
            return action
        }
    }

    private func handle(_ payload: [String: Any]) {
        guard let action = WatchCodec.decodeAction(payload) else { return }
        guard let fresh = accept(action) else {
            NSLog("[DEADSET] duplicate watch action ignored: %@", action.id)
            return
        }
        DispatchQueue.main.async {
            if let onAction = self.onAction {
                onAction(fresh)
            } else {
                // No web layer right now: hold it until there is one.
                self.queue.sync { self.pending.append(fresh) }
            }
        }
    }
}

extension WatchConnectivityHub: WCSessionDelegate {
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            NSLog("[DEADSET] watch session activation failed: %@", error.localizedDescription)
            return
        }
        NSLog(
            "[DEADSET] watch session active; paired: %@, app installed: %@",
            session.isPaired ? "yes" : "no",
            session.isWatchAppInstalled ? "yes" : "no"
        )
        // Re-publish: a watch that installed or reconnected after the last
        // publish has no state at all otherwise.
        let state = queue.sync { lastState }
        if state.isLive { publish(state) }
        DispatchQueue.main.async { self.onStatusChange?() }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    /// Required on iOS: the user can switch to a different paired watch, which
    /// deactivates this session. Reactivating is what keeps the link working
    /// after that switch instead of going quietly dead.
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.onStatusChange?() }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { self.onStatusChange?() }
    }

    /// Immediate path, used while the watch app is in the foreground.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handle(message)
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        handle(message)
        // Acknowledge so the watch can drop its optimistic pending marker.
        replyHandler(["ok": true])
    }

    /// Queued path: guaranteed delivery, used when the phone is unreachable.
    /// This is the one that carries sets logged with the phone in a pocket.
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        handle(userInfo)
    }
}
