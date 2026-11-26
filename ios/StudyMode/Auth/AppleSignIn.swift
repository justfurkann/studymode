import AuthenticationServices
import CryptoKit
import Supabase
import SwiftUI

/// Sign in with Apple, verified by Supabase (docs/IOS_SYNC.md, item 2): Apple signs a token that
/// carries SHA-256(nonce); Supabase checks it against the raw nonce. The captcha token goes along,
/// since Supabase checks Turnstile on every sign-in.
enum AppleSignIn {
    /// A fresh random nonce for one request.
    static func makeNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, length, &bytes)
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    static func sha256(_ text: String) -> String {
        SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// Signs in with Apple's token; on the first sign-in Apple also gives the name, which is saved
    /// the way the site keeps it (full_name, first_name, last_name) when the account has none.
    static func signIn(credential: ASAuthorizationAppleIDCredential, rawNonce: String, captcha: String?) async throws {
        guard let tokenData = credential.identityToken, let idToken = String(data: tokenData, encoding: .utf8) else {
            throw AppleSignInError.noToken
        }
        let session = try await supabase.auth.signInWithIdToken(credentials: OpenIDConnectCredentials(
            provider: .apple,
            idToken: idToken,
            nonce: rawNonce,
            gotrueMetaSecurity: captcha.map { AuthMetaSecurity(captchaToken: $0) }
        ))

        let first = credential.fullName?.givenName?.trimmingCharacters(in: .whitespaces) ?? ""
        let last = credential.fullName?.familyName?.trimmingCharacters(in: .whitespaces) ?? ""
        let meta = session.user.userMetadata
        let hasName = ["full_name", "first_name"].contains { key in
            if case let .string(value)? = meta[key] { return !value.isEmpty }
            return false
        }
        if !hasName, !(first.isEmpty && last.isEmpty) {
            let full = [first, last].filter { !$0.isEmpty }.joined(separator: " ")
            _ = try? await supabase.auth.update(user: UserAttributes(data: [
                "first_name": .string(first),
                "last_name": .string(last),
                "full_name": .string(full),
            ]))
        }
    }

    /// Before deleting an Apple account the site revokes Apple's token, which needs a fresh
    /// authorization code: Apple is asked once more (a Face ID tap for the user).
    @MainActor
    static func freshAuthorizationCode() async -> String? {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = []
        let delegate = CodeDelegate()
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = delegate
        return await withCheckedContinuation { continuation in
            delegate.finish = { code in continuation.resume(returning: code) }
            controller.performRequests()
            // Keep the delegate alive until Apple answers.
            objc_setAssociatedObject(controller, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)
        }
    }

    private final class CodeDelegate: NSObject, ASAuthorizationControllerDelegate {
        var finish: ((String?) -> Void)?

        func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential
            let code = credential?.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            finish?(code)
            finish = nil
        }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
            finish?(nil)
            finish = nil
        }
    }
}

enum AppleSignInError: Error { case noToken }

extension AuthModel {
    /// The account was made with Apple (Supabase records the provider in app_metadata).
    var isAppleAccount: Bool {
        guard let user = session?.user else { return false }
        if case let .string(provider)? = user.appMetadata["provider"], provider == "apple" { return true }
        return user.identities?.contains { $0.provider == "apple" } ?? false
    }
}

/// Apple's own button (Apple's rules require its look), black in light mode, white in dark.
struct AppleSignInButton: View {
    let captcha: CaptchaController
    @Binding var error: String?
    @Binding var busy: Bool
    @Environment(\.colorScheme) private var scheme
    @State private var rawNonce = ""

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            rawNonce = AppleSignIn.makeNonce()
            request.requestedScopes = [.fullName, .email]
            request.nonce = AppleSignIn.sha256(rawNonce)
        } onCompletion: { result in
            switch result {
            case let .success(authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else { return }
                guard let token = captcha.take() else {
                    error = "Bot doğrulamasının bitmesini bekle; kutu birkaç saniyede kendiliğinden işaretlenir. Sonra Apple ile tekrar dene."
                    return
                }
                busy = true
                error = nil
                Task {
                    defer { busy = false }
                    do {
                        try await AppleSignIn.signIn(credential: credential, rawNonce: rawNonce, captcha: token)
                    } catch {
                        self.error = authMessage(error).replacingOccurrences(of: "E-posta ya da şifre yanlış.", with: "Apple ile giriş yapılamadı. Biraz sonra tekrar dene.")
                    }
                }
            case let .failure(failure):
                // Closing Apple's sheet is not an error worth showing.
                if (failure as? ASAuthorizationError)?.code != .canceled {
                    error = "Apple ile giriş başlatılamadı. Biraz sonra tekrar dene ya da e-postanla devam et."
                }
            }
        }
        .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
        .frame(height: 52)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .disabled(busy)
        .accessibilityLabel("Apple ile devam et")
    }
}
