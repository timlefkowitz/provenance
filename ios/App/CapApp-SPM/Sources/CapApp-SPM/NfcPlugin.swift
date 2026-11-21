import Capacitor
import CoreNFC
import UIKit

/// Writes a link to an NFC tag (NTAG213/215/216 stickers and the like) with Core NFC.
///
/// JS: `Nfc.isAvailable()` → `{ available }`
///     `Nfc.writeUrl({ url, lock?, prompt? })` → `{ status: "written", locked }` or `{ status: "cancelled" }`.
///
/// The phone shows the system "Ready to Scan" sheet; the user holds the tag to
/// the top of the phone. With `lock: true` the tag is made permanently
/// read-only after the link is written. Needs the
/// `com.apple.developer.nfc.readersession.formats` entitlement (TAG) and
/// NFCReaderUsageDescription in Info.plist.
@objc(NfcPlugin)
public class NfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCNDEFReaderSessionDelegate {
    public let identifier = "NfcPlugin"
    public let jsName = "Nfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeUrl", returnType: CAPPluginReturnPromise),
    ]

    private var session: NFCNDEFReaderSession?
    private var pendingCall: CAPPluginCall?
    private var message: NFCNDEFMessage?
    private var lockAfterWrite = false

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": NFCNDEFReaderSession.readingAvailable])
    }

    @objc func writeUrl(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let payload = NFCNDEFPayload.wellKnownTypeURIPayload(url: url)
        else {
            call.reject("A valid url is required", "INVALID_URL")
            return
        }
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("This device can't write NFC tags.", "UNAVAILABLE")
            return
        }

        DispatchQueue.main.async {
            if let previous = self.pendingCall {
                previous.resolve(["status": "cancelled"])
            }
            self.session?.invalidate()

            self.message = NFCNDEFMessage(records: [payload])
            self.lockAfterWrite = call.getBool("lock") ?? false
            self.pendingCall = call

            let session = NFCNDEFReaderSession(delegate: self, queue: .main, invalidateAfterFirstRead: false)
            session.alertMessage = call.getString("prompt") ?? "Hold the top of your iPhone near the NFC tag."
            self.session = session
            session.begin()
        }
    }

    // MARK: - Settling the JS call once

    private func succeed(_ session: NFCNDEFReaderSession, locked: Bool) {
        session.alertMessage = locked ? "Link written and tag locked." : "Link written to the tag."
        session.invalidate()
        pendingCall?.resolve(["status": "written", "locked": locked])
        pendingCall = nil
    }

    private func fail(_ session: NFCNDEFReaderSession, _ message: String, code: String) {
        session.invalidate(errorMessage: message)
        pendingCall?.reject(message, code)
        pendingCall = nil
    }

    // MARK: - NFCNDEFReaderSessionDelegate

    public func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        defer { if self.session === session { self.session = nil } }
        guard let call = pendingCall else { return }
        pendingCall = nil
        if let nfcError = error as? NFCReaderError,
           nfcError.code == .readerSessionInvalidationErrorUserCanceled
            || nfcError.code == .readerSessionInvalidationErrorSessionTimeout {
            call.resolve(["status": "cancelled"])
        } else {
            call.reject(error.localizedDescription, "SESSION_ERROR")
        }
    }

    /// Required by the protocol; unused because didDetect tags is implemented.
    public func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard let message = message else {
            fail(session, "Nothing to write.", code: "NO_MESSAGE")
            return
        }
        if tags.count > 1 {
            session.alertMessage = "More than one tag found. Hold just one tag near your iPhone."
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(600)) {
                session.restartPolling()
            }
            return
        }
        let tag = tags[0]
        let lock = lockAfterWrite

        session.connect(to: tag) { error in
            if error != nil {
                self.fail(session, "Couldn't connect to the tag. Try again.", code: "CONNECT_FAILED")
                return
            }
            tag.queryNDEFStatus { status, capacity, error in
                if error != nil {
                    self.fail(session, "Couldn't read the tag. Try again.", code: "QUERY_FAILED")
                    return
                }
                switch status {
                case .notSupported:
                    self.fail(session, "This tag can't store a link.", code: "NOT_SUPPORTED")
                case .readOnly:
                    self.fail(session, "This tag is locked and can't be rewritten.", code: "READ_ONLY")
                case .readWrite:
                    if message.length > capacity {
                        self.fail(
                            session,
                            "The link is too long for this tag (\(message.length) of \(capacity) bytes).",
                            code: "TOO_LARGE")
                        return
                    }
                    tag.writeNDEF(message) { error in
                        if let error = error {
                            self.fail(session, "Writing failed: \(error.localizedDescription)", code: "WRITE_FAILED")
                            return
                        }
                        guard lock else {
                            self.succeed(session, locked: false)
                            return
                        }
                        tag.writeLock { error in
                            if error != nil {
                                self.fail(
                                    session,
                                    "The link was written but the tag couldn't be locked.",
                                    code: "LOCK_FAILED")
                                return
                            }
                            self.succeed(session, locked: true)
                        }
                    }
                @unknown default:
                    self.fail(session, "This tag isn't supported.", code: "NOT_SUPPORTED")
                }
            }
        }
    }
}
