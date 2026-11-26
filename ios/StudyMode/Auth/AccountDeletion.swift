import Foundation
import Supabase

/// The site's account deletion door (docs/IOS_SYNC.md, item 1): POST /api/delete-account.
enum AccountDeletion {
    enum Outcome: Equatable {
        case deleted
        /// Paid Premium time is left; ask again with `premiumOK`.
        case premiumActive(until: String)
        case failed(String)
    }

    private struct Body: Encodable {
        let confirm = "DELETE"
        let premium_ok: Bool?
        let apple_authorization_code: String?
    }

    private struct Answer: Decodable {
        let ok: Bool?
        let error: String?
        let premium_until: String?
    }

    static func delete(premiumOK: Bool, appleAuthorizationCode: String? = nil) async -> Outcome {
        guard let token = try? await supabase.auth.session.accessToken else {
            return .failed("Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap.")
        }
        var request = URLRequest(url: Config.siteURL.appending(path: "api/delete-account"))
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(Body(premium_ok: premiumOK ? true : nil, apple_authorization_code: appleAuthorizationCode))

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let answer = try? JSONDecoder().decode(Answer.self, from: data)
            if status == 200, answer?.ok == true { return .deleted }
            switch answer?.error {
            case "premium_active": return .premiumActive(until: answer?.premium_until ?? "")
            case "not_signed_in": return .failed("Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap.")
            case "admin_account": return .failed("Yönetici hesabı buradan silinemez.")
            case "delete_failed": return .failed("Hesap şu an silinemedi. Biraz sonra tekrar dene.")
            default: return .failed("Hesap şu an silinemedi (\(status)). Biraz sonra tekrar dene.")
            }
        } catch {
            return .failed("İnternete bağlanılamadı. Bağlantını kontrol edip tekrar dene.")
        }
    }

    /// "2 Aralık 2026" for the Premium warning.
    static func dateText(_ iso: String) -> String {
        guard let date = Dates.parse(iso) ?? Dates.day(String(iso.prefix(10))) else { return iso }
        return date.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year())
    }
}
