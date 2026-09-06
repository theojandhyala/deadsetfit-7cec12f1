import Foundation
import WatchConnectivity

/// The watch half of the link.
///
/// Holds the state the phone published and sends back what the athlete does.
/// It keeps an optimistic overlay: a set ticked on the wrist appears
/// immediately, before the phone has confirmed it, because a logger that waits
/// on Bluetooth before drawing a tick feels broken even when it is working.
/// The overlay is discarded as soon as the phone publishes state that already
/// contains the set.
@MainActor
final class WatchConnector: NSObject, ObservableObject {
    @Published private(set) var state: WatchSessionState = .idle
    @Published private(set) var isReachable = false
    /// Actions sent but not yet reflected in state published by the phone.
    @Published private(set) var pendingActionIds: Set<String> = []
    /// Locally applied sets, keyed by exercise id, shown until the phone
    /// catches up.
    @Published private(set) var optimisticSets: [String: [WatchSet]] = [:]

    private var lastUpdatedAt: Double = 0

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// The session as the athlete should see it: what the phone published,
    /// plus anything logged here that has not made the round trip yet.
    var displayState: WatchSessionState {
        guard !optimisticSets.isEmpty else { return state }
        var merged = state
        merged.exercises = merged.exercises.map { exercise in
            guard let extra = optimisticSets[exercise.id], !extra.isEmpty else { return exercise }
            var copy = exercise
            copy.sets.append(contentsOf: extra)
            return copy
        }
        return merged
    }

    // MARK: - Sending

    func logSet(exercise: WatchExercise, weight: Double, reps: Int) {
        guard let sessionId = state.sessionId else { return }
        send(
            WatchAction(
                kind: .logSet,
                sessionId: sessionId,
                exerciseId: exercise.id,
                weight: weight,
                reps: reps
            ),
            optimistic: WatchSet(weight: weight, reps: reps),
            on: exercise.id
        )
    }

    func logHold(exercise: WatchExercise, seconds: Int, weight: Double = 0) {
        guard let sessionId = state.sessionId, seconds > 0 else { return }
        send(
            WatchAction(
                kind: .logSet,
                sessionId: sessionId,
                exerciseId: exercise.id,
                weight: weight,
                reps: 0,
                mode: "duration",
                seconds: seconds
            ),
            optimistic: WatchSet(weight: weight, reps: 0, mode: "duration", seconds: seconds),
            on: exercise.id
        )
    }

    func logDistance(exercise: WatchExercise, meters: Int, seconds: Int?) {
        guard let sessionId = state.sessionId, meters > 0 else { return }
        send(
            WatchAction(
                kind: .logSet,
                sessionId: sessionId,
                exerciseId: exercise.id,
                mode: "distance",
                seconds: seconds,
                meters: meters
            ),
            optimistic: WatchSet(weight: 0, reps: 0, mode: "distance", seconds: seconds, meters: meters),
            on: exercise.id
        )
    }

    func undoLastSet(exercise: WatchExercise) {
        guard let sessionId = state.sessionId else { return }
        // Take back the optimistic one first if it hasn't landed yet, so undo
        // feels immediate and cannot remove a set the phone already has.
        if var local = optimisticSets[exercise.id], !local.isEmpty {
            local.removeLast()
            optimisticSets[exercise.id] = local.isEmpty ? nil : local
        }
        send(
            WatchAction(kind: .undoSet, sessionId: sessionId, exerciseId: exercise.id),
            optimistic: nil,
            on: exercise.id
        )
    }

    func finishWorkout() {
        guard let sessionId = state.sessionId else { return }
        send(
            WatchAction(kind: .finish, sessionId: sessionId, exerciseId: ""),
            optimistic: nil,
            on: nil
        )
    }

    private func send(_ action: WatchAction, optimistic: WatchSet?, on exerciseId: String?) {
        if let optimistic, let exerciseId {
            optimisticSets[exerciseId, default: []].append(optimistic)
        }
        pendingActionIds.insert(action.id)

        let payload = WatchCodec.encodeAction(action)
        let session = WCSession.default

        // Reachable: send now and take the acknowledgement. Not reachable:
        // queue it. transferUserInfo survives the phone being asleep, the app
        // being killed, and the watch leaving Bluetooth range — which is the
        // normal condition of a phone in a gym locker.
        if session.isReachable {
            session.sendMessage(
                payload,
                replyHandler: { [weak self] _ in
                    Task { @MainActor in self?.pendingActionIds.remove(action.id) }
                },
                errorHandler: { [weak self] _ in
                    // The immediate path failed after we committed to it, so
                    // fall back to the guaranteed one. The phone deduplicates
                    // on action id, so arriving twice is safe.
                    session.transferUserInfo(payload)
                    Task { @MainActor in self?.pendingActionIds.remove(action.id) }
                }
            )
        } else {
            session.transferUserInfo(payload)
            pendingActionIds.remove(action.id)
        }

        WatchHaptics.tick()
    }

    /// Did a personal record appear that was not in the previous state?
    private static func hasNewRecord(before: WatchSessionState, after: WatchSessionState) -> Bool {
        // A different session entirely is not "a new record in this one".
        guard before.sessionId == after.sessionId else { return false }
        for exercise in after.exercises {
            let previous = before.exercises.first { $0.id == exercise.id }
            let had = previous?.sets.filter(\.isPR).count ?? 0
            if exercise.sets.filter(\.isPR).count > had { return true }
        }
        return false
    }

    // MARK: - Receiving

    nonisolated fileprivate func apply(_ payload: [String: Any]) {
        guard let incoming = WatchCodec.decodeState(payload) else { return }
        Task { @MainActor in
            // Transports do not guarantee ordering, so an older payload can
            // arrive after a newer one. Applying it would resurrect sets the
            // athlete has already undone.
            guard incoming.updatedAt >= self.lastUpdatedAt else { return }
            self.lastUpdatedAt = incoming.updatedAt

            // Drop optimistic sets the phone has now accounted for.
            for exercise in incoming.exercises {
                guard let local = self.optimisticSets[exercise.id] else { continue }
                let confirmed = exercise.sets.count
                let previous = self.state.exercises.first { $0.id == exercise.id }?.sets.count ?? 0
                let landed = max(0, confirmed - previous)
                if landed >= local.count {
                    self.optimisticSets[exercise.id] = nil
                } else if landed > 0 {
                    self.optimisticSets[exercise.id] = Array(local.dropFirst(landed))
                }
            }
            // A finished session clears the overlay outright.
            if !incoming.isLive { self.optimisticSets.removeAll() }

            // Records are decided on the phone, so the wrist only learns about
            // one when the state comes back. Buzzing here — rather than
            // optimistically on send — means the pattern is never a lie.
            if Self.hasNewRecord(before: self.state, after: incoming) {
                WatchHaptics.record()
            }

            self.state = incoming
        }
    }
}

extension WatchConnector: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let reachable = session.isReachable
        Task { @MainActor in self.isReachable = reachable }
        // The phone's last application context is waiting for us at
        // activation; without reading it here a watch app launched mid-workout
        // shows an empty screen until the next set is logged on the phone.
        let context = session.receivedApplicationContext
        if !context.isEmpty { apply(context) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        apply(context)
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in self.isReachable = reachable }
    }
}
