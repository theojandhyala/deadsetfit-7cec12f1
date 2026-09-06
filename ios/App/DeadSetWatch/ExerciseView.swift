import SwiftUI

/// Logging one movement.
///
/// The weight is pre-filled from the phone's plan and adjustable with the
/// Digital Crown, so the common case — the weight is what you expected — is a
/// single tap on a large target, and the uncommon case never needs the
/// keyboard. Reps work the same way.
struct ExerciseView: View {
    let exerciseId: String

    @EnvironmentObject private var connector: WatchConnector
    @Environment(\.dismiss) private var dismiss

    @State private var weight: Double = 0
    @State private var reps: Int = 0
    @State private var loaded = false
    @State private var resting: RestState?

    private var exercise: WatchExercise? {
        connector.displayState.exercises.first { $0.id == exerciseId }
    }

    var body: some View {
        Group {
            if let exercise {
                if exercise.isTimed {
                    TimedExerciseView(exercise: exercise)
                } else if exercise.isDistance {
                    DistanceExerciseView(exercise: exercise)
                } else {
                    weightBody(exercise)
                }
            } else {
                // The phone removed this movement mid-session — that is a
                // supported thing to do, so leave rather than showing a husk.
                Color.clear.onAppear { dismiss() }
            }
        }
        .sheet(item: $resting) { rest in
            RestTimerView(seconds: rest.seconds) { resting = nil }
        }
    }

    @ViewBuilder
    private func weightBody(_ exercise: WatchExercise) -> some View {
        ScrollView {
            VStack(spacing: 10) {
                header(exercise)

                // Crown-driven, because typing on a watch during a set is not
                // a thing anyone does twice.
                CrownValue(
                    label: "KG",
                    value: $weight,
                    step: 2.5,
                    range: 0...500,
                    format: { WatchSet.trim($0) }
                )
                CrownValue(
                    label: "REPS",
                    value: Binding(
                        get: { Double(reps) },
                        set: { reps = Int($0) }
                    ),
                    step: 1,
                    range: 0...100,
                    format: { String(Int($0)) }
                )

                Button {
                    connector.logSet(exercise: exercise, weight: weight, reps: reps)
                    if exercise.restSeconds > 0 {
                        resting = RestState(seconds: exercise.restSeconds)
                    }
                } label: {
                    Label("Log set", systemImage: "checkmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(DeadSetTheme.red)
                .disabled(reps <= 0)

                PlatesRow(exercise: exercise, target: weight)

                GhostRow(exercise: exercise)

                SetHistory(exercise: exercise) {
                    connector.undoLastSet(exercise: exercise)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle(exercise.name)
        .onAppear {
            guard !loaded else { return }
            loaded = true
            weight = exercise.weight
            reps = Self.repsGuess(exercise.targetReps)
        }
    }

    @ViewBuilder
    private func header(_ exercise: WatchExercise) -> some View {
        HStack {
            Text("SET \(exercise.workingSetCount + 1) OF \(max(exercise.targetSets, exercise.workingSetCount + 1))")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(DeadSetTheme.red)
            Spacer()
            if !connector.pendingActionIds.isEmpty {
                // Honest about the link rather than pretending everything
                // landed: these sets are queued for the phone.
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
    }

    /// "6-8" → 8. Take the top of the range: the plan is a target to hit, and
    /// dialling down is easier than dialling up.
    static func repsGuess(_ target: String) -> Int {
        let numbers = target.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
        return numbers.max() ?? 8
    }
}

private struct RestState: Identifiable {
    let seconds: Int
    var id: Int { seconds }
}

/// A value the Digital Crown drives, with tap targets either side for gloves
/// and chalk.
private struct CrownValue: View {
    let label: String
    @Binding var value: Double
    let step: Double
    let range: ClosedRange<Double>
    let format: (Double) -> String

    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .black))
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                Button {
                    value = max(range.lowerBound, value - step)
                } label: {
                    Image(systemName: "minus")
                }
                .buttonStyle(.bordered)

                Text(format(value))
                    .font(.system(size: 26, weight: .black, design: .rounded))
                    .frame(maxWidth: .infinity)

                Button {
                    value = min(range.upperBound, value + step)
                } label: {
                    Image(systemName: "plus")
                }
                .buttonStyle(.bordered)
            }
        }
        .focusable(true)
        .focused($focused)
        .digitalCrownRotation(
            $value,
            from: range.lowerBound,
            through: range.upperBound,
            by: step,
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .onAppear { focused = true }
    }
}

/// Plates per side for the weight currently dialled in.
///
/// This is the number you actually need while standing at the rack, and
/// needing the phone for it is the reason wrist logging gets abandoned.
private struct PlatesRow: View {
    let exercise: WatchExercise
    let target: Double

    var body: some View {
        let plates = exercise.platesPerSide(for: target)
        if exercise.barKg > 0 && target > exercise.barKg {
            VStack(spacing: 2) {
                Text("PER SIDE")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(.secondary)
                if plates.isEmpty {
                    Text("bar only")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                } else {
                    Text(plates.map { WatchSet.trim($0) }.joined(separator: " · "))
                        .font(.system(size: 14, weight: .bold))
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.top, 2)
        }
    }
}

/// What this movement looked like last time, so the target travels with you.
private struct GhostRow: View {
    let exercise: WatchExercise

    var body: some View {
        if !exercise.ghost.isEmpty {
            VStack(spacing: 2) {
                Text("LAST TIME")
                    .font(.system(size: 9, weight: .black))
                    .foregroundStyle(.secondary)
                Text(exercise.ghost.map(\.display).joined(separator: "  "))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, 4)
        }
    }
}

/// What you've already done on this movement, newest first, with undo.
private struct SetHistory: View {
    let exercise: WatchExercise
    let onUndo: () -> Void

    var body: some View {
        if exercise.sets.isEmpty {
            EmptyView()
        } else {
            VStack(spacing: 4) {
                ForEach(Array(exercise.sets.enumerated().reversed()), id: \.offset) { index, set in
                    HStack {
                        Text(set.kind?.uppercased() ?? "SET \(index + 1)")
                            .font(.system(size: 10, weight: .black))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(set.display)
                            .font(.system(size: 13, weight: .bold))
                        if set.isPR {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(DeadSetTheme.red)
                        }
                    }
                }
                Button(role: .destructive, action: onUndo) {
                    Label("Undo last set", systemImage: "arrow.uturn.backward")
                        .font(.system(size: 12))
                }
                .buttonStyle(.bordered)
                .padding(.top, 2)
            }
            .padding(.top, 6)
        }
    }
}
