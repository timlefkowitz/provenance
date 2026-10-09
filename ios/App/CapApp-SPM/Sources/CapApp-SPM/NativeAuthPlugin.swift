import AuthenticationServices
import Capacitor
import UIKit

/// System sign-in sheets for the WebView's OAuth providers.
///
/// JS: `NativeAuth.startWebSession({ url, callbackScheme })` → `{ url }` — runs
/// the provider in ASWebAuthenticationSession, which (unlike
/// SFSafariViewController) shares Safari's cookies, so a user already signed
/// into Google in Safari just picks their account. Resolves with the callback
/// URL once the provider redirects to `callbackScheme://…`.
///
/// `NativeAuth.signInWithApple({ nonce })` → `{ identityToken, authorizationCode,
/// givenName?, familyName?, email? }` — native Sign in with Apple (one Face ID
/// tap). `nonce` is the SHA-256 hex of the raw nonce later passed to Supabase.
///
/// Both reject with code "canceled" when the user dismisses the sheet.
@objc(NativeAuthPlugin)
public class NativeAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startWebSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
    ]

    /// Held until completion; ASWebAuthenticationSession and
    /// ASAuthorizationController are released (and dismissed) otherwise.
    private var webSession: ASWebAuthenticationSession?
    private var appleController: ASAuthorizationController?
    private var appleCall: CAPPluginCall?

    @objc func startWebSession(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString),
              let scheme = call.getString("callbackScheme") else {
            call.reject("url and callbackScheme are required")
            return
        }

        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.webSession = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Sign-in canceled", "canceled")
                } else {
                    call.reject(error?.localizedDescription ?? "Sign-in failed", "failed", error)
                }
            }
            session.presentationContextProvider = self
            // Share Safari's cookies so existing Google sessions carry over.
            session.prefersEphemeralWebBrowserSession = false
            self.webSession = session

            if !session.start() {
                self.webSession = nil
                call.reject("Could not start sign-in session", "failed")
            }
        }
    }

    @objc func signInWithApple(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce") else {
            call.reject("nonce is required")
            return
        }

        DispatchQueue.main.async {
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleCall = call
            self.appleController = controller
            controller.performRequests()
        }
    }

    private func finishApple() {
        appleCall = nil
        appleController = nil
    }
}

extension NativeAuthPlugin: ASWebAuthenticationPresentationContextProviding, ASAuthorizationControllerPresentationContextProviding {
    private var anchor: ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchor
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
}

extension NativeAuthPlugin: ASAuthorizationControllerDelegate {
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { finishApple() }
        guard let call = appleCall else { return }

        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken, let identityToken = String(data: tokenData, encoding: .utf8) else {
            call.reject("Apple did not return an identity token", "failed")
            return
        }

        var result: [String: Any] = ["identityToken": identityToken]
        if let codeData = credential.authorizationCode, let code = String(data: codeData, encoding: .utf8) {
            result["authorizationCode"] = code
        }
        // Apple only sends name and email on the very first authorization.
        if let given = credential.fullName?.givenName { result["givenName"] = given }
        if let family = credential.fullName?.familyName { result["familyName"] = family }
        if let email = credential.email { result["email"] = email }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        defer { finishApple() }
        guard let call = appleCall else { return }

        if let error = error as? ASAuthorizationError, error.code == .canceled {
            call.reject("Sign-in canceled", "canceled")
        } else {
            call.reject(error.localizedDescription, "failed", error)
        }
    }
}
