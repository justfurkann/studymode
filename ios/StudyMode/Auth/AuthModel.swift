import Foundation
import Supabase

/// One shared client for the whole app; the session is kept in the Keychain by supabase-swift.
let supabase = SupabaseClient(
    supabaseURL: Config.supabaseURL,
    supabaseKey: Config.supabaseKey,
    options: .init(auth: .init(emitLocalSessionAsInitialSession: true))
)

@MainActor
@Observable
final class AuthModel {
    enum State: Equatable { case loading, signedOut, signedIn }

    private(set) var state: State = .loading
    private(set) var session: Session?

    var displayName: String {
        guard let meta = session?.user.userMetadata else { return "" }
        for key in ["full_name", "name", "given_name"] {
            if case let .string(value)? = meta[key], !value.isEmpty { return value }
        }
        return ""
    }

    var firstName: String { displayName.split(separator: " ").first.map(String.init) ?? "" }

    var email: String { session?.user.email ?? "" }

    /// user_metadata.education.level ("ortaokul", "lise", "universite"…), set by the site's "Seni biraz tanıyalım".
    var educationLevel: String? {
        guard case let .object(education)? = session?.user.userMetadata["education"],
              case let .string(level)? = education["level"] else { return nil }
        return level
    }

    init() {
        Task { await listen() }
    }

    private func listen() async {
        for await (_, session) in supabase.auth.authStateChanges {
            // An expired stored session is not a signed-in user.
            if let session, !session.isExpired {
                self.session = session
                state = .signedIn
            } else {
                self.session = nil
                state = .signedOut
            }
        }
    }

    func signIn(email: String, password: String, captcha: String?) async throws {
        try await supabase.auth.signIn(email: email, password: password, captchaToken: captcha)
    }

    /// Same as the site: the name goes into user metadata as full_name, the confirmation e-mail links back to the site.
    func signUp(name: String, email: String, password: String, captcha: String?) async throws -> Bool {
        let response = try await supabase.auth.signUp(
            email: email,
            password: password,
            data: name.isEmpty ? nil : ["full_name": .string(name)],
            redirectTo: Config.siteURL,
            captchaToken: captcha
        )
        // With e-mail confirmation on there is no session until the link is opened.
        return response.session == nil
    }

    func resetPassword(email: String, captcha: String?) async throws {
        try await supabase.auth.resetPasswordForEmail(
            email,
            redirectTo: Config.siteURL.appending(path: "sifre-yenile"),
            captchaToken: captcha
        )
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }
}

/// Turkish messages for Supabase's auth errors (same wording as the site where it has one).
func authMessage(_ error: Error) -> String {
    let text = String(describing: error).lowercased()
    if text.contains("invalid login credentials") || text.contains("invalid_credentials") {
        return "E-posta ya da şifre yanlış."
    }
    if text.contains("email not confirmed") || text.contains("email_not_confirmed") {
        return "E-postanı henüz onaylamadın. Gelen kutundaki bağlantıya dokun, sonra giriş yap."
    }
    if text.contains("already registered") || text.contains("user_already_exists") {
        return "Bu e-postayla zaten bir hesap var. Giriş yapmayı dene."
    }
    if text.contains("captcha") {
        return "Bot doğrulaması tamamlanmadı. Aşağıdaki kutunun bitmesini bekleyip tekrar dene."
    }
    if text.contains("weak") || text.contains("at least 6") {
        return "Şifre çok kısa. En az 6 karakter olmalı."
    }
    if text.contains("rate limit") || text.contains("over_email_send_rate_limit") {
        return "Çok fazla deneme oldu. Birkaç dakika sonra tekrar dene."
    }
    if text.contains("offline") || text.contains("network") || text.contains("internet") {
        return "İnternete bağlanılamadı. Bağlantını kontrol et."
    }
    return "Bir şeyler ters gitti. Biraz sonra tekrar dene."
}
