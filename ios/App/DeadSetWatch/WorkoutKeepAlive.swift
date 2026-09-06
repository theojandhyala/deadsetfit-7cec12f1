import Foundation
import HealthKit

/// Keeps the watch app running while training.
///
/// Without an active `HKWorkoutSession` watchOS suspends the app seconds after
/// the wrist drops — which is precisely when you are lifting. A workout session
/// is the only supported way to stay foreground-alive, keep the always-on
/// display showing the set you are on, and hold the haptics running between
/// sets. It also means the session shows up in Activity rings.
///
/// Everything here degrades quietly: if HealthKit authorization is refused the
/// app still logs sets, it just may suspend between them. That trade is stated
/// in the pairing UI rather than blocking the athlete behind a permission wall.
@MainActor
final class WorkoutKeepAlive: NSObject, ObservableObject {
    @Published private(set) var isRunning = false

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let types: Set = [
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.heartRate)
        ]
        let share: Set<HKSampleType> = [HKObjectType.workoutType()]
        _ = try? await store.requestAuthorization(toShare: share, read: types)
    }

    func start() {
        guard !isRunning, HKHealthStore.isHealthDataAvailable() else { return }
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: store, configuration: configuration)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: store,
                workoutConfiguration: configuration
            )
            session.delegate = self
            self.session = session
            self.builder = builder

            let start = Date()
            session.startActivity(with: start)
            builder.beginCollection(withStart: start) { _, _ in }
            isRunning = true
        } catch {
            // A refused or unavailable workout session is not fatal — the app
            // keeps logging, it just loses always-on. Never block on this.
            NSLog("[DEADSET] watch workout session failed: %@", error.localizedDescription)
        }
    }

    func stop() {
        guard isRunning, let session, let builder else { return }
        let end = Date()
        session.end()
        builder.endCollection(withEnd: end) { _, _ in
            // The phone already writes the authoritative workout to HealthKit
            // when the session finishes there. Discarding here avoids two
            // records of the same training session in Apple Fitness.
            builder.discardWorkout()
        }
        self.session = nil
        self.builder = nil
        isRunning = false
    }
}

extension WorkoutKeepAlive: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        guard toState == .ended || toState == .stopped else { return }
        Task { @MainActor in self.isRunning = false }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        NSLog("[DEADSET] watch workout session error: %@", error.localizedDescription)
        Task { @MainActor in self.isRunning = false }
    }
}
