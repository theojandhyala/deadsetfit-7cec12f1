import Capacitor
import UIKit

@objc(FeedbackPlugin)
public class FeedbackPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FeedbackPlugin"
    public let jsName = "DeadSetFeedback"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notify", returnType: CAPPluginReturnPromise)
    ]

    @objc func impact(_ call: CAPPluginCall) {
        let rawStyle = call.getString("style") ?? "light"
        let style: UIImpactFeedbackGenerator.FeedbackStyle
        switch rawStyle {
        case "heavy": style = .heavy
        case "medium": style = .medium
        default: style = .light
        }
        DispatchQueue.main.async {
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.prepare()
            generator.impactOccurred()
            call.resolve()
        }
    }

    @objc func notify(_ call: CAPPluginCall) {
        let rawType = call.getString("type") ?? "success"
        let type: UINotificationFeedbackGenerator.FeedbackType
        switch rawType {
        case "warning": type = .warning
        case "error": type = .error
        default: type = .success
        }
        DispatchQueue.main.async {
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(type)
            call.resolve()
        }
    }
}

