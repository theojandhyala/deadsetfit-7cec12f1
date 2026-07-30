import ActivityKit
import Foundation

/// Shared contract between the app (which starts and ends the activity) and the
/// widget extension (which draws it). This file must belong to BOTH targets — the
/// App target and DeadSetRestActivityExtension — otherwise the types do not match
/// at runtime and `Activity.request` fails.
public struct RestActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// When rest ends. The Dynamic Island counts down to this itself with a
        /// native timer style, so the app never pushes per-second updates —
        /// iOS rate-limits frequent updates and they would cost battery for
        /// nothing.
        public var endsAt: Date
        /// Total rest length, so the widget can draw progress.
        public var totalSeconds: Int

        public init(endsAt: Date, totalSeconds: Int) {
            self.endsAt = endsAt
            self.totalSeconds = totalSeconds
        }
    }

    /// The movement being rested between, e.g. "Bench Press".
    public var exerciseName: String

    public init(exerciseName: String) {
        self.exerciseName = exerciseName
    }
}
