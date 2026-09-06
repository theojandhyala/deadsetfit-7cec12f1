import SwiftUI

@main
struct DeadSetWatchApp: App {
    @StateObject private var connector = WatchConnector()
    @StateObject private var keepAlive = WorkoutKeepAlive()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(connector)
                .environmentObject(keepAlive)
        }
    }
}

/// Idle until the phone says a workout is live, then straight into the
/// session. There is no watch-side menu on purpose: a workout starts on the
/// phone, where choosing a day and a programme belongs, and the watch is the
/// thing you use once the bar is loaded.
struct RootView: View {
    @EnvironmentObject private var connector: WatchConnector
    @EnvironmentObject private var keepAlive: WorkoutKeepAlive

    var body: some View {
        Group {
            if connector.displayState.isLive {
                SessionView()
            } else {
                IdleView()
            }
        }
        .task(id: connector.displayState.isLive) {
            // Ask for Health access only when a live workout needs it. The idle
            // companion stays useful and uncluttered before the phone starts a
            // session, and refusing access still degrades quietly.
            if connector.displayState.isLive {
                await keepAlive.requestAuthorization()
                keepAlive.start()
            } else {
                keepAlive.stop()
            }
        }
    }
}

struct IdleView: View {
    @EnvironmentObject private var connector: WatchConnector

    var body: some View {
        VStack(spacing: 8) {
            Text("DEADSET")
                .font(.system(size: 20, weight: .black, design: .default))
                .italic()
                .foregroundStyle(DeadSetTheme.red)
            Text("Start a workout on your phone")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if !connector.isReachable {
                Label("Phone not connected", systemImage: "iphone.slash")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.top, 4)
            }
        }
        .padding()
    }
}

enum DeadSetTheme {
    /// The brand red, matching #E10600 on the phone.
    static let red = Color(red: 225 / 255, green: 6 / 255, blue: 0)
    static let done = Color.green
}
