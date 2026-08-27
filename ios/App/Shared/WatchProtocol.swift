import Foundation

/// The contract between the phone and the watch.
///
/// This file is compiled into BOTH the iOS app and the watch app, so the two
/// can never drift out of sync — the same mistake that makes most companion
/// apps fail silently in the field. If you change a shape here, both sides
/// change together or neither compiles.
///
/// The phone is the source of truth. The watch is a remote control and a
/// mirror: it renders whatever state the phone last published, and it asks the
/// phone to record sets. It never owns training data, which is what keeps this
/// free of merge conflicts.
enum WatchProtocol {
    /// Bumped when a shape changes incompatibly. A watch running an older build
    /// than the phone (they update independently) ignores state it cannot read
    /// rather than rendering it wrong.
    static let version = 1

    /// Keys used in the WatchConnectivity dictionaries.
    enum Key {
        static let version = "v"
        static let state = "state"
        static let action = "action"
        static let actionId = "id"
    }
}

// MARK: - Phone → watch

/// One set already recorded, as the watch should draw it.
struct WatchSet: Codable, Equatable, Hashable {
    var weight: Double
    var reps: Int
    /// "warmup" or "drop"; nil for a working set.
    var kind: String?
    /// "duration" or "distance"; nil for a load-by-reps set.
    var mode: String?
    var seconds: Int?
    var meters: Int?
    var isPR: Bool

    init(
        weight: Double,
        reps: Int,
        kind: String? = nil,
        mode: String? = nil,
        seconds: Int? = nil,
        meters: Int? = nil,
        isPR: Bool = false
    ) {
        self.weight = weight
        self.reps = reps
        self.kind = kind
        self.mode = mode
        self.seconds = seconds
        self.meters = meters
        self.isPR = isPR
    }

    /// How this set reads on a 40mm screen. Mirrors `formatSet` in the web app.
    var display: String {
        if mode == "duration" {
            let time = WatchSet.clock(seconds ?? 0)
            return weight > 0 ? "\(WatchSet.trim(weight))kg · \(time)" : time
        }
        if mode == "distance" {
            let distance = (meters ?? 0) < 1000
                ? "\(meters ?? 0)m"
                : String(format: "%.2fkm", Double(meters ?? 0) / 1000)
            guard let seconds, seconds > 0 else { return distance }
            return "\(distance) · \(WatchSet.clock(seconds))"
        }
        return weight > 0 ? "\(WatchSet.trim(weight))kg × \(reps)" : "\(reps) reps"
    }

    static func clock(_ seconds: Int) -> String {
        let total = max(0, seconds)
        if total < 60 { return "\(total)s" }
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    /// 60.0 → "60", 62.5 → "62.5". Trailing ".0" wastes scarce width.
    static func trim(_ value: Double) -> String {
        value == value.rounded()
            ? String(Int(value))
            : String(format: "%.1f", value)
    }
}

/// One movement in the live session.
struct WatchExercise: Codable, Equatable, Hashable, Identifiable {
    var id: String
    var name: String
    var targetSets: Int
    var targetReps: String
    /// The working weight the phone suggests, so the watch can log with one tap.
    var weight: Double
    /// "WEIGHT", "DURATION" or "DISTANCE".
    var tracking: String
    var targetSeconds: Int?
    var restSeconds: Int
    var sets: [WatchSet]

    /// Working sets only — warm-ups and drops don't advance the plan.
    var workingSetCount: Int {
        sets.filter { $0.kind == nil }.count
    }

    var isComplete: Bool {
        targetSets > 0 && workingSetCount >= targetSets
    }

    var isTimed: Bool { tracking == "DURATION" }
    var isDistance: Bool { tracking == "DISTANCE" }
}

/// Everything the watch needs to draw the session. Published wholesale rather
/// than as diffs: the payload is small, and a full replace cannot desynchronise
/// the way a missed diff can.
struct WatchSessionState: Codable, Equatable {
    var sessionId: String?
    var label: String
    var exercises: [WatchExercise]
    /// Milliseconds since epoch, used to discard an out-of-order delivery.
    /// WatchConnectivity does not guarantee ordering between transports.
    var updatedAt: Double

    static let idle = WatchSessionState(
        sessionId: nil,
        label: "",
        exercises: [],
        updatedAt: 0
    )

    var isLive: Bool { sessionId != nil && !exercises.isEmpty }

    var totalVolume: Double {
        exercises.reduce(0) { running, exercise in
            running + exercise.sets.reduce(0) { inner, set in
                // Warm-ups and timed efforts carry no tonnage, exactly as on
                // the phone.
                guard set.kind != "warmup", set.mode == nil else { return inner }
                return inner + set.weight * Double(set.reps)
            }
        }
    }

    var loggedSetCount: Int {
        exercises.reduce(0) { $0 + $1.sets.count }
    }

    var plannedSetCount: Int {
        exercises.reduce(0) { $0 + max($1.targetSets, $1.workingSetCount) }
    }
}

// MARK: - Watch → phone

/// Something the athlete did on the wrist, for the phone to apply.
///
/// Every action carries an id. Delivery can arrive twice (an immediate send
/// that the sender never saw acknowledged, then the queued retry), and logging
/// the same set twice would inflate volume and hand out a phantom PR — so the
/// phone deduplicates on this id.
struct WatchAction: Codable, Equatable {
    enum Kind: String, Codable {
        case logSet
        case undoSet
        case finish
    }

    var id: String
    var kind: Kind
    var sessionId: String
    var exerciseId: String
    var weight: Double
    var reps: Int
    var mode: String?
    var seconds: Int?
    var meters: Int?

    init(
        id: String = UUID().uuidString,
        kind: Kind,
        sessionId: String,
        exerciseId: String,
        weight: Double = 0,
        reps: Int = 0,
        mode: String? = nil,
        seconds: Int? = nil,
        meters: Int? = nil
    ) {
        self.id = id
        self.kind = kind
        self.sessionId = sessionId
        self.exerciseId = exerciseId
        self.weight = weight
        self.reps = reps
        self.mode = mode
        self.seconds = seconds
        self.meters = meters
    }
}

// MARK: - Transport encoding

/// WatchConnectivity carries property-list dictionaries, not arbitrary types,
/// so both sides funnel through JSON in a single `Data` value. One encoder,
/// one decoder, no per-field plist coercion to get wrong.
enum WatchCodec {
    // Fresh instances per call rather than shared statics: WatchConnectivity
    // delivers on its own queue, JSONEncoder and JSONDecoder are not
    // thread-safe, and a shared one here would be mutable state touched from
    // whichever thread the system chose. These payloads are a few hundred
    // bytes a handful of times a minute — the allocation is not worth a data
    // race.
    static func encodeState(_ state: WatchSessionState) -> [String: Any] {
        guard let data = try? JSONEncoder().encode(state) else { return [:] }
        return [
            WatchProtocol.Key.version: WatchProtocol.version,
            WatchProtocol.Key.state: data
        ]
    }

    static func decodeState(_ payload: [String: Any]) -> WatchSessionState? {
        guard
            let version = payload[WatchProtocol.Key.version] as? Int,
            version == WatchProtocol.version,
            let data = payload[WatchProtocol.Key.state] as? Data
        else { return nil }
        return try? JSONDecoder().decode(WatchSessionState.self, from: data)
    }

    static func encodeAction(_ action: WatchAction) -> [String: Any] {
        guard let data = try? JSONEncoder().encode(action) else { return [:] }
        return [
            WatchProtocol.Key.version: WatchProtocol.version,
            WatchProtocol.Key.action: data,
            WatchProtocol.Key.actionId: action.id
        ]
    }

    static func decodeAction(_ payload: [String: Any]) -> WatchAction? {
        guard
            let version = payload[WatchProtocol.Key.version] as? Int,
            version == WatchProtocol.version,
            let data = payload[WatchProtocol.Key.action] as? Data
        else { return nil }
        return try? JSONDecoder().decode(WatchAction.self, from: data)
    }
}
