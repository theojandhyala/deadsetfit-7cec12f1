import UIKit
import Capacitor

/// App-local Capacitor plugins register here — the CLI only auto-discovers
/// plugins shipped as packages, not classes living in the app target.
class MyViewController: CAPBridgeViewController {
    private let deadsetBackground = UIColor(
        red: 7.0 / 255.0,
        green: 7.0 / 255.0,
        blue: 8.0 / 255.0,
        alpha: 1.0
    )

    override func viewDidLoad() {
        super.viewDidLoad()

        // WKWebView is white until its first HTML paint unless both layers are
        // explicitly coloured. On a cold launch or a slow session restore that
        // produced a bright flash between the native splash and DEADSET.
        view.backgroundColor = deadsetBackground
        webView?.isOpaque = false
        webView?.backgroundColor = deadsetBackground
        webView?.scrollView.backgroundColor = deadsetBackground
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
        // Without this line the plugin compiles, ships inside the binary, and is
        // never reachable from JavaScript: `Capacitor.Plugins.RestActivity` is
        // simply undefined, so the rest timer silently never reaches the Dynamic
        // Island and nothing anywhere reports an error.
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(StoreKitPlugin())
        bridge?.registerPluginInstance(WatchBridgePlugin())
        bridge?.registerPluginInstance(HapticsPlugin())
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(WorkoutActivityPlugin())
    }
}
