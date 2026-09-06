import Foundation

/// What the home-screen widgets draw.
///
/// A widget runs in its own process and cannot see the app's data: DEADSET
/// keeps training state in the WKWebView's localStorage, which is invisible
/// outside the web view. So the app writes this snapshot into a shared App
/// Group container whenever the numbers change, and the widget reads it.
///
/// Compiled into BOTH the app and the widget extension, so writer and reader
/// can never disagree about the shape.
public struct WidgetSnapshot: Codable, Equatable {
    /// Consecutive training days.
    public var streak: Int
    /// Whether today's session is already done — the widget says "done", not
    /// "due", which is the difference between a nudge and a nag.
    public var trainedToday: Bool
    /// Today's session name, e.g. "PUSH". Empty on a rest day.
    public var todayLabel: String
    public var todayExerciseCount: Int
    /// Rank as shown in the app, e.g. "GOLD II".
    public var rankLabel: String
    /// Rank colour as "#RRGGBB", so the widget matches the app's ladder.
    public var rankColorHex: String
    public var gritPoints: Int
    /// Progress through the current rank, 0...1.
    public var rankProgress: Double
    /// Sessions done this week against the athlete's own target.
    public var weekDone: Int
    public var weekTarget: Int
    public var updatedAt: Date

    public init(
        streak: Int = 0,
        trainedToday: Bool = false,
        todayLabel: String = "",
        todayExerciseCount: Int = 0,
        rankLabel: String = "",
        rankColorHex: String = "#E10600",
        gritPoints: Int = 0,
        rankProgress: Double = 0,
        weekDone: Int = 0,
        weekTarget: Int = 0,
        updatedAt: Date = .distantPast
    ) {
        self.streak = streak
        self.trainedToday = trainedToday
        self.todayLabel = todayLabel
        self.todayExerciseCount = todayExerciseCount
        self.rankLabel = rankLabel
        self.rankColorHex = rankColorHex
        self.gritPoints = gritPoints
        self.rankProgress = rankProgress
        self.weekDone = weekDone
        self.weekTarget = weekTarget
        self.updatedAt = updatedAt
    }

    /// Shown before the app has ever written a snapshot — a freshly installed
    /// widget, or one added before the first workout. Deliberately not zeroes
    /// pretending to be real data.
    public static let placeholder = WidgetSnapshot(
        streak: 0,
        trainedToday: false,
        todayLabel: "",
        todayExerciseCount: 0,
        rankLabel: "IRON",
        rankColorHex: "#8A8A8A",
        gritPoints: 0,
        rankProgress: 0,
        weekDone: 0,
        weekTarget: 0,
        updatedAt: .distantPast
    )

    /// Has the app ever written real data here?
    public var isEmpty: Bool { updatedAt == .distantPast }

    /// A rest day is one with nothing scheduled.
    public var isRestDay: Bool { todayLabel.isEmpty || todayLabel.uppercased() == "REST" }
}

/// Where the app and its widgets meet.
public enum WidgetStore {
    /// Must match the App Group on both the app and the extension targets, and
    /// the group registered on the App ID in the developer account.
    public static let appGroup = "group.org.deadsetfit.app"
    private static let key = "deadset.widget.snapshot"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroup)
    }

    public static func write(_ snapshot: WidgetSnapshot) {
        guard let defaults, let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults.set(data, forKey: key)
    }

    /// Reads the last snapshot, or the placeholder when the App Group is
    /// missing or nothing has been written. Never returns nil: a widget that
    /// cannot render is worse than one showing an honest empty state.
    public static func read() -> WidgetSnapshot {
        guard
            let defaults,
            let data = defaults.data(forKey: key),
            let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
        else { return .placeholder }
        return snapshot
    }
}
