import Capacitor
import LocalAuthentication

/// Face ID / Touch ID (with device-passcode fallback) for the optional app lock.
/// JS: `Biometric.getStatus()` → `{ available, biometryType: 'faceID' | 'touchID' | 'opticID' | 'none' }`;
/// `Biometric.authenticate({ reason })` → `{ success }`.
@objc(BiometricPlugin)
public class BiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricPlugin"
    public let jsName = "Biometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
    ]

    @objc func getStatus(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        // deviceOwnerAuthentication = biometrics with passcode fallback, so the
        // lock still works (and can't strand the user) if Face ID fails.
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        let type: String
        switch context.biometryType {
        case .faceID: type = "faceID"
        case .touchID: type = "touchID"
        default:
            if #available(iOS 17.0, *), context.biometryType == .opticID { type = "opticID" } else { type = "none" }
        }
        call.resolve(["available": available, "biometryType": type])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Unlock Provenance"
        let context = LAContext()
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
            call.resolve(["success": success])
        }
    }
}
