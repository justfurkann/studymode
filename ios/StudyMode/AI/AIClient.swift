import Foundation
import Supabase

/// The site's shared AI (POST https://studymode.fun/api/generate), with the student's own session.
/// The server picks the model (free Gemini, or Free+ for VIP / Premium) and counts the daily quota.
enum AIClient {
    struct Failure: LocalizedError {
        let message: String
        /// The server's error code ("too_slow", "daily_limit"…) or "timeout" / "network".
        let code: String?
        var errorDescription: String? { message }
        var isTimeout: Bool { code == "too_slow" || code == "timeout" }
    }

    private struct Body<Input: Encodable>: Encodable {
        let task: String
        let input: Input
    }

    private struct Answer<Output: Decodable>: Decodable {
        let result: Output?
        let error: String?
        let quota: QuotaInfo?
    }

    private struct QuotaInfo: Decodable { let used: Int?; let limit: Int? }

    /// Runs one task. The wait is longer than the server's 60 s, so the server always answers first.
    static func run<Input: Encodable, Output: Decodable>(_ task: String, _ input: Input, as: Output.Type) async throws -> Output {
        guard let token = try? await supabase.auth.session.accessToken else {
            throw Failure(message: "Yapay zekâ için giriş yapman gerekiyor.", code: "unauthorized")
        }
        var request = URLRequest(url: Config.siteURL.appending(path: "api/generate"))
        request.httpMethod = "POST"
        request.timeoutInterval = 65
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(Body(task: task, input: input))

        let started = Date.now
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            let seconds = Int(Date.now.timeIntervalSince(started))
            throw Failure(
                message: "Sunucuya bağlanılamadı (\(seconds) sn sonra). İşlem sürerken uygulamayı kapatma; bağlantını kontrol edip tekrar dene.",
                code: seconds >= 50 ? "timeout" : "network"
            )
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let answer = try? JSONDecoder().decode(Answer<Output>.self, from: data)
        if (200..<300).contains(status), let result = answer?.result { return result }
        if (200..<300).contains(status) { throw Failure(message: formatError, code: "bad_output") }
        throw Failure(message: message(for: answer?.error, status: status, quota: answer?.quota), code: answer?.error)
    }

    static let formatError = "Yapay zekâ beklenmedik bir cevap verdi. Bir kez daha dene."

    /// The site's Turkish messages (src/lib/ai/index.ts viaShared).
    private static func message(for code: String?, status: Int, quota: QuotaInfo?) -> String {
        switch code {
        case "daily_limit":
            return "Bugünkü ücretsiz yapay zekâ hakkın doldu. Gece yarısı yenilenir."
        case "not_configured": return "Ücretsiz yapay zekâ henüz kurulmadı."
        case "unauthorized": return "Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap."
        case "quota": return "Ücretsiz yapay zekânın kotası şu an dolu. Biraz sonra tekrar dene."
        case "busy": return "Google’ın ücretsiz modelleri şu an çok yoğun. Birkaç dakika sonra tekrar dene."
        case "too_slow": return "Yapay zekâ bu notu zamanında bitiremedi. Bir kez daha dene; yine olursa notu ikiye bölüp ayrı ayrı yükle."
        case "too_large": return "İçerik çok uzun. Notu bölerek dene."
        case "premium_only": return "Bu özellik Premium üyelere özel."
        case "blocked": return "Google’ın yapay zekâsı bu içeriği kendi güvenlik filtresine taktı. Tekrar denemek işe yaramaz; takılan bölümü çıkarıp ya da metni yapıştırarak dene."
        case "bad_output": return formatError
        default: return "Sunucu hata verdi (\(status)\(code.map { ", \($0)" } ?? "")). Biraz sonra tekrar dene."
        }
    }
}
