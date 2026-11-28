import Foundation

/// Same public values the website uses (src/lib/config.ts). The publishable key is meant to ship
/// in apps; Row Level Security protects the data. Never put a secret or service_role key here.
enum Config {
    static let supabaseURL = URL(string: "https://jpcatyopkpnudgdyncas.supabase.co")!
    static let supabaseKey = "sb_publishable_un15T1jZ2JXF4Cygq-JSUQ_stzVNyYz"

    /// The site; the app calls its /api/generate and sends e-mail links back to it.
    static let siteURL = URL(string: "https://studymode.fun")!

    /// A site page opened from the app (privacy, terms, the student-type quiz). `?app=ios` tells the
    /// site to hide its prices, Premium and Shopier links there (App Review 3.1.1: no way to buy
    /// outside the App Store from inside the app).
    static func sitePage(_ path: String) -> URL {
        siteURL.appending(path: path).appending(queryItems: [URLQueryItem(name: "app", value: "ios")])
    }

    /// Cloudflare Turnstile site key. Supabase checks a captcha on sign-in, sign-up and password reset.
    static let turnstileSiteKey = "0x4AAAAAAFvRcaGnlKR5xm3q"

    /// Google OAuth client of type iOS (Google Cloud → Credentials), not the site's web client.
    /// Public by design; Supabase must list it under Google → Client IDs. Empty = button hidden.
    static let googleIOSClientID = "189951485932-3f3jkvijibcnib8ov3opp4gn7h7ln2jl.apps.googleusercontent.com"

    /// Daily AI requests per account (server: ai_limit_for in supabase/schema.sql). Premium/VIP = 4x free.
    static let freeDailyLimit = 40
    static let premiumDailyLimit = 160
}
