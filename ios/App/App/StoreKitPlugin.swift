import Capacitor
import StoreKit
import UIKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "DeadSetStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    private static let productIDs = [
        "org.deadsetfit.pro.monthly",
        "org.deadsetfit.pro.annual"
    ]
    private var updatesTask: Task<Void, Never>?

    override public func load() {
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                await transaction.finish()
                guard let self else { return }
                let entitlement = await self.currentEntitlement()
                self.notifyListeners("entitlementChanged", data: entitlement)
            }
        }
        NSLog("[DEADSET] StoreKit plugin loaded")
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: Self.productIDs)
                let payload = products
                    .sorted { Self.productIDs.firstIndex(of: $0.id) ?? 0 < Self.productIDs.firstIndex(of: $1.id) ?? 0 }
                    .map(Self.productPayload)
                call.resolve(["products": payload])
            } catch {
                call.reject("Unable to load App Store products", error.localizedDescription, error)
            }
        }
    }

    @objc func getEntitlement(_ call: CAPPluginCall) {
        Task { call.resolve(await currentEntitlement()) }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), Self.productIDs.contains(productID) else {
            call.reject("Unknown subscription product")
            return
        }

        Task {
            do {
                guard let product = try await Product.products(for: [productID]).first else {
                    call.reject("This subscription is not available from the App Store yet")
                    return
                }

                var options = Set<Product.PurchaseOption>()
                if let token = call.getString("appAccountToken"), let uuid = UUID(uuidString: token) {
                    options.insert(.appAccountToken(uuid))
                }

                switch try await product.purchase(options: options) {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("The App Store could not verify this purchase")
                        return
                    }
                    await transaction.finish()
                    call.resolve(await currentEntitlement())
                case .pending:
                    call.resolve(["active": false, "pending": true, "productId": productID])
                case .userCancelled:
                    call.resolve(["active": false, "cancelled": true, "productId": productID])
                @unknown default:
                    call.reject("The App Store returned an unknown purchase result")
                }
            } catch {
                call.reject("Purchase failed", error.localizedDescription, error)
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(await currentEntitlement())
            } catch {
                call.reject("Restore purchases failed", error.localizedDescription, error)
            }
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }) else {
                call.reject("No active App Store window")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Unable to open subscription management", error.localizedDescription, error)
            }
        }
    }

    private func currentEntitlement() async -> [String: Any] {
        var activeTransaction: Transaction?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result,
                  Self.productIDs.contains(transaction.productID),
                  transaction.revocationDate == nil,
                  transaction.expirationDate.map({ $0 > Date() }) ?? true else { continue }
            if activeTransaction == nil ||
                (transaction.expirationDate ?? .distantFuture) > (activeTransaction?.expirationDate ?? .distantPast) {
                activeTransaction = transaction
            }
        }

        guard let transaction = activeTransaction else {
            return ["active": false]
        }
        var payload: [String: Any] = [
            "active": true,
            "productId": transaction.productID,
            "originalTransactionId": String(transaction.originalID)
        ]
        if let expirationDate = transaction.expirationDate {
            payload["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
        }
        return payload
    }

    private static func productPayload(_ product: Product) -> [String: Any] {
        var payload: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice
        ]
        if let period = product.subscription?.subscriptionPeriod {
            payload["periodUnit"] = String(describing: period.unit)
            payload["periodValue"] = period.value
        }
        return payload
    }
}
