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

    /// Apple's private relay addresses read as noise; say what they are.
    var displayEmail: String {
        email.lowercased().hasSuffix("@privaterelay.appleid.com") ? "Apple (gizli e-posta)" : email
    }

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
                await savePendingLevel()
            } else {
                self.session = nil
                state = .signedOut
            }
        }
    }

    /// The level picked in the intro ("Seni tanıyalım") goes on the account the way the site saves
    /// it (src/lib/education.ts saveEducation, as EducationForm's saveLevelEarly does): the whole
    /// education object, other answers empty, v: 2. An account that already has one keeps its own.
    /// A university student is then asked for school and department by the site, as usual.
    private func savePendingLevel() async {
        guard let level = OnboardingStore.pendingLevel else { return }
        guard session?.user.userMetadata["education"] == nil else {
            OnboardingStore.pendingLevel = nil
            return
        }
        let education: AnyJSON = .object([
            "level": .string(level.rawValue),
            "school": .string(""),
            "department": .string(""),
            "classYear": .string(""),
            "birthYear": .null,
            "gender": .null,
            "heardFrom": .null,
            "v": .integer(2),
            "at": .string(ISO.string(.now)),
        ])
        do {
            let user = try await supabase.auth.update(user: UserAttributes(data: ["education": education]))
            session?.user = user
            OnboardingStore.pendingLevel = nil
        } catch {
            // Kept on the phone; tried again at the next sign-in. The site asks for it anyway.
        }
    }

    /// After a user_metadata update made elsewhere (achievements).
    func updateSessionUser(_ user: User) { session?.user = user }

    /// Ayarlar → Okulun: changes only education.level, keeping the other answers the site stored.
    func setEducationLevel(_ level: StudentLevel) async throws {
        var education: [String: AnyJSON] = [:]
        if case let .object(existing)? = session?.user.userMetadata["education"] { education = existing }
        education["level"] = .string(level.rawValue)
        education["v"] = .integer(2)
        education["at"] = .string(ISO.string(.now))
        for key in ["school", "department", "classYear"] where education[key] == nil { education[key] = .string("") }
        let user = try await supabase.auth.update(user: UserAttributes(data: ["education": .object(education)]))
        session?.user = user
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

    /// After the account is deleted on the server, only the session on this phone is left to clear.
    func signOutLocally() async {
        try? await supabase.auth.signOut(scope: .local)
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
