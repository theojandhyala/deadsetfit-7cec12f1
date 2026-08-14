import UIKit
import Capacitor

/// App-local Capacitor plugins register here — the CLI only auto-discovers
/// plugins shipped as packages, not classes living in the app target.
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
        // Without this line the plugin compiles, ships inside the binary, and is
        // never reachable from JavaScript: `Capacitor.Plugins.RestActivity` is
        // simply undefined, so the rest timer silently never reaches the Dynamic
        // Island and nothing anywhere reports an error.
        bridge?.registerPluginInstance(RestActivityPlugin())
        bridge?.registerPluginInstance(StoreKitPlugin())
    }
}
