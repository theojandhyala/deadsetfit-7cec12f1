import ActivityKit
import SwiftUI
import WidgetKit

/// The rest timer as it appears outside the app: Dynamic Island when the phone is
/// in use, Lock Screen when it is face-down on a bench.
///
/// Everything counts down with `.timer` against `endsAt` rather than a value the
/// app pushes. That keeps it exact with zero updates from DEADSET — the countdown
/// continues even if the app is suspended or killed mid-rest.
@main
struct DeadSetRestActivityBundle: WidgetBundle {
    var body: some Widget {
        RestLiveActivity()
    }
}

private let brandRed = Color(red: 225 / 255, green: 6 / 255, blue: 0)

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            // Lock Screen / notification-centre presentation.
            HStack(spacing: 14) {
                Image("RestMark")
                    .resizable()
                    .frame(width: 34, height: 34)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text("REST")
                        .font(.system(size: 10, weight: .black))
                        .tracking(2)
                        .foregroundStyle(brandRed)
                    Text(context.attributes.exerciseName)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }

                Spacer()

                Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(Color.black.opacity(0.92))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("REST")
                            .font(.system(size: 10, weight: .black))
                            .tracking(2)
                            .foregroundStyle(brandRed)
                        Text(context.attributes.exerciseName)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                        .font(.system(size: 26, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .frame(maxWidth: 74)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressView(
                        timerInterval: Date.now...context.state.endsAt,
                        countsDown: true
                    ) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(brandRed)
                }
            } compactLeading: {
                // The collapsed pill: a red dot reads as "DEADSET" at 20 points
                // where the wordmark would be illegible.
                Circle()
                    .fill(brandRed)
                    .frame(width: 8, height: 8)
            } compactTrailing: {
                Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                    .monospacedDigit()
                    .frame(maxWidth: 44)
                    .foregroundStyle(.white)
            } minimal: {
                Text(timerInterval: Date.now...context.state.endsAt, countsDown: true)
                    .monospacedDigit()
                    .foregroundStyle(brandRed)
            }
            .keylineTint(brandRed)
        }
    }
}
