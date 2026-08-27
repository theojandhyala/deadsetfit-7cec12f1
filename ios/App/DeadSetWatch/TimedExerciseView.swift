import SwiftUI

/// Holds and carries: a stopwatch, not a rep counter.
///
/// The elapsed time is derived from a start date rather than counted with a
/// ticking variable, for the same reason the phone's rest timer is: watchOS
/// throttles timers the moment the app loses the foreground, and a plank that
/// reads 40 seconds because the wrist dropped is worse than no timer at all.
struct TimedExerciseView: View {
    let exercise: WatchExercise

    @EnvironmentObject private var connector: WatchConnector
    @State private var startedAt: Date?
    @State private var accumulated: Int = 0
    @State private var now = Date()
    /// Guards the one-shot buzz as the hold passes its target.
    @State private var passedTarget = false

    private let tick = Timer.publish(every: 0.2, on: .main, in: .common).autoconnect()

    private var elapsed: Int {
        guard let startedAt else { return accumulated }
        return accumulated + Int(now.timeIntervalSince(startedAt))
    }

    private var target: Int { exercise.targetSeconds ?? 45 }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text(WatchSet.clock(elapsed))
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .foregroundStyle(elapsed >= target ? DeadSetTheme.done : .primary)

                Text(elapsed >= target ? "TARGET BEATEN" : "TARGET \(WatchSet.clock(target))")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(.secondary)

                HStack(spacing: 6) {
                    Button {
                        if startedAt == nil {
                            startedAt = Date()
                        } else {
                            accumulated = elapsed
                            startedAt = nil
                        }
                    } label: {
                        Label(
                            startedAt == nil ? (accumulated > 0 ? "Resume" : "Start") : "Pause",
                            systemImage: startedAt == nil ? "play.fill" : "pause.fill"
                        )
                        .labelStyle(.iconOnly)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        let seconds = elapsed
                        guard seconds > 0 else { return }
                        connector.logHold(exercise: exercise, seconds: seconds)
                        startedAt = nil
                        accumulated = 0
                        passedTarget = false
                    } label: {
                        Label("Log", systemImage: "checkmark")
                            .labelStyle(.iconOnly)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(DeadSetTheme.red)
                    .disabled(elapsed <= 0)
                }

                ForEach(Array(exercise.sets.enumerated().reversed()), id: \.offset) { index, set in
                    HStack {
                        Text("SET \(index + 1)")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(set.display)
                            .font(.system(size: 13, weight: .bold))
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(exercise.name)
        .onReceive(tick) { value in
            guard let started = startedAt else { return }
            now = value
            // Recomputed from the tick rather than read back out of @State:
            // relying on a just-written state value inside the same closure is
            // a subtlety nobody should have to reason about here.
            let running = accumulated + Int(value.timeIntervalSince(started))
            // One buzz as the target passes, so you can hold with your eyes
            // shut. Tracked with a flag because onChange's previous value is
            // watchOS 10 only.
            if !passedTarget, running >= target {
                passedTarget = true
                WatchHaptics.record()
            }
        }
    }
}

/// Conditioning: distance covered, with the elapsed time carried along when
/// the athlete timed it.
struct DistanceExerciseView: View {
    let exercise: WatchExercise

    @EnvironmentObject private var connector: WatchConnector
    @State private var meters: Double = 1000

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("METRES")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(.secondary)
                Text(String(Int(meters)))
                    .font(.system(size: 36, weight: .black, design: .rounded))

                HStack(spacing: 6) {
                    Button { meters = max(0, meters - 100) } label: { Image(systemName: "minus") }
                        .buttonStyle(.bordered)
                    Button { meters = min(100_000, meters + 100) } label: { Image(systemName: "plus") }
                        .buttonStyle(.bordered)
                }

                Button {
                    connector.logDistance(exercise: exercise, meters: Int(meters), seconds: nil)
                } label: {
                    Label("Log effort", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(DeadSetTheme.red)
                .disabled(meters <= 0)

                ForEach(Array(exercise.sets.enumerated().reversed()), id: \.offset) { index, set in
                    HStack {
                        Text("SET \(index + 1)")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(set.display)
                            .font(.system(size: 13, weight: .bold))
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(exercise.name)
    }
}
