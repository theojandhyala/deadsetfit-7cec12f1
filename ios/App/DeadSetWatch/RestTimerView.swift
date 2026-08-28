import SwiftUI

/// Rest, counted down from a deadline.
///
/// The App Store readiness check on the phone build already demands that rest
/// "counts down from a deadline, not suspendable ticks" — the same rule
/// applies here and matters more, because a watch app suspends far more
/// eagerly than a phone app does. The deadline is fixed when rest starts, so
/// the number is right whenever you look at it, whatever watchOS did to the
/// process in between.
struct RestTimerView: View {
    let seconds: Int
    let onDone: () -> Void

    @State private var deadline = Date()
    @State private var now = Date()
    @State private var buzzed = false

    private let tick = Timer.publish(every: 0.2, on: .main, in: .common).autoconnect()

    private var remaining: Int {
        max(0, Int(deadline.timeIntervalSince(now).rounded(.up)))
    }

    var body: some View {
        VStack(spacing: 8) {
            Text("REST")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(DeadSetTheme.red)

            Text(WatchSet.clock(remaining))
                .font(.system(size: 46, weight: .black, design: .rounded))

            HStack(spacing: 6) {
                Button {
                    deadline = deadline.addingTimeInterval(15)
                    buzzed = false
                } label: {
                    Text("+15s").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)

                Button(action: onDone) {
                    Text("Skip").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(DeadSetTheme.red)
            }
        }
        .padding(.horizontal, 6)
        .onAppear { deadline = Date().addingTimeInterval(TimeInterval(seconds)) }
        .onReceive(tick) { value in
            now = value
            guard remaining <= 0, !buzzed else { return }
            buzzed = true
            WatchHaptics.restOver()
            onDone()
        }
    }
}
