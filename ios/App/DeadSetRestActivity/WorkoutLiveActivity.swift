import ActivityKit
import SwiftUI
import WidgetKit

private let workoutRed = Color(red: 225 / 255, green: 6 / 255, blue: 0)

/// The live workout on the Lock Screen and Dynamic Island.
///
/// Sits alongside the rest-timer activity rather than replacing it: they answer
/// different questions. Rest asks "how long until the next set"; this asks
/// "where am I in this session". Both can be live at once, and iOS stacks them.
///
/// Elapsed time is rendered by the system from `startedAt` rather than pushed
/// by the app. Live Activity updates are rate-limited, and a session clock that
/// depended on them would stutter or freeze whenever the app was suspended —
/// which, mid-set, it usually is.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            lockScreen(context)
                .activityBackgroundTint(Color.black.opacity(0.92))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // The leading region is narrow and hugs the island's left
                // curve. A long session name ("UPPER — CHEST / BACK / ARMS")
                // wrapped to three lines and had its first glyph clipped by
                // the tracking, which pushed everything below it out of shape.
                // One line, tight tracking, and a little left padding.
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(context.attributes.label.uppercased())
                            .font(.system(size: 9, weight: .black))
                            .tracking(0.6)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .foregroundStyle(workoutRed)
                        Text(context.state.exerciseName)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .minimumScaleFactor(0.85)
                    }
                    .padding(.leading, 4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 3) {
                        // Past an hour the timer reads "1:02:35"; without a
                        // scale floor it clips rather than shrinks.
                        Text(context.state.startedAt, style: .timer)
                            .font(.system(size: 19, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 86)
                        Text("\(context.state.setsDone)/\(context.state.setsPlanned) sets")
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 16) {
                        stat("VOLUME", context.state.volumeText)
                        if context.state.prCount > 0 {
                            stat("PRS", "\(context.state.prCount)", accent: true)
                        }
                        Spacer(minLength: 8)
                        ProgressView(
                            value: Double(context.state.setsDone),
                            total: Double(max(context.state.setsPlanned, context.state.setsDone, 1))
                        )
                        .progressViewStyle(.linear)
                        .tint(workoutRed)
                        .frame(maxWidth: 110)
                    }
                    .padding(.top, 2)
                }
            } compactLeading: {
                if context.state.prCount > 0 {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(workoutRed)
                } else {
                    Circle().fill(workoutRed).frame(width: 8, height: 8)
                }
            } compactTrailing: {
                Text("\(context.state.setsDone)/\(context.state.setsPlanned)")
                    .font(.system(size: 13, weight: .heavy))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            } minimal: {
                Circle().fill(workoutRed).frame(width: 8, height: 8)
            }
            .keylineTint(workoutRed)
        }
    }
}

@ViewBuilder
private func lockScreen(
    _ context: ActivityViewContext<WorkoutActivityAttributes>
) -> some View {
    VStack(spacing: 8) {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.label.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .tracking(1.4)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .foregroundStyle(workoutRed)
                Text(context.state.exerciseName)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            Text(context.state.startedAt, style: .timer)
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 118)
        }

        ProgressView(
            value: Double(context.state.setsDone),
            total: Double(max(context.state.setsPlanned, context.state.setsDone, 1))
        )
        .progressViewStyle(.linear)
        .tint(workoutRed)

        HStack(spacing: 16) {
            stat("SETS", "\(context.state.setsDone)/\(context.state.setsPlanned)")
            stat("VOLUME", context.state.volumeText)
            if context.state.prCount > 0 {
                stat("PRS", "\(context.state.prCount)", accent: true)
            }
            Spacer(minLength: 0)
        }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
}

@ViewBuilder
private func stat(_ label: String, _ value: String, accent: Bool = false) -> some View {
    VStack(alignment: .leading, spacing: 1) {
        Text(label)
            .font(.system(size: 9, weight: .black))
            .tracking(1.5)
            .foregroundStyle(.secondary)
        Text(value)
            .font(.system(size: 14, weight: .heavy))
            .foregroundStyle(accent ? workoutRed : .white)
    }
}

