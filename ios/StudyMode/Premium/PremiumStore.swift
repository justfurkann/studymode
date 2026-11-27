import Foundation
import StoreKit
import Supabase

/// Premium through Apple In-App Purchase (StoreKit 2).
///
/// Products (App Store Connect, group "StudyMode Premium", 22628551):
/// - premium.monthly and premium.sixmonths: auto-renewable; Apple keeps the end date.
/// - premium.twoweeks: non-renewing; Apple does not track time, so each purchase adds 14 days,
///   stacked on any Premium still running (like the site's codes: greatest(until, now) + days).
///
/// The account's Premium lives on the server (public.premium_access, written only by the server, read
/// through the ai_quota RPC), so the site, the AI limits and the app agree. After a purchase the app
/// sends Apple's signed transaction to the site (POST /api/apple-purchase), which verifies it and
/// extends premium_access. A transaction is finished only after the server accepted it; until then it
/// stays unfinished and is sent again at the next launch. Meanwhile the app already treats the buyer
/// as Premium from StoreKit's own, signed entitlements.
@MainActor
@Observable
final class PremiumStore {
    enum ID {
        static let monthly = "fun.studymode.app.premium.monthly"
        static let sixMonths = "fun.studymode.app.premium.sixmonths"
        static let twoWeeks = "fun.studymode.app.premium.twoweeks"
        static let all = [twoWeeks, monthly, sixMonths]
        static let groupID = "22628551"
    }

    static let twoWeekDays = 14

    private(set) var products: [Product] = []
    private(set) var loading = false
    var message: String?
    private(set) var purchasing: String?
    /// Premium end from this device's StoreKit entitlements.
    private(set) var storeUntil: Date?
    /// Premium end on the account (any source: App Store, site codes).
    private(set) var serverUntil: Date?
    /// VIP / admin accounts have everything anyway.
    private(set) var role: String?
    /// Purchases the server has not confirmed yet.
    private(set) var unsynced = 0
    /// The auto-renewing plan currently active, if any (for "Aboneliği yönet").
    private(set) var activeSubscription: String?
    private(set) var willRenew = false

    private var updates: Task<Void, Never>?
    private var userId: UUID?

    var until: Date? { [storeUntil, serverUntil].compactMap { $0 }.max() }
    var isPremium: Bool { role == "vip" || role == "admin" || (until.map { $0 > .now } ?? false) }

    /// Premium that did not come from this Apple account's purchases (VIP / admin, a site code). Buying
    /// here would not add anything for them, so the app does not offer it.
    var isPremiumFromElsewhere: Bool {
        guard isPremium else { return false }
        if role == "vip" || role == "admin" { return true }
        return !((storeUntil ?? .distantPast) > .now)
    }

    // MARK: Start

    func start(user: UUID) {
        guard userId != user else { return }
        userId = user
        updates?.cancel()
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(result)
            }
        }
        Task {
            await loadProducts()
            // Purchases bought earlier but not yet recorded on the server (no network, server not ready).
            for await result in Transaction.unfinished { await handle(result) }
            await refresh()
        }
    }

    func stop() {
        updates?.cancel()
        updates = nil
        userId = nil
        storeUntil = nil
        serverUntil = nil
        role = nil
        unsynced = 0
    }

    func loadProducts() async {
        guard products.isEmpty else { return }
        loading = true
        defer { loading = false }
        do {
            let found = try await Product.products(for: ID.all)
            products = ID.all.compactMap { id in found.first { $0.id == id } }
            if products.isEmpty { message = "Paketler şu an yüklenemedi. Biraz sonra tekrar dene." }
        } catch {
            message = "Paketler yüklenemedi. İnternet bağlantını kontrol edip tekrar dene."
        }
    }

    // MARK: Buy

    func buy(_ product: Product) async {
        guard let userId else { return }
        purchasing = product.id
        message = nil
        defer { purchasing = nil }
        do {
            // The account id rides along with the purchase, so the server credits the right account.
            let result = try await product.purchase(options: [.appAccountToken(userId)])
            switch result {
            case let .success(verification):
                await handle(verification)
            case .pending:
                message = "Satın alma onay bekliyor (ör. aile onayı). Onaylanınca Premium kendiliğinden açılır."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            message = "Satın alma tamamlanamadı. Tekrar dener misin?"
        }
    }

    /// "Satın alımları geri yükle": asks the App Store for this Apple account's purchases.
    func restore() async {
        message = nil
        do {
            try await AppStore.sync()
        } catch {
            message = "Satın alımlar geri yüklenemedi. Apple hesabına giriş yaptığından emin ol."
        }
        for await result in Transaction.unfinished { await handle(result) }
        await refresh()
        if !isPremium { message = message ?? "Bu Apple hesabında etkin bir Premium bulunamadı." }
    }

    // MARK: Transactions

    private func handle(_ result: VerificationResult<Transaction>) async {
        guard case let .verified(transaction) = result else {
            // Apple's signature did not check out: never unlock anything for it.
            return
        }
        guard ID.all.contains(transaction.productID) else {
            await transaction.finish()
            return
        }
        await refresh()
        if transaction.revocationDate != nil {
            // Refunded: the server hears it from Apple's notifications; nothing to send.
            await transaction.finish()
            return
        }
        switch await sendToServer(result.jwsRepresentation) {
        case .recorded:
            await transaction.finish()
            await refresh()
        case .rejected:
            // The server will never take this one (another account's purchase, refunded, not ours):
            // sending it again at every launch would not help.
            await transaction.finish()
        case .later:
            unsynced += 1
        }
    }

    enum ServerOutcome { case recorded, rejected, later }

    private struct ServerReply: Decodable {
        let ok: Bool?
        let premium_until: String?
    }

    /// The site verifies Apple's signed transaction and extends premium_access for this account.
    /// 200: recorded. 400 / 403 / 409 (invalid, another account's, refunded): rejected for good.
    /// 401, 5xx (503 not configured yet), no network: try again later.
    private func sendToServer(_ jws: String) async -> ServerOutcome {
        guard let token = try? await supabase.auth.session.accessToken else { return .later }
        var request = URLRequest(url: Config.siteURL.appending(path: "api/apple-purchase"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONEncoder().encode(["transaction": jws])
        request.timeoutInterval = 20
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .later }
            if [400, 403, 409].contains(http.statusCode) { return .rejected }
            guard (200..<300).contains(http.statusCode) else { return .later }
            let reply = try? JSONDecoder().decode(ServerReply.self, from: data)
            if let until = reply?.premium_until.flatMap(Dates.parse) { serverUntil = until }
            return (reply?.ok ?? true) ? .recorded : .later
        } catch {
            return .later
        }
    }

    // MARK: Status

    /// Recomputes Premium from StoreKit (auto-renewing end dates, two-week passes stacked) and the account.
    func refresh() async {
        var renewEnd: Date?
        var active: String?
        var passes: [Date] = []
        for await result in Transaction.currentEntitlements {
            guard case let .verified(t) = result, t.revocationDate == nil else { continue }
            if t.productType == .autoRenewable, let end = t.expirationDate {
                if end > (renewEnd ?? .distantPast) { renewEnd = end; active = t.productID }
            }
        }
        // Non-renewing passes stay in the history; each one adds 14 days.
        for await result in Transaction.all {
            guard case let .verified(t) = result, t.revocationDate == nil, t.productID == ID.twoWeeks else { continue }
            passes.append(t.purchaseDate)
        }
        var passEnd: Date?
        for bought in passes.sorted() {
            let start = max(passEnd ?? bought, bought)
            passEnd = Calendar.current.date(byAdding: .day, value: Self.twoWeekDays, to: start)
        }
        storeUntil = [renewEnd, passEnd].compactMap { $0 }.max()
        activeSubscription = (renewEnd ?? .distantPast) > .now ? active : nil
        willRenew = false
        if let active, let product = products.first(where: { $0.id == active }),
           let status = try? await product.subscription?.status.first(where: { (try? $0.transaction.payloadValue.productID) == active }),
           case let .verified(info) = status.renewalInfo {
            willRenew = info.willAutoRenew
        }
        await refreshServer()
    }

    private struct Quota: Decodable { let role: String?; let premium_until: String? }

    private func refreshServer() async {
        do {
            let quota: Quota = try await supabase.rpc("ai_quota").execute().value
            role = quota.role
            serverUntil = quota.premium_until.flatMap(Dates.parse)
        } catch {
            // Offline: keep what we knew.
        }
    }
}
