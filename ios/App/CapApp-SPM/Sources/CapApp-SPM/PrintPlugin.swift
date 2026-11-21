import Capacitor
import UIKit
import WebKit

/// Prints an HTML document with the iOS print sheet.
///
/// The app's WKWebView can't open pop-up windows and ignores `window.print()`,
/// so the web print flows (wall labels, catalogs, checklists, QR sheets) hand
/// their finished HTML here. It's loaded into an offscreen WKWebView and printed
/// from that view's print formatter, so CSS, fonts and images all render.
///
/// JS: `Print.printHtml({ html, baseUrl?, jobName? })` → `{ completed }`.
@objc(PrintPlugin)
public class PrintPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "PrintPlugin"
    public let jsName = "Print"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printHtml", returnType: CAPPluginReturnPromise),
    ]

    private var printView: WKWebView?
    private var pendingCall: CAPPluginCall?

    @objc func printHtml(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), !html.isEmpty else {
            call.reject("html is required")
            return
        }
        let baseURL = call.getString("baseUrl").flatMap(URL.init(string:))

        DispatchQueue.main.async {
            if let previous = self.pendingCall {
                previous.reject("Superseded by a newer print request")
            }
            self.teardown()
            self.pendingCall = call

            // Letter width at 96dpi; the print formatter repaginates anyway.
            let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 816, height: 1056))
            webView.navigationDelegate = self
            webView.isHidden = true
            // Kept in the view hierarchy so WebKit actually renders it.
            self.bridge?.viewController?.view.addSubview(webView)
            self.printView = webView
            webView.loadHTMLString(html, baseURL: baseURL)
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === printView, let call = pendingCall else { return }
        // Give late images and web fonts a moment after the load event.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            guard webView === self.printView else { return }
            let info = UIPrintInfo(dictionary: nil)
            info.outputType = .general
            info.jobName = call.getString("jobName") ?? "Provenance"

            let controller = UIPrintInteractionController.shared
            controller.printInfo = info
            controller.printFormatter = webView.viewPrintFormatter()

            let done: UIPrintInteractionController.CompletionHandler = { _, completed, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve(["completed": completed])
                }
                if self.pendingCall === call { self.pendingCall = nil }
                self.teardown()
            }

            if UIDevice.current.userInterfaceIdiom == .pad, let view = self.bridge?.viewController?.view {
                let anchor = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                controller.present(from: anchor, in: view, animated: true, completionHandler: done)
            } else {
                controller.present(animated: true, completionHandler: done)
            }
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failLoad(webView, error)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failLoad(webView, error)
    }

    private func failLoad(_ webView: WKWebView, _ error: Error) {
        guard webView === printView else { return }
        pendingCall?.reject("Could not load the print document: \(error.localizedDescription)")
        pendingCall = nil
        teardown()
    }

    private func teardown() {
        printView?.navigationDelegate = nil
        printView?.removeFromSuperview()
        printView = nil
    }
}
