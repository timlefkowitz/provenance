import Capacitor
import Foundation
import OSLog
import StoreKit

/// Native Apple IAP purchases via StoreKit 2. Our own backend independently
/// verifies every transaction's `jwsRepresentation`
/// (see src/lib/apple/verify-apple-jws.ts) — this plugin's job is purely to
/// drive StoreKit and hand that signed JWS to JS.
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentEntitlements", returnType: CAPPluginReturnPromise),
    ]

    private static let log = Logger(subsystem: "guru.provenance.app", category: "StoreKit")

    private var updatesTask: Task<Void, Never>?

    /// Surfaces the real StoreKit error to JS (and the device log) rather than a
    /// generic "Purchase failed" — the underlying domain/code is what tells a
    /// sandbox-account problem from a config problem.
    private static func reject(_ call: CAPPluginCall, _ context: String, _ error: Error) {
        let ns = error as NSError
        log.error("\(context, privacy: .public): \(ns.domain, privacy: .public) \(ns.code) \(ns.localizedDescription, privacy: .public)")
        call.reject("\(context): \(ns.localizedDescription) (\(ns.domain) \(ns.code))", "\(ns.domain).\(ns.code)", error)
    }

    override public func load() {
        // Transactions can complete outside an explicit purchase() call —
        // Ask to Buy family approvals, or a renewal while the app happens to
        // be open. Without this listener those would silently finish without
        // ever reaching our eager-sync path (the webhook will eventually
        // catch them, but the UI wouldn't refresh).
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard let self, let payload = Self.verifiedPayload(update) else { continue }
                self.notifyListeners("transactionsUpdated", data: payload)
                if case .verified(let transaction) = update {
                    await transaction.finish()
                }
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    /// jwsRepresentation lives on the VerificationResult wrapper, not the
    /// unwrapped Transaction — so this must run before unwrapping.
    private static func verifiedPayload(_ result: VerificationResult<Transaction>) -> [String: Any]? {
        guard case .verified(let transaction) = result else { return nil }
        return [
            "jwsRepresentation": result.jwsRepresentation,
            "productId": transaction.productID,
            "originalTransactionId": String(transaction.originalID),
            "transactionId": String(transaction.id),
            "expiresDate": transaction.expirationDate.map { $0.timeIntervalSince1970 * 1000 } as Any,
        ]
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let ids = call.getArray("productIds", String.self), !ids.isEmpty else {
            call.reject("productIds is required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: ids)
                call.resolve([
                    "products": products.map { p in
                        [
                            "id": p.id,
                            "displayName": p.displayName,
                            "description": p.description,
                            "displayPrice": p.displayPrice,
                        ]
                    },
                ])
            } catch {
                Self.reject(call, "Failed to fetch products", error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId is required")
            return
        }
        let appAccountToken = call.getString("appAccountToken").flatMap { UUID(uuidString: $0) }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                Self.log.info("purchase: fetched \(products.count) product(s) for \(productId, privacy: .public)")
                guard let product = products.first else {
                    call.reject("Product not found in App Store: \(productId)", "product_not_found")
                    return
                }

                var options: Set<Product.PurchaseOption> = []
                if let appAccountToken {
                    options.insert(.appAccountToken(appAccountToken))
                }

                let result = try await product.purchase(options: options)
                Self.log.info("purchase: result received for \(productId, privacy: .public)")

                switch result {
                case .success(let verification):
                    if let payload = Self.verifiedPayload(verification) {
                        var resolved = payload
                        resolved["status"] = "purchased"
                        call.resolve(resolved)
                        if case .verified(let transaction) = verification {
                            await transaction.finish()
                        }
                    } else if case .unverified(_, let error) = verification {
                        Self.reject(call, "Transaction failed local verification", error)
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                Self.reject(call, "Purchase failed", error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await Self.currentEntitlements()])
            } catch {
                Self.reject(call, "Restore failed", error)
            }
        }
    }

    @objc func getCurrentEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["transactions": await Self.currentEntitlements()])
        }
    }

    private static func currentEntitlements() async -> [[String: Any]] {
        var results: [[String: Any]] = []
        for await entitlement in Transaction.currentEntitlements {
            if let payload = verifiedPayload(entitlement) {
                results.append(payload)
            }
        }
        return results
    }
}
