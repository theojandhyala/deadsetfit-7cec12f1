import UIKit
import Capacitor

/// App-local Capacitor plugins register here — the CLI only auto-discovers
/// plugins shipped as packages, not classes living in the app target.
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthKitPlugin())
    }
}
