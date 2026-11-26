import SwiftUI
import WebKit

/// Supabase has the Cloudflare Turnstile captcha switched on, so every sign-in, sign-up and password
/// reset needs a one-time token. The widget only runs on the site's own domain, so it is loaded in a
/// small web view whose page address is studymode.fun. No change to the website is needed.
@Observable
final class CaptchaController {
    /// The latest unused token; nil until Cloudflare has checked this device.
    private(set) var token: String?
    private(set) var failed = false
    fileprivate weak var webView: WKWebView?

    /// Tokens are single-use: take one for a request, then the widget fetches the next.
    func take() -> String? {
        defer { reset() }
        return token
    }

    func reset() {
        token = nil
        webView?.evaluateJavaScript("window.turnstile && turnstile.reset('#cf')")
    }

    fileprivate func receive(_ body: [String: Any]) {
        switch body["type"] as? String {
        case "token":
            token = body["token"] as? String
            failed = false
        case "expired":
            token = nil
        case "error":
            token = nil
            failed = true
        default:
            break
        }
    }
}

struct TurnstileView: UIViewRepresentable {
    let controller: CaptchaController
    @Environment(\.colorScheme) private var scheme

    func makeCoordinator() -> Coordinator { Coordinator(controller: controller) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "turnstile")
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.backgroundColor = .clear
        controller.webView = view
        view.loadHTMLString(html(theme: scheme == .dark ? "dark" : "light"), baseURL: Config.siteURL)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func html(theme: String) -> String {
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
              callback: function(t){ post({type:'token', token:t}) },
              'expired-callback': function(){ post({type:'expired'}) },
              'error-callback': function(c){ post({type:'error', code:String(c)}) }
            })
          }
        </script>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit" async defer></script>
        </head><body><div id="cf" style="width:100%"></div></body></html>
        """
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let controller: CaptchaController
        init(controller: CaptchaController) { self.controller = controller }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any] else { return }
            DispatchQueue.main.async { self.controller.receive(body) }
        }
    }
}
