import Foundation
import Capacitor
import HealthKit

/// DEADSET ↔ Apple Health bridge — the pairing layer for Apple Watch.
/// Watch-recorded workouts and active energy flow into DEADSET; finished
/// DEADSET sessions are written back so they close rings and appear on watch.
@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryWorkouts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "todayActiveEnergy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private func parseDate(_ value: String?) -> Date? {
        guard let value = value else { return nil }
        return HealthKitPlugin.isoFormatter.date(from: value)
            ?? ISO8601DateFormatter().date(from: value)
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false])
            return
        }
        let read: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]
        let write: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        ]
        store.requestAuthorization(toShare: write, read: read) { granted, error in
            if let error = error {
                call.reject("HealthKit authorization failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["granted": granted])
        }
    }

    @objc func queryWorkouts(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["workouts": []])
            return
        }
        let since = parseDate(call.getString("sinceIso")) ?? Date(timeIntervalSinceNow: -7 * 86400)
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: 100,
            sortDescriptors: [sort]
        ) { _, samples, error in
            if let error = error {
                call.reject("Workout query failed: \(error.localizedDescription)")
                return
            }
            let workouts: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { workout in
                var kcal = 0.0
                if #available(iOS 16.0, *) {
                    if let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
                       let stat = workout.statistics(for: type) {
                        kcal = stat.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                    }
                } else {
                    kcal = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                }
                return [
                    "id": workout.uuid.uuidString,
                    "start": HealthKitPlugin.isoFormatter.string(from: workout.startDate),
                    "end": HealthKitPlugin.isoFormatter.string(from: workout.endDate),
                    "activityType": HealthKitPlugin.activityName(workout.workoutActivityType),
                    "calories": kcal,
                    "source": workout.sourceRevision.source.name
                ]
            }
            call.resolve(["workouts": workouts])
        }
        store.execute(query)
    }

    @objc func todayActiveEnergy(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            call.resolve(["kcal": 0])
            return
        }
        let start = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
            if let error = error {
                call.reject("Energy query failed: \(error.localizedDescription)")
                return
            }
            let kcal = stats?.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
            call.resolve(["kcal": kcal])
        }
        store.execute(query)
    }

    @objc func saveWorkout(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["saved": false])
            return
        }
        guard let start = parseDate(call.getString("startIso")),
              let end = parseDate(call.getString("endIso")),
              end > start else {
            call.reject("startIso/endIso required (ISO-8601), end must be after start")
            return
        }
        let kcal = call.getDouble("calories") ?? 0

        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining

        let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())
        builder.beginCollection(withStart: start) { _, beginError in
            if let beginError = beginError {
                call.reject("Could not start workout: \(beginError.localizedDescription)")
                return
            }
            let finish: () -> Void = {
                builder.endCollection(withEnd: end) { _, endError in
                    if let endError = endError {
                        call.reject("Could not end workout: \(endError.localizedDescription)")
                        return
                    }
                    builder.finishWorkout { workout, finishError in
                        if let finishError = finishError {
                            call.reject("Could not save workout: \(finishError.localizedDescription)")
                            return
                        }
                        call.resolve(["saved": workout != nil])
                    }
                }
            }
            if kcal > 0, let type = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: kcal)
                let sample = HKQuantitySample(type: type, quantity: quantity, start: start, end: end)
                builder.add([sample]) { _, _ in finish() }
            } else {
                finish()
            }
        }
    }

    private static func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .traditionalStrengthTraining: return "STRENGTH"
        case .functionalStrengthTraining: return "FUNCTIONAL"
        case .running: return "RUN"
        case .walking: return "WALK"
        case .cycling: return "CYCLE"
        case .rowing: return "ROW"
        case .swimming: return "SWIM"
        case .highIntensityIntervalTraining: return "HIIT"
        case .coreTraining: return "CORE"
        case .yoga: return "YOGA"
        case .boxing: return "BOXING"
        default: return "WORKOUT"
        }
    }
}
