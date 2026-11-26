import AuthenticationServices
import CryptoKit
import Supabase
import SwiftUI

/// "Google ile devam et" without Google's SDK: Google's standard sign-in page in Apple's secure
/// web sheet (ASWebAuthenticationSession), authorization code + PKCE for the iOS OAuth client, then
/// Supabase signInWithIdToken — the same nonce scheme as the site (src/lib/googleSignIn.ts):
/// Google gets SHA-256(nonce), Supabase gets the raw nonce. The captcha token goes along.
enum GoogleSignIn {
    /// "….apps.googleusercontent.com" → "com.googleusercontent.apps.…", the redirect scheme Google
    /// gives every iOS client.
    static var redirectScheme: String {
        Config.googleIOSClientID.split(separator: ".").reversed().joined(separator: ".")
    }

    static var isConfigured: Bool { !Config.googleIOSClientID.isEmpty }

    @MainActor
    static func signIn(captcha: String?, anchor: ASPresentationAnchor) async throws {
        let rawNonce = AppleSignIn.makeNonce()
        let verifier = AppleSignIn.makeNonce(length: 64)
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        let redirect = "\(redirectScheme):/oauth2redirect"

        var auth = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        auth.queryItems = [
            .init(name: "client_id", value: Config.googleIOSClientID),
            .init(name: "redirect_uri", value: redirect),
            .init(name: "response_type", value: "code"),
            .init(name: "scope", value: "openid email profile"),
            .init(name: "code_challenge", value: challenge),
            .init(name: "code_challenge_method", value: "S256"),
            .init(name: "nonce", value: AppleSignIn.sha256(rawNonce)),
            .init(name: "prompt", value: "select_account"),
        ]

        let callback = try await webSession(url: auth.url!, scheme: redirectScheme, anchor: anchor)
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if items.contains(where: { $0.name == "error" }) { throw GoogleSignInError.denied }
        guard let code = items.first(where: { $0.name == "code" })?.value else { throw GoogleSignInError.noCode }

        // iOS clients have no secret; PKCE proves this is the same app that started the sign-in.
        var token = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        token.httpMethod = "POST"
        token.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            .init(name: "code", value: code),
            .init(name: "client_id", value: Config.googleIOSClientID),
            .init(name: "redirect_uri", value: redirect),
            .init(name: "grant_type", value: "authorization_code"),
            .init(name: "code_verifier", value: verifier),
        ]
        token.httpBody = form.percentEncodedQuery?.replacingOccurrences(of: "+", with: "%2B").data(using: .utf8)
        let (data, _) = try await URLSession.shared.data(for: token)
        struct Tokens: Decodable { let id_token: String?; let access_token: String? }
        guard let tokens = try? JSONDecoder().decode(Tokens.self, from: data), let idToken = tokens.id_token else {
            throw GoogleSignInError.noToken
        }

        try await supabase.auth.signInWithIdToken(credentials: OpenIDConnectCredentials(
            provider: .google,
            idToken: idToken,
            accessToken: tokens.access_token,
            nonce: rawNonce,
            gotrueMetaSecurity: captcha.map { AuthMetaSecurity(captchaToken: $0) }
        ))
    }

    @MainActor
    private static func webSession(url: URL, scheme: String, anchor: ASPresentationAnchor) async throws -> URL {
        let provider = AnchorProvider(anchor: anchor)
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                if let callback { continuation.resume(returning: callback) }
                else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    continuation.resume(throwing: GoogleSignInError.canceled)
                } else {
                    continuation.resume(throwing: error ?? GoogleSignInError.noCode)
                }
            }
            session.presentationContextProvider = provider
            // Use the phone's own Google session when there is one (no extra password).
            session.prefersEphemeralWebBrowserSession = false
            objc_setAssociatedObject(session, "provider", provider, .OBJC_ASSOCIATION_RETAIN)
            session.start()
        }
    }

    private final class AnchorProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
        let anchor: ASPresentationAnchor
        init(anchor: ASPresentationAnchor) { self.anchor = anchor }
        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { anchor }
    }
}

enum GoogleSignInError: Error { case canceled, denied, noCode, noToken }

private extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

/// White button with Google's four-colour "G", as Google's sign-in branding asks.
struct GoogleSignInButton: View {
    let captcha: CaptchaController
    @Binding var error: String?
    @Binding var busy: Bool

    var body: some View {
        Button(action: start) {
            HStack(spacing: 10) {
                Image("GoogleG").resizable().frame(width: 20, height: 20)
                Text("Google ile devam et")
                    .font(.system(size: 19, weight: .medium))
                    .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.12))
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color(red: 0.45, green: 0.47, blue: 0.46), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .accessibilityLabel("Google ile devam et")
    }

    private func start() {
        guard let token = captcha.take() else {
            error = "Bot doğrulamasının bitmesini bekle; kutu birkaç saniyede kendiliğinden işaretlenir. Sonra Google ile tekrar dene."
            return
        }
        guard let anchor = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first else { return }
        error = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                try await GoogleSignIn.signIn(captcha: token, anchor: anchor)
            } catch GoogleSignInError.canceled {
                // Closing Google's sheet is not an error worth showing.
            } catch {
                self.error = "Google ile giriş yapılamadı. Biraz sonra tekrar dene ya da e-postanla devam et."
            }
        }
    }
}
