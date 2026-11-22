import AppIntents
import Capacitor
import UIKit

/// Siri and Shortcuts support.
///
/// The app is a WKWebView over www.provenance.guru, so each intent opens the
/// app and sends the web view to the matching page, carrying what the user
/// said (e.g. the exhibition title) as a query parameter the page pre-fills.
/// Saving still happens on the page, signed in as usual.

// MARK: - Routing into the web view

enum SiriRouter {
    private static let base = URL(string: "https://www.provenance.guru")!

    /// A page asked for before the web view existed (cold launch from Siri).
    private static var pendingURL: URL?

    static func url(path: String, query: [String: String?] = [:]) -> URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.path = path
        let items = query.compactMap { key, value -> URLQueryItem? in
            guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else { return nil }
            return URLQueryItem(name: key, value: String(value.prefix(200)))
        }
        components.queryItems = items.isEmpty ? nil : items.sorted { $0.name < $1.name }
        return components.url!
    }

    @MainActor
    static func open(_ url: URL) {
        if let webView = bridgeViewController()?.webView {
            webView.load(URLRequest(url: url))
        } else {
            pendingURL = url
        }
    }

    /// Called once the scene has built the bridge view controller.
    @MainActor
    static func openPendingPage() {
        guard let url = pendingURL else { return }
        pendingURL = nil
        open(url)
    }

    @MainActor
    private static func bridgeViewController() -> CAPBridgeViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.windows.first?.rootViewController as? CAPBridgeViewController }
            .first
    }
}

// MARK: - Intents

@available(iOS 16.0, *)
struct CreateExhibitionIntent: AppIntent {
    static var title: LocalizedStringResource = "New Exhibition"
    static var description = IntentDescription(
        "Start a new exhibition in Provenance with its title filled in.")
    static var openAppWhenRun = true

    @Parameter(
        title: "Exhibition title",
        requestValueDialog: IntentDialog("What's the exhibition called?"))
    var exhibitionTitle: String

    @MainActor
    func perform() async throws -> some IntentResult {
        SiriRouter.open(SiriRouter.url(path: "/exhibitions/new", query: ["title": exhibitionTitle]))
        return .result()
    }
}

@available(iOS 16.0, *)
struct AddArtworkIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Artwork"
    static var description = IntentDescription(
        "Add an artwork to Provenance with its title filled in, ready for a photo.")
    static var openAppWhenRun = true

    @Parameter(
        title: "Artwork title",
        requestValueDialog: IntentDialog("What's the artwork called?"))
    var artworkTitle: String

    @MainActor
    func perform() async throws -> some IntentResult {
        SiriRouter.open(SiriRouter.url(path: "/artworks/add", query: ["title": artworkTitle]))
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenMyArtworksIntent: AppIntent {
    static var title: LocalizedStringResource = "Show My Artworks"
    static var description = IntentDescription("Open your artworks in Provenance.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        SiriRouter.open(SiriRouter.url(path: "/artworks/my"))
        return .result()
    }
}

// MARK: - Siri phrases

/// Registered automatically on install: no "Add to Siri" step needed.
/// Every phrase must name the app, so Siri knows to route it here.
@available(iOS 16.0, *)
struct ProvenanceShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CreateExhibitionIntent(),
            phrases: [
                "Create an exhibition in \(.applicationName)",
                "Create a new exhibition in \(.applicationName)",
                "New exhibition in \(.applicationName)",
                "Start an exhibition in \(.applicationName)",
                "Add an exhibition to \(.applicationName)",
            ],
            shortTitle: "New Exhibition",
            systemImageName: "rectangle.stack.badge.plus")
        AppShortcut(
            intent: AddArtworkIntent(),
            phrases: [
                "Add artwork to \(.applicationName)",
                "Add an artwork to \(.applicationName)",
                "Add artwork in \(.applicationName)",
                "New artwork in \(.applicationName)",
                "Register an artwork in \(.applicationName)",
            ],
            shortTitle: "Add Artwork",
            systemImageName: "photo.badge.plus")
        AppShortcut(
            intent: OpenMyArtworksIntent(),
            phrases: [
                "Show my artworks in \(.applicationName)",
                "Open my artworks in \(.applicationName)",
                "Show my \(.applicationName) artworks",
            ],
            shortTitle: "My Artworks",
            systemImageName: "photo.on.rectangle")
    }
}
