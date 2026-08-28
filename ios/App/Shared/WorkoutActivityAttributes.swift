import ActivityKit
import Foundation

/// The live workout as it appears on the Lock Screen and Dynamic Island.
///
/// Distinct from `RestActivityAttributes`, which covers the gap between sets.
/// This one runs for the whole session, so its content is pushed by the app as
/// sets land — but the elapsed time is still rendered by the system from
/// `startedAt` rather than pushed, because per-second updates are rate-limited
/// and would drain the battery for a number iOS can draw itself.
///
/// Compiled into BOTH the app and the widget extension. If the types do not
/// match at runtime, `Activity.request` fails.
public struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// The movement currently being worked.
        public var exerciseName: String
        /// Working sets completed against the plan.
        public var setsDone: Int
        public var setsPlanned: Int
        /// Tonnage so far, in kilograms.
        public var volumeKg: Int
        /// The same tonnage, already formatted in the athlete's own unit.
        /// The extension has no access to that setting, so the app sends the
        /// finished string rather than a number this side would mislabel.
        public var volumeText: String
        /// Records set this session — worth surfacing the moment one lands.
        public var prCount: Int
        /// When the session began. The system renders elapsed time from this.
        public var startedAt: Date

        public init(
            exerciseName: String,
            setsDone: Int,
            setsPlanned: Int,
            volumeKg: Int,
            volumeText: String,
            prCount: Int,
            startedAt: Date
        ) {
            self.exerciseName = exerciseName
            self.setsDone = setsDone
            self.setsPlanned = setsPlanned
            self.volumeKg = volumeKg
            self.volumeText = volumeText
            self.prCount = prCount
            self.startedAt = startedAt
        }
    }

    /// The session's name, e.g. "PUSH".
    public var label: String

    public init(label: String) {
        self.label = label
    }
}
