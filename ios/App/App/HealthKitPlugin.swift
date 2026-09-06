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
        CAPPluginMethod(name: "fitnessSummary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWorkout", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
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
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!,
            HKObjectType.activitySummaryType()
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

    @objc func fitnessSummary(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device")
            return
        }

        let calendar = Calendar(identifier: .gregorian)
        let today = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: -6, to: today) ?? today
        let end = Date()
        let group = DispatchGroup()
        let lock = NSLock()

        var stepsByDay: [String: Double] = [:]
        var energyByDay: [String: Double] = [:]
        var distanceKm = 0.0
        var restingHeartRate = 0.0
        var exerciseMinutes = 0.0
        var standHours = 0.0
        var moveGoal = 0.0
        var exerciseGoal = 0.0
        var standGoal = 0.0
        var firstError: Error?

        func recordError(_ error: Error?) {
            guard let error = error else { return }
            lock.lock()
            if firstError == nil { firstError = error }
            lock.unlock()
        }

        func dailyTotals(
            _ identifier: HKQuantityTypeIdentifier,
            unit: HKUnit,
            completion: @escaping ([String: Double], Error?) -> Void
        ) {
            guard let type = HKQuantityType.quantityType(forIdentifier: identifier) else {
                completion([:], nil)
                return
            }
            let predicate = HKQuery.predicateForSamples(
                withStart: start,
                end: end,
                options: .strictStartDate
            )
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: today,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                var values: [String: Double] = [:]
                collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                    let key = HealthKitPlugin.dayFormatter.string(from: stats.startDate)
                    values[key] = stats.sumQuantity()?.doubleValue(for: unit) ?? 0
                }
                completion(values, error)
            }
            self.store.execute(query)
        }

        group.enter()
        dailyTotals(.stepCount, unit: .count()) { values, error in
            lock.lock()
            stepsByDay = values
            lock.unlock()
            recordError(error)
            group.leave()
        }

        group.enter()
        dailyTotals(.activeEnergyBurned, unit: .kilocalorie()) { values, error in
            lock.lock()
            energyByDay = values
            lock.unlock()
            recordError(error)
            group.leave()
        }

        if let distanceType = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(
                withStart: today,
                end: end,
                options: .strictStartDate
            )
            let query = HKStatisticsQuery(
                quantityType: distanceType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, stats, error in
                lock.lock()
                distanceKm = stats?.sumQuantity()?.doubleValue(for: .meterUnit(with: .kilo)) ?? 0
                lock.unlock()
                recordError(error)
                group.leave()
            }
            store.execute(query)
        }

        if let heartType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate) {
            group.enter()
            let predicate = HKQuery.predicateForSamples(
                withStart: start,
                end: end,
                options: .strictStartDate
            )
            let query = HKStatisticsQuery(
                quantityType: heartType,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, stats, error in
                let bpm = HKUnit.count().unitDivided(by: .minute())
                lock.lock()
                restingHeartRate = stats?.averageQuantity()?.doubleValue(for: bpm) ?? 0
                lock.unlock()
                recordError(error)
                group.leave()
            }
            store.execute(query)
        }

        group.enter()
        // HealthKit throws an Objective-C exception (and terminates the app)
        // when activity-summary components are not a complete Gregorian day.
        // Calendar.current omitted the required era and could be non-Gregorian
        // for the user's locale. Keep these components explicit: this call is
        // reached as soon as the Progress screen refreshes Apple Fitness.
        var components = calendar.dateComponents([.era, .year, .month, .day], from: today)
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        let summaryPredicate = HKQuery.predicateForActivitySummary(with: components)
        let summaryQuery = HKActivitySummaryQuery(predicate: summaryPredicate) { _, summaries, error in
            if let summary = summaries?.first {
                lock.lock()
                exerciseMinutes = summary.appleExerciseTime.doubleValue(for: .minute())
                standHours = summary.appleStandHours.doubleValue(for: .count())
                moveGoal = summary.activeEnergyBurnedGoal.doubleValue(for: .kilocalorie())
                exerciseGoal = summary.appleExerciseTimeGoal.doubleValue(for: .minute())
                standGoal = summary.appleStandHoursGoal.doubleValue(for: .count())
                lock.unlock()
            }
            recordError(error)
            group.leave()
        }
        store.execute(summaryQuery)

        group.notify(queue: .global(qos: .userInitiated)) {
            lock.lock()
            let steps = stepsByDay
            let energy = energyByDay
            let distance = distanceKm
            let heartRate = restingHeartRate
            let exercise = exerciseMinutes
            let stand = standHours
            let activeGoal = moveGoal
            let workoutGoal = exerciseGoal
            let standingGoal = standGoal
            let error = firstError
            lock.unlock()

            if steps.isEmpty && energy.isEmpty, let error = error {
                call.reject("Fitness data query failed: \(error.localizedDescription)")
                return
            }

            let todayKey = HealthKitPlugin.dayFormatter.string(from: today)
            var days: [[String: Any]] = []
            for offset in 0..<7 {
                guard let date = calendar.date(byAdding: .day, value: offset, to: start) else {
                    continue
                }
                let key = HealthKitPlugin.dayFormatter.string(from: date)
                days.append([
                    "date": key,
                    "steps": Int((steps[key] ?? 0).rounded()),
                    "activeKcal": (energy[key] ?? 0).rounded()
                ])
            }

            call.resolve([
                "today": [
                    "steps": Int((steps[todayKey] ?? 0).rounded()),
                    "activeKcal": (energy[todayKey] ?? 0).rounded(),
                    "distanceKm": distance,
                    "exerciseMinutes": exercise,
                    "standHours": stand,
                    "restingHeartRate": heartRate
                ],
                "goals": [
                    "activeKcal": activeGoal,
                    "exerciseMinutes": workoutGoal,
                    "standHours": standingGoal
                ],
                "days": days
            ])
        }
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
