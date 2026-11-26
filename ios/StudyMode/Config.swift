import Foundation

/// Same public values the website uses (src/lib/config.ts). The publishable key is meant to ship
/// in apps; Row Level Security protects the data. Never put a secret or service_role key here.
enum Config {
    static let supabaseURL = URL(string: "https://jpcatyopkpnudgdyncas.supabase.co")!
    static let supabaseKey = "sb_publishable_un15T1jZ2JXF4Cygq-JSUQ_stzVNyYz"

    /// The site; the app calls its /api/generate and sends e-mail links back to it.
    static let siteURL = URL(string: "https://studymode.fun")!

    /// Cloudflare Turnstile site key. Supabase checks a captcha on sign-in, sign-up and password reset.
    static let turnstileSiteKey = "0x4AAAAAAFvRcaGnlKR5xm3q"

    /// Google OAuth client of type iOS (Google Cloud → Credentials), not the site's web client.
    /// Public by design; Supabase must list it under Google → Client IDs. Empty = button hidden.
    static let googleIOSClientID = ""
}
