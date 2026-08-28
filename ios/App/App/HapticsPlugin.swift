import Capacitor
import CoreHaptics
import UIKit

/// Native haptics for the web layer.
///
/// App-local rather than the packaged `@capacitor/haptics`, matching how this
/// project already handles HealthKit, StoreKit and Live Activities: it keeps
/// the Swift Package graph and the CI sync step untouched.
///
/// The generators are created once and kept. UIKit's feedback generators need
/// preparing before they fire crisply — a generator built at the moment of the
/// tap has to spin the Taptic Engine up first, which is the difference between
/// a set tick that feels instant and one that feels late.
@objc(HapticsPlugin)
public class HapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HapticsPlugin"
    public let jsName = "Haptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pattern", returnType: CAPPluginReturnPromise)
    ]

    private lazy var light = UIImpactFeedbackGenerator(style: .light)
    private lazy var medium = UIImpactFeedbackGenerator(style: .medium)
    private lazy var heavy = UIImpactFeedbackGenerator(style: .heavy)
    private lazy var rigid = UIImpactFeedbackGenerator(style: .rigid)
    private lazy var notifier = UINotificationFeedbackGenerator()
    private lazy var selector = UISelectionFeedbackGenerator()

    override public func load() {
        NSLog("[DEADSET] Haptics plugin loaded")
        DispatchQueue.main.async {
            self.light.prepare()
            self.medium.prepare()
            self.heavy.prepare()
            self.rigid.prepare()
            self.notifier.prepare()
            self.selector.prepare()
        }
    }

    private func generator(for style: String) -> UIImpactFeedbackGenerator {
        switch style {
        case "light": return light
        case "heavy": return heavy
        case "rigid": return rigid
        default: return medium
        }
    }

    @objc func impact(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        DispatchQueue.main.async {
            let generator = self.generator(for: style)
            generator.prepare()
            generator.impactOccurred()
            // Keep the engine warm for the next nearby interaction (set logging,
            // picker changes and countdown beats often arrive in short bursts).
            generator.prepare()
        }
        call.resolve()
    }

    @objc func notification(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "success"
        DispatchQueue.main.async {
            self.notifier.prepare()
            switch type {
            case "warning": self.notifier.notificationOccurred(.warning)
            case "error": self.notifier.notificationOccurred(.error)
            default: self.notifier.notificationOccurred(.success)
            }
            self.notifier.prepare()
        }
        call.resolve()
    }

    @objc func selection(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.selector.prepare()
            self.selector.selectionChanged()
            self.selector.prepare()
        }
        call.resolve()
    }

    /// A short sequence, for moments that deserve more than one tap — a PR, a
    /// rank up. Spaced on the main queue rather than as a CoreHaptics pattern
    /// so it behaves identically on devices without a Taptic Engine v2.
    @objc func pattern(_ call: CAPPluginCall) {
        let steps = (call.getValue("steps") as? [[String: Any]]) ?? []
        guard !steps.isEmpty else {
            call.resolve()
            return
        }
        var delay: Double = 0
        for step in steps.prefix(8) {
            let style = step["style"] as? String ?? "medium"
            let gap = (step["delayMs"] as? NSNumber)?.doubleValue ?? 90
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                let generator = self.generator(for: style)
                generator.prepare()
                generator.impactOccurred()
                generator.prepare()
            }
            delay += max(0, gap) / 1000
        }
        call.resolve()
    }
}
