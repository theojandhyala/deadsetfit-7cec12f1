import UIKit
import Capacitor

/// App-local Capacitor plugins register here — the CLI only auto-discovers
/// plugins shipped as packages, not classes living in the app target.
class MyViewController: CAPBridgeViewController {
    private let deadsetBackground = UIColor(
        red: 10.0 / 255.0,
        green: 10.0 / 255.0,
        blue: 10.0 / 255.0,
        alpha: 1.0
    )

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .lightContent
    }

    override func viewDidLoad() {
        // CAPBridgeViewController's default backing view is white. On a cold
        // WebKit launch it can be visible between the storyboard splash and
        // the first HTML paint, producing a bright flash for up to a second.
        // Paint every native layer DEADSET black before WebKit is created.
        super.viewDidLoad()
        view.backgroundColor = deadsetBackground
    }

    override open func capacitorDidLoad() {
        webView?.isOpaque = false
        webView?.backgroundColor = deadsetBackground
        webView?.scrollView.backgroundColor = deadsetBackground

        bridge?.registerPluginInstance(HealthKitPlugin())
        // Without this line the plugin compiles, ships inside the binary, and is
        // never reachable from JavaScript: `Capacitor.Plugins.RestActivity` is
        // simply undefined, so the rest timer silently never reaches the Dynamic
        // Island and nothing anywhere reports an error.
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(StoreKitPlugin())
        bridge?.registerPluginInstance(AppReviewPlugin())
        bridge?.registerPluginInstance(FeedbackPlugin())
    }
}
