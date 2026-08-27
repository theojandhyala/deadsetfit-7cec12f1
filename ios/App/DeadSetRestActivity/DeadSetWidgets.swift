import SwiftUI
import WidgetKit

/// Home-screen and Lock Screen widgets.
///
/// These read a snapshot the app writes into the shared App Group. There is no
/// live data here and no network: a widget process cannot reach the WKWebView
/// where DEADSET keeps its training state, so the app pushes what the widget
/// needs whenever it changes.
///
/// The timeline is deliberately dumb — one entry, refreshed when the app says
/// so via `WidgetCenter.reloadAllTimelines()`. Widgets that schedule their own
/// refreshes burn the system's budget and still show stale numbers, because
/// the data only ever changes when the athlete does something in the app.
struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: Date(), snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(SnapshotEntry(date: Date(), snapshot: WidgetStore.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let entry = SnapshotEntry(date: Date(), snapshot: WidgetStore.read())
        // .never: the app reloads us when the numbers actually change. A
        // polling schedule would spend the refresh budget re-reading a file
        // that has not moved.
        completion(Timeline(entries: [entry], policy: .never))
    }
}

private let brandRed = Color(red: 225 / 255, green: 6 / 255, blue: 0)

/// "#E10600" → Color. Falls back to the brand red rather than throwing away a
/// widget render over a malformed string.
private func color(fromHex hex: String) -> Color {
    var value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    if value.count == 3 {
        value = value.map { "\($0)\($0)" }.joined()
    }
    guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return brandRed }
    return Color(
        red: Double((rgb >> 16) & 0xFF) / 255,
        green: Double((rgb >> 8) & 0xFF) / 255,
        blue: Double(rgb & 0xFF) / 255
    )
}

// MARK: - Streak

struct StreakWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: WidgetSnapshot

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: -2) {
                    Text("\(snapshot.streak)")
                        .font(.system(size: 22, weight: .black, design: .rounded))
                    Text("DAY")
                        .font(.system(size: 8, weight: .black))
                }
            }
        case .accessoryInline:
            Text(inlineText)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text("DEADSET")
                    .font(.system(size: 10, weight: .black))
                    .tracking(1.5)
                Text("\(snapshot.streak) day streak")
                    .font(.system(size: 15, weight: .heavy))
                Text(todayLine)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        default:
            homeScreen
        }
    }

    private var inlineText: String {
        snapshot.streak > 0 ? "\(snapshot.streak)d · \(todayLine)" : todayLine
    }

    private var todayLine: String {
        if snapshot.trainedToday { return "Done today" }
        if snapshot.isRestDay { return "Rest day" }
        return snapshot.todayLabel
    }

    private var homeScreen: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text("DEADSET")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2)
                    .foregroundStyle(brandRed)
                Spacer()
                if snapshot.trainedToday {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.green)
                }
            }

            Spacer(minLength: 4)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text("\(snapshot.streak)")
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                Text("DAY")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(.secondary)
            }
            Text(snapshot.streak == 1 ? "STREAK" : "STREAK")
                .font(.system(size: 10, weight: .black))
                .tracking(2)
                .foregroundStyle(.secondary)

            Spacer(minLength: 4)

            Text(todayHeadline)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(snapshot.trainedToday ? Color.secondary : Color.white)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    private var todayHeadline: String {
        if snapshot.trainedToday { return "Logged today" }
        if snapshot.isRestDay { return "Rest day" }
        if snapshot.todayExerciseCount > 0 {
            return "\(snapshot.todayLabel) · \(snapshot.todayExerciseCount)"
        }
        return snapshot.todayLabel
    }
}

struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DeadSetStreak", provider: SnapshotProvider()) { entry in
            widgetContainer { StreakWidgetView(snapshot: entry.snapshot) }
        }
        .configurationDisplayName("Streak")
        .description("Your training streak and what is on today.")
        .supportedFamilies([
            .systemSmall,
            .accessoryCircular,
            .accessoryInline,
            .accessoryRectangular
        ])
    }
}

// MARK: - Rank

struct RankWidgetView: View {
    let snapshot: WidgetSnapshot

    var body: some View {
        let rankColor = color(fromHex: snapshot.rankColorHex)
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                Text("RANK")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2)
                    .foregroundStyle(.secondary)
                Text(snapshot.rankLabel.isEmpty ? "UNRANKED" : snapshot.rankLabel)
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(rankColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(snapshot.gritPoints) GRIT")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.secondary)

                Spacer(minLength: 6)

                ProgressView(value: min(1, max(0, snapshot.rankProgress)))
                    .progressViewStyle(.linear)
                    .tint(rankColor)
            }

            Divider().overlay(Color.white.opacity(0.12))

            VStack(alignment: .leading, spacing: 0) {
                Text("THIS WEEK")
                    .font(.system(size: 10, weight: .black))
                    .tracking(2)
                    .foregroundStyle(.secondary)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(snapshot.weekDone)")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                    Text("/\(max(snapshot.weekTarget, snapshot.weekDone))")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                Text(snapshot.streak > 0 ? "\(snapshot.streak) day streak" : "No streak yet")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(snapshot.streak > 0 ? brandRed : .secondary)
                    .lineLimit(1)
            }
        }
    }
}

struct RankWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DeadSetRank", provider: SnapshotProvider()) { entry in
            widgetContainer { RankWidgetView(snapshot: entry.snapshot) }
        }
        .configurationDisplayName("Rank & week")
        .description("Where you sit on the ladder and how this week is going.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Container

/// `containerBackground` is required from iOS 17 — a widget without one is
/// blank on the Home Screen — but the API does not exist before it, so the
/// older path keeps the manual background.
@ViewBuilder
private func widgetContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    if #available(iOS 17.0, *) {
        content()
            .containerBackground(for: .widget) { Color.black }
    } else {
        content()
            .padding(14)
            .background(Color.black)
    }
}
