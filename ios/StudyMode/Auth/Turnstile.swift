import SwiftUI
import WebKit

/// Supabase has the Cloudflare Turnstile captcha switched on, so every sign-in, sign-up and password
/// reset needs a one-time token. The widget only runs on the site's own domain, so it is loaded in a
/// web view whose page address is studymode.fun. No change to the website is needed.
///
/// One controller for the whole app, started when the app opens: by the time the student has gone
/// through the intro, a token is usually ready. The widget is "interaction-only": it stays invisible
/// unless Cloudflare really wants a tap, and only then does the sign-in card make room for it.
@MainActor
@Observable
final class CaptchaController {
    /// The latest unused token; nil until Cloudflare has checked this device.
    private(set) var token: String?
    private(set) var failed = false
    /// Cloudflare wants the student to tap the box; the sign-in card shows it.
    private(set) var needsInteraction = false

    @ObservationIgnored private var handler: MessageHandler?
    @ObservationIgnored private(set) lazy var webView: WKWebView = makeWebView()
    @ObservationIgnored private var started = false

    /// Loads the widget once; safe to call again.
    func start(dark: Bool = false) {
        guard !started else { return }
        started = true
        webView.loadHTMLString(Self.html(theme: dark ? "dark" : "light"), baseURL: Config.siteURL)
    }

    /// Tokens are single-use: take one for a request, then the widget fetches the next.
    func take() -> String? {
        defer { reset() }
        return token
    }

    func reset() {
        token = nil
        webView.evaluateJavaScript("window.turnstile && turnstile.reset('#cf')")
    }

    private func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        let handler = MessageHandler { [weak self] body in self?.receive(body) }
        self.handler = handler
        config.userContentController.add(handler, name: "turnstile")
        let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 320, height: 68), configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.backgroundColor = .clear
        return view
    }

    private func receive(_ body: [String: Any]) {
        switch body["type"] as? String {
        case "token":
            token = body["token"] as? String
            failed = false
            needsInteraction = false
        case "interactive":
            needsInteraction = true
        case "interactive-done":
            needsInteraction = false
        case "expired":
            // A token lives about five minutes; fetch a fresh one quietly.
            token = nil
            webView.evaluateJavaScript("window.turnstile && turnstile.reset('#cf')")
        case "error":
            token = nil
            failed = true
            needsInteraction = true
        default:
            break
        }
    }

    private static func html(theme: String) -> String {
        """
        <!doctype html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
        <script>
          function post(m){ window.webkit.messageHandlers.turnstile.postMessage(m) }
          function onTurnstileLoad(){
            turnstile.render('#cf', {
              sitekey: '\(Config.turnstileSiteKey)',
              theme: '\(theme)',
              language: 'tr',
              size: 'flexible',
              appearance: 'interaction-only',
              callback: function(t){ post({type:'token', token:t}) },
              'expired-callback': function(){ post({type:'expired'}) },
              'error-callback': function(c){ post({type:'error', code:String(c)}) },
              'before-interactive-callback': function(){ post({type:'interactive'}) },
              'after-interactive-callback': function(){ post({type:'interactive-done'}) }
            })
          }
        </script>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit" async defer></script>
        </head><body><div id="cf" style="width:100%"></div></body></html>
        """
    }

    private final class MessageHandler: NSObject, WKScriptMessageHandler {
        let onMessage: ([String: Any]) -> Void
        init(onMessage: @escaping ([String: Any]) -> Void) { self.onMessage = onMessage }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            DispatchQueue.main.async { self.onMessage(body) }
        }
    }
}

/// Puts the one shared widget where it is needed. The web view moves between screens instead of
/// loading again, so a token fetched during the intro is still there on the sign-in card.
struct TurnstileView: UIViewRepresentable {
    let controller: CaptchaController

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        container.backgroundColor = .clear
        attach(to: container)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if controller.webView.superview !== uiView { attach(to: uiView) }
    }

    private func attach(to container: UIView) {
        let web = controller.webView
        web.removeFromSuperview()
        web.frame = container.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.addSubview(web)
    }
}
