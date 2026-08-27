import SwiftUI

/// The exercise list for the live session. Tapping one opens its set logger.
struct SessionView: View {
    @EnvironmentObject private var connector: WatchConnector
    @State private var finishing = false

    private var state: WatchSessionState { connector.displayState }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(state.exercises) { exercise in
                        NavigationLink {
                            ExerciseView(exerciseId: exercise.id)
                        } label: {
                            ExerciseRow(exercise: exercise)
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        finishing = true
                    } label: {
                        Label("Finish workout", systemImage: "flag.checkered")
                    }
                }
            }
            .navigationTitle(state.label.isEmpty ? "DEADSET" : state.label)
            .navigationBarTitleDisplayMode(.inline)
        }
        .confirmDestructive(
            isPresented: $finishing,
            title: "Finish workout?",
            confirmLabel: "Finish"
        ) {
            connector.finishWorkout()
        }
    }
}

private struct ExerciseRow: View {
    let exercise: WatchExercise

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: exercise.isComplete ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(exercise.isComplete ? DeadSetTheme.done : Color.secondary)
                .font(.body)
            VStack(alignment: .leading, spacing: 1) {
                Text(exercise.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String {
        if exercise.isTimed {
            let target = exercise.targetSeconds.map(WatchSet.clock) ?? exercise.targetReps
            return "\(exercise.workingSetCount)/\(exercise.targetSets) · \(target)"
        }
        if exercise.isDistance {
            return "\(exercise.workingSetCount)/\(exercise.targetSets) · distance"
        }
        return "\(exercise.workingSetCount)/\(exercise.targetSets) · \(exercise.targetReps)"
    }
}

extension View {
    /// `confirmationDialog` with a destructive confirm, wrapped so the call
    /// sites stay readable at this screen size.
    func confirmDestructive(
        isPresented: Binding<Bool>,
        title: String,
        confirmLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        confirmationDialog(title, isPresented: isPresented, titleVisibility: .visible) {
            Button(confirmLabel, role: .destructive, action: action)
            Button("Cancel", role: .cancel) {}
        }
    }
}
