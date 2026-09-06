import WatchKit

/// Haptics are the whole point of logging from the wrist: you should be able
/// to tick a set without looking. Kept in one place so the vocabulary stays
/// consistent — one meaning per pattern.
enum WatchHaptics {
    /// A set was recorded.
    static func tick() {
        WKInterfaceDevice.current().play(.click)
    }

    /// A personal record landed.
    static func record() {
        WKInterfaceDevice.current().play(.success)
    }

    /// Rest is over — get up.
    static func restOver() {
        WKInterfaceDevice.current().play(.notification)
    }

    /// The action could not be completed.
    static func failure() {
        WKInterfaceDevice.current().play(.failure)
    }
}
