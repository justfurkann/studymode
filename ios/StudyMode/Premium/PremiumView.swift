import StoreKit
import SwiftUI

/// "Premium": luxury violet/magenta/gold VIP experience matching `src/pages/Premium.tsx` and
/// `.prem-*` in `global.css`, built natively with live specular sheen, iridescent borders,
/// floating starlight, and StoreKit 2 purchase / restore / manage flows.
struct PremiumView: View {
    @Environment(PremiumStore.self) private var premium
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme

    @State private var manage = false
    @State private var selectedID: String = PremiumStore.ID.sixMonths

    private struct Feature: Identifiable {
        let id: String
        let icon: String
        let title: String
        let detail: String
        let accent: Color
    }

    /// Only what Premium really changes in this app, checked against the server (api/generate.ts and
    /// supabase/schema.sql): Premium counts as VIP for the limits (ai_limit_for: 150 a day instead of 40)
    /// and gets Free+ (plus_limit_for: 30 answers a day on the stronger model, then the normal model).
    /// Reading page pictures is not counted for anyone, so it is not a Premium feature and not listed.
    /// Site-only tools (podcast, images) are not sold here; one small line names them. Semantic search
    /// works in the app (Search/) and is listed.
    private let features: [Feature] = [
        .init(
            id: "freeplus",
            icon: "sparkles",
            title: "Free+ yapay zekâ",
            detail: "Özet, kart, test, Fosfor ve puanlamada daha güçlü model (günde 30 cevaba kadar)",
            accent: Theme.prem3
        ),
        .init(
            id: "hak",
            icon: "bolt.fill",
            title: "Günde 150 hak",
            detail: "Ücretsiz hesapta günde 40 yapay zekâ isteği",
            accent: Theme.prem1
        ),
        // Works in the app since 28 November (Search/): the server's embed task is Premium-only.
        .init(
            id: "arama",
            icon: "sparkle.magnifyingglass",
            title: "Akıllı arama",
            detail: "Notlarında anlamla ara; kelimesi geçmese de bulur",
            accent: Theme.prem2
        ),
    ]

    private var selectedProduct: Product? {
        premium.products.first { $0.id == selectedID }
            ?? premium.products.first { $0.id == PremiumStore.ID.sixMonths }
            ?? premium.products.first
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                heroCard
                    .staggeredAppear(0)

                if premium.unsynced > 0 {
                    Message(
                        text: "Satın alman alındı; hesabına işleniyor. İnternete bağlanınca kendiliğinden tamamlanır.",
                        kind: .warning
                    )
                }

                VStack(alignment: .leading, spacing: 8) {
                    featuresBento
                    // Not a reason to buy: a plain note that the site has more tools.
                    Text("Sitede ayrıca: sesli not ve görseller (uygulamada yok).")
                        .font(.caption2)
                        .foregroundStyle(Theme.text3)
                        .padding(.horizontal, 4)
                }
                .staggeredAppear(1)

                plansSection
                    .staggeredAppear(2)

                if premium.source == .none, premium.otherAccountSubscription, !showPreview {
                    Message(
                        text: "Bu Apple hesabındaki StudyMode aboneliği başka bir StudyMode hesabına bağlı; bu hesapta Premium açmaz. O hesaba giriş yaparak kullanabilir ya da Ayarlar → Abonelikler'den yönetebilirsin.",
                        kind: .warning
                    )
                }

                if let message = premium.message, !showPreview {
                    Message(text: message, kind: .warning)
                }

                restoreButton
                    .staggeredAppear(3)

                legal
                    .padding(.top, 2)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 36)
        }
        .background(premiumBackdrop)
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar(.hidden, for: .tabBar)
        .manageSubscriptionsSheet(isPresented: $manage, subscriptionGroupID: PremiumStore.ID.groupID)
        .task {
            await premium.loadProducts()
            await premium.refresh()
            pickDefaultPlan()
        }
    }

    /// Subtle violet ambient wash over the grid paper so the whole screen feels unmistakably VIP.
    private var premiumBackdrop: some View {
        ZStack {
            GridPaper()
            LinearGradient(
                colors: [
                    Theme.prem1.opacity(scheme == .dark ? 0.22 : 0.09),
                    Theme.prem2.opacity(scheme == .dark ? 0.10 : 0.04),
                    .clear,
                ],
                startPoint: .top,
                endPoint: .center
            )
            .ignoresSafeArea()
        }
    }

    private func pickDefaultPlan() {
        if let active = premium.activeSubscription {
            if let other = premium.products.first(where: { $0.id != active && $0.id == PremiumStore.ID.sixMonths }) {
                selectedID = other.id
            } else if let first = premium.products.first(where: { $0.id != active }) {
                selectedID = first.id
            }
        } else if premium.products.contains(where: { $0.id == PremiumStore.ID.sixMonths }) {
            selectedID = PremiumStore.ID.sixMonths
        } else if let first = premium.products.first {
            selectedID = first.id
        }
    }

    // MARK: - Living VIP Hero Card (.prem-hero)

    private var heroCard: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0.0 : timeline.date.timeIntervalSinceReferenceDate
            let sweepCycle = (t.truncatingRemainder(dividingBy: 4.2)) / 4.2
            let sweepX = -0.65 + sweepCycle * 2.3
            let glowBreath = 0.5 + 0.5 * sin(t * 1.9)
            let borderAngle = Angle.degrees((t * 36).truncatingRemainder(dividingBy: 360))

            ZStack(alignment: .topLeading) {
                // Deep royal violet -> indigo -> crisp magenta sheen (never muddy)
                GeometryReader { geo in
                    ZStack {
                        LinearGradient(
                            stops: [
                                .init(color: Color(uiColor: UIColor(hex: 0x14072B)), location: 0.0),
                                .init(color: Color(uiColor: UIColor(hex: 0x3B1378)), location: 0.48),
                                .init(color: Color(uiColor: UIColor(hex: 0x7C23C9)), location: 0.84),
                                .init(color: Color(uiColor: UIColor(hex: 0xB824CC)), location: 1.0),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )

                        // Luminous magenta halo top-right
                        RadialGradient(
                            colors: [Color(uiColor: UIColor(hex: 0xE879F9)).opacity(0.45 + 0.14 * glowBreath), .clear],
                            center: .topTrailing,
                            startRadius: 6,
                            endRadius: geo.size.width * 0.72
                        )

                        // Warm gold-amber VIP rim glow bottom-right (over magenta = lush rose-gold, never brown)
                        RadialGradient(
                            colors: [Theme.prem3.opacity(0.28 + 0.12 * glowBreath), .clear],
                            center: UnitPoint(x: 0.92, y: 0.95),
                            startRadius: 4,
                            endRadius: geo.size.width * 0.52
                        )

                        // Crisp geometric 4-point starlight sparkles
                        SparkleField(phase: t, reduceMotion: reduceMotion)

                        // Live glossy specular light beam sweeping across the card
                        if !reduceMotion && sweepCycle < 0.65 {
                            LinearGradient(
                                stops: [
                                    .init(color: .clear, location: 0.0),
                                    .init(color: .white.opacity(0.08), location: 0.32),
                                    .init(color: .white.opacity(0.28), location: 0.50),
                                    .init(color: .white.opacity(0.08), location: 0.68),
                                    .init(color: .clear, location: 1.0),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .frame(width: geo.size.width * 0.42)
                            .rotationEffect(.degrees(20))
                            .scaleEffect(y: 2.0)
                            .offset(x: sweepX * geo.size.width)
                            .blendMode(.plusLighter)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 10) {
                            // Metallic gold-accented VIP pill
                            HStack(spacing: 6) {
                                Image(systemName: "crown.fill")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(
                                        LinearGradient(
                                            colors: [Color(uiColor: UIColor(hex: 0xFDE68A)), Theme.prem3],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                    )
                                Text("STUDYMODE PREMIUM")
                                    .font(.caption2.weight(.heavy))
                                    .tracking(1.0)
                                    .foregroundStyle(.white)
                            }
                            .padding(.horizontal, 11)
                            .padding(.vertical, 6)
                            .background(.white.opacity(0.13), in: Capsule())
                            .overlay(
                                Capsule().stroke(
                                    LinearGradient(
                                        colors: [.white.opacity(0.45), Theme.prem3.opacity(0.55), .white.opacity(0.18)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1
                                )
                            )

                            // Headline with luminous gold-gradient emphasis word
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(alignment: .firstTextBaseline, spacing: 6) {
                                    Text("Daha")
                                        .font(Theme.display(.title))
                                        .foregroundStyle(.white)
                                    Text("güçlü")
                                        .font(Theme.display(.title))
                                        .foregroundStyle(
                                            LinearGradient(
                                                colors: [
                                                    Color(uiColor: UIColor(hex: 0xFEF08A)),
                                                    Color(uiColor: UIColor(hex: 0xFBBF24)),
                                                    Color(uiColor: UIColor(hex: 0xF9A8D4)),
                                                ],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                }
                                Text("yapay zekâ.")
                                    .font(Theme.display(.title))
                                    .foregroundStyle(.white)
                            }
                        }

                        Spacer(minLength: 4)

                        FosforMascotView(size: 56, mood: .cheering, onDark: true)
                            .shadow(color: Color(uiColor: UIColor(hex: 0xF59E0B)).opacity(0.35), radius: 12, y: 4)
                    }

                    Text("Notlarını daha güçlü bir yapay zekâ hazırlar ve günde daha çok istek hakkın olur. Premium hesabına bağlıdır; aynı hesapla girdiğin her yerde açıktır.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.86))
                        .fixedSize(horizontal: false, vertical: true)

                    statusBadge
                }
                .padding(20)
            }
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(
                        AngularGradient(
                            colors: [
                                .white.opacity(0.35),
                                Color(uiColor: UIColor(hex: 0xE879F9)).opacity(0.75),
                                Theme.prem3.opacity(0.80),
                                Color(uiColor: UIColor(hex: 0xA855F7)).opacity(0.55),
                                .white.opacity(0.35),
                            ],
                            center: .center,
                            angle: borderAngle
                        ),
                        lineWidth: 1.6
                    )
            )
            .shadow(color: Theme.prem1.opacity(0.45), radius: 22, y: 10)
            .shadow(color: Theme.prem2.opacity(0.22), radius: 8, y: 3)
        }
    }

    private func day(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year())
    }

    /// "Premium'un açık · bitiş …" for every source of Premium.
    private var statusLine: String {
        switch premium.source {
        case .role:
            return "Hesabında Premium süresiz açık; satın alman gerekmiyor."
        case .subscription:
            // The subscription's own renewal date from StoreKit, not the latest of all sources (a site
            // code running longer would otherwise show as the renewal date).
            guard let until = premium.subscriptionUntil ?? premium.storeUntil else { return "App Store aboneliğinle açık." }
            return premium.willRenew
                ? "App Store aboneliğinle açık · \(day(until)) tarihinde yenilenecek."
                : "App Store aboneliğinle açık · bitiş \(day(until)). Yenileme kapalı."
        case .pass:
            guard let until = premium.until else { return "2 haftalık paketinle açık." }
            return "2 haftalık paketinle açık · bitiş \(day(until))."
        case .account, .none:
            guard let until = premium.until else { return "Premium'un açık." }
            return "Premium'un açık · bitiş \(day(until))."
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        if premium.isPremium {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(Color(uiColor: UIColor(hex: 0xFDE047)))
                    Text("Premium açık")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                    if premium.role == "vip" || premium.role == "admin" {
                        Text(premium.role == "admin" ? "Yönetici" : "VIP")
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(Color(uiColor: UIColor(hex: 0x1E0B3A)))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                LinearGradient(
                                    colors: [Color(uiColor: UIColor(hex: 0xFEF08A)), Theme.prem3],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ),
                                in: Capsule()
                            )
                    }
                }

                Text(statusLine)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.86))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .background(.white.opacity(0.13), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(.white.opacity(0.24), lineWidth: 1))
        } else {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color(uiColor: UIColor(hex: 0xFDE047)))
                Text("Tek hesap · site ve iPhone'da aynı Premium")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.92))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.26), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.18), lineWidth: 1))
        }
    }

    // MARK: - 2x2 VIP Bento Features (.prem-tool)

    private var featuresBento: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(features) { feature in
                VStack(alignment: .leading, spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [Theme.prem1, Theme.prem2],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 38, height: 38)
                            .overlay(
                                RoundedRectangle(cornerRadius: 11, style: .continuous)
                                    .stroke(.white.opacity(0.28), lineWidth: 1)
                            )
                            .shadow(color: Theme.prem2.opacity(0.38), radius: 8, y: 4)

                        Image(systemName: feature.icon)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(feature.title)
                            .font(Theme.display(.subheadline, weight: .bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        Text(feature.detail)
                            .font(.caption)
                            .foregroundStyle(Theme.text2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }
                .padding(13)
                .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
                .background(
                    LinearGradient(
                        colors: [
                            Theme.surface,
                            Theme.premSoft.opacity(scheme == .dark ? 0.85 : 0.72),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Theme.prem1.opacity(0.36), Theme.prem2.opacity(0.28)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.2
                        )
                )
            }
        }
    }

    // MARK: - Plans & Glowing Purchase CTA

    /// The simulator cannot load App Store products; there the plans are drawn from App Store
    /// Connect's names and prices (not tappable for purchase), for layout checks and review screenshots.
    private var showPreview: Bool {
        #if targetEnvironment(simulator)
        return premium.products.isEmpty && !premium.loading
        #else
        return false
        #endif
    }

    private struct PreviewPlan: Identifiable {
        let id: String
        let name: String
        let note: String
        let price: String
        let best: Bool
    }

    private let previewPlans: [PreviewPlan] = [
        .init(id: PremiumStore.ID.sixMonths, name: "Premium 6 Aylık", note: "Otomatik yenilenir · istediğin an iptal", price: "₺499,99", best: true),
        .init(id: PremiumStore.ID.monthly, name: "Premium Aylık", note: "Otomatik yenilenir · istediğin an iptal", price: "₺99,99", best: false),
        .init(id: PremiumStore.ID.twoWeeks, name: "Premium 2 Hafta", note: "Tek seferlik · 14 gün, yenilenmez", price: "₺49,99", best: false),
    ]

    /// Show 6 Aylık first ("En avantajlı"), then Aylık, then 2 Hafta.
    private var orderedProducts: [Product] {
        let order = [PremiumStore.ID.sixMonths, PremiumStore.ID.monthly, PremiumStore.ID.twoWeeks]
        return order.compactMap { id in premium.products.first { $0.id == id } }
    }

    @ViewBuilder
    private var plansSection: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .firstTextBaseline) {
                Text(premium.source == .none || premium.source == .pass ? "Paketini seç" : "Premium durumun")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                Label("App Store", systemImage: "checkmark.shield.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.premText)
            }
            .padding(.horizontal, 2)

            // Premium already on: no purchase button. VIP / admin and Premium from a site code get the
            // status only (+ restore below); an App Store subscriber gets the status + "Aboneliği yönet"
            // (changing the plan or cancelling happens there). A two-week pass holder may add another
            // pass, which stacks on the time left (PremiumStore.refresh and the server both add 14 days).
            if premium.source == .role || premium.source == .account || premium.source == .subscription {
                activeCard
            } else if premium.source == .pass {
                passExtension
            } else if showPreview {
                VStack(spacing: 10) {
                    ForEach(previewPlans) { plan in
                        planCard(
                            name: plan.name,
                            note: plan.note,
                            price: plan.price,
                            best: plan.best,
                            isActive: false,
                            isSelected: selectedID == plan.id
                        ) {
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedID = plan.id
                            }
                        }
                    }
                }

                let picked = previewPlans.first { $0.id == selectedID } ?? previewPlans[0]
                purchaseCTA(label: "Premium'a geç · \(picked.price)", busy: false, disabled: true) {}
            } else if premium.products.isEmpty {
                if premium.loading {
                    HStack(spacing: 10) {
                        ProgressView()
                            .tint(Theme.prem1)
                        Text("Paketler yükleniyor…")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(20)
                    .background(Theme.premSoft, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.prem1.opacity(0.28), lineWidth: 1))
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(orderedProducts, id: \.id) { product in
                        let isActive = premium.activeSubscription == product.id
                        let renews = product.type == .autoRenewable
                        planCard(
                            name: product.displayName,
                            note: renews ? "Otomatik yenilenir · istediğin an iptal" : "Tek seferlik · 14 gün, yenilenmez",
                            price: product.displayPrice,
                            best: product.id == PremiumStore.ID.sixMonths,
                            isActive: isActive,
                            isSelected: !isActive && selectedProduct?.id == product.id
                        ) {
                            guard !isActive else { return }
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                selectedID = product.id
                            }
                        }
                    }
                }

                if let target = selectedProduct, premium.activeSubscription != target.id {
                    purchaseCTA(
                        label: "Premium'a geç · \(target.displayPrice)",
                        busy: premium.purchasing != nil,
                        disabled: premium.purchasing != nil
                    ) {
                        OnboardingHaptics.medium()
                        Task { await premium.buy(target) }
                    }
                }
            }
        }
    }

    /// Apple's subscription sheet: change the plan or cancel.
    private var manageButton: some View {
        Button {
            OnboardingHaptics.light()
            manage = true
        } label: {
            Label("Aboneliği yönet", systemImage: "slider.horizontal.3")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(
                    LinearGradient(colors: [Theme.prem1, Theme.prem2], startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.985))
    }

    /// Shown instead of the plans when Premium is already on (VIP / admin, a site code, a subscription).
    private var activeCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(Theme.prem1)
                Text(statusLine)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            switch premium.source {
            case .subscription:
                Text("Paketini değiştirmek ya da iptal etmek için aboneliğini yönet.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
                manageButton
            case .account:
                Text("Premium'un hesabında açık; şu an satın alman gerekmiyor.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
            case .role where premium.activeSubscription != nil:
                // VIP / admin with a running App Store subscription: Apple keeps charging it, so the way
                // to cancel stays visible even though the role already gives Premium.
                Text("Bu Apple hesabında süren bir App Store aboneliğin de var; ücretlendirilmeye devam ediyor. İstersen buradan iptal edebilirsin.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
                manageButton
            default:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.premSoft, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.prem1.opacity(0.32), lineWidth: 1))
    }

    /// A two-week pass is running (bought with this Apple account): another 14 days can be added on top.
    /// Subscriptions are not offered meanwhile; they would only overlap the time already paid for.
    @ViewBuilder
    private var passExtension: some View {
        activeCard
        if let pass = premium.products.first(where: { $0.id == PremiumStore.ID.twoWeeks }) {
            Text("İstersen 14 gün daha ekleyebilirsin; yeni süre kalan sürenin üstüne eklenir.")
                .font(.caption)
                .foregroundStyle(Theme.text2)
                .padding(.horizontal, 2)
            purchaseCTA(
                label: "14 gün ekle · \(pass.displayPrice)",
                busy: premium.purchasing != nil,
                disabled: premium.purchasing != nil
            ) {
                OnboardingHaptics.medium()
                Task { await premium.buy(pass) }
            }
        }
    }

    private func planCard(
        name: String,
        note: String,
        price: String,
        best: Bool,
        isActive: Bool,
        isSelected: Bool,
        onTap: @escaping () -> Void
    ) -> some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack {
                    if isActive {
                        Circle()
                            .fill(Theme.success)
                            .frame(width: 24, height: 24)
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(.white)
                    } else if isSelected {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Theme.prem1, Theme.prem2],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 24, height: 24)
                            .shadow(color: Theme.prem2.opacity(0.45), radius: 5, y: 2)
                        Image(systemName: "checkmark")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(.white)
                    } else {
                        Circle()
                            .stroke(Theme.border, lineWidth: 2)
                            .frame(width: 24, height: 24)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(name)
                            .font(.headline)
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        if best {
                            Text("EN AVANTAJLI")
                                .font(.system(size: 10, weight: .heavy, design: .rounded))
                                .tracking(0.5)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(
                                    LinearGradient(
                                        colors: [Theme.prem1, Theme.prem2],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    ),
                                    in: Capsule()
                                )
                        }
                    }
                    Text(note)
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                }

                Spacer(minLength: 8)

                if isActive {
                    Text("Aktif")
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Theme.premText)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.premSoft, in: Capsule())
                } else {
                    Text(price)
                        .font(Theme.display(.headline, weight: .heavy).monospacedDigit())
                        .foregroundStyle(isSelected ? Theme.premText : Theme.text)
                }
            }
            .padding(16)
            .background(
                (isSelected ? Theme.premSoft : Theme.surface),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay {
                if isSelected {
                    IridescentBorder(cornerRadius: 18, lineWidth: 2.2, reduceMotion: reduceMotion)
                } else {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(isActive ? Theme.prem1.opacity(0.6) : Theme.border, lineWidth: isActive ? 1.6 : 1)
                }
            }
            .shadow(color: isSelected ? Theme.prem2.opacity(0.28) : .clear, radius: 14, y: 6)
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.985))
        .disabled(isActive || premium.purchasing != nil)
    }

    private func purchaseCTA(label: String, busy: Bool, disabled: Bool, action: @escaping () -> Void) -> some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0.0 : timeline.date.timeIntervalSinceReferenceDate
            let cycle = (t.truncatingRemainder(dividingBy: 3.6)) / 3.6
            let sheenX = -0.7 + cycle * 2.4

            Button(action: action) {
                ZStack {
                    LinearGradient(
                        colors: [
                            Color(uiColor: UIColor(hex: 0x5B21B6)),
                            Theme.prem1,
                            Theme.prem2,
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )

                    if !reduceMotion && cycle < 0.55 {
                        GeometryReader { geo in
                            LinearGradient(
                                colors: [.clear, .white.opacity(0.32), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .frame(width: geo.size.width * 0.34)
                            .rotationEffect(.degrees(20))
                            .scaleEffect(y: 2.0)
                            .offset(x: sheenX * geo.size.width)
                        }
                        .allowsHitTesting(false)
                    }

                    HStack(spacing: 8) {
                        if busy {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Image(systemName: "crown.fill")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Color(uiColor: UIColor(hex: 0xFEF08A)))
                        }
                        Text(busy ? "İşleniyor…" : label)
                            .font(Theme.display(.headline, weight: .heavy))
                            .foregroundStyle(.white)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 54)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [.white.opacity(0.45), Theme.prem3.opacity(0.4), .white.opacity(0.18)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.2
                        )
                )
                .shadow(color: Theme.prem2.opacity(0.46), radius: 16, y: 8)
                .opacity(disabled && !busy ? 0.72 : 1)
            }
            .buttonStyle(TactileCardButtonStyle(scale: 0.975))
            .disabled(disabled)
            .padding(.top, 4)
        }
    }

    // MARK: - Restore & Legal

    private var restoreButton: some View {
        Button {
            OnboardingHaptics.light()
            Task { await premium.restore() }
        } label: {
            Label("Satın alımları geri yükle", systemImage: "arrow.clockwise")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.premText)
                .frame(maxWidth: .infinity, minHeight: 46)
                .background(Theme.premSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Theme.prem1.opacity(0.28), lineWidth: 1)
                )
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.985))
    }

    private var legal: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ödeme, satın alma onaylandığında Apple hesabından alınır. Aylık ve 6 aylık abonelikler, dönem bitmeden en az 24 saat önce iptal edilmezse aynı süre ve fiyatla otomatik yenilenir; yenileme ücreti dönemin bitiminden önceki 24 saat içinde alınır. Aboneliği iPhone Ayarlar → Apple hesabın → Abonelikler'den yönetip iptal edebilirsin. 2 haftalık paket tek seferliktir ve yenilenmez.")
                .font(.caption)
                .foregroundStyle(Theme.text3)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 16) {
                Link("Kullanım koşulları (EULA)", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                Link("Gizlilik", destination: Config.sitePage("gizlilik"))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.premText)
        }
    }
}

/// Slowly rotating violet → magenta → gold iridescent border (`.prem-tool[aria-pressed='true']`).
private struct IridescentBorder: View {
    let cornerRadius: CGFloat
    let lineWidth: CGFloat
    let reduceMotion: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let angle = reduceMotion ? 0.0 : (timeline.date.timeIntervalSinceReferenceDate * 48).truncatingRemainder(dividingBy: 360)
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(
                    AngularGradient(
                        colors: [Theme.prem1, Theme.prem2, Theme.prem3, Theme.prem2, Theme.prem1],
                        center: .center,
                        angle: .degrees(angle)
                    ),
                    lineWidth: lineWidth
                )
        }
    }
}

/// Crisp 4-point geometric stars twinkling softly inside the VIP hero card.
private struct SparkleField: View {
    let phase: Double
    let reduceMotion: Bool

    private let stars: [(x: CGFloat, y: CGFloat, size: CGFloat, speed: Double, offset: Double)] = [
        (0.74, 0.16, 11, 2.2, 0.0),
        (0.91, 0.44, 8, 2.8, 1.4),
        (0.62, 0.28, 7, 1.9, 2.7),
        (0.84, 0.72, 10, 2.5, 0.9),
        (0.14, 0.78, 7, 2.1, 3.3),
    ]

    var body: some View {
        Canvas { context, size in
            for star in stars {
                let pulse = reduceMotion ? 0.75 : (0.35 + 0.65 * (0.5 + 0.5 * sin(phase * star.speed + star.offset)))
                let cx = size.width * star.x
                let cy = size.height * star.y
                let r = star.size * (0.85 + 0.25 * pulse)
                var path = Path()
                path.move(to: CGPoint(x: cx, y: cy - r))
                path.addQuadCurve(to: CGPoint(x: cx + r, y: cy), control: CGPoint(x: cx + r * 0.15, y: cy - r * 0.15))
                path.addQuadCurve(to: CGPoint(x: cx, y: cy + r), control: CGPoint(x: cx + r * 0.15, y: cy + r * 0.15))
                path.addQuadCurve(to: CGPoint(x: cx - r, y: cy), control: CGPoint(x: cx - r * 0.15, y: cy + r * 0.15))
                path.addQuadCurve(to: CGPoint(x: cx, y: cy - r), control: CGPoint(x: cx - r * 0.15, y: cy - r * 0.15))
                path.closeSubpath()
                context.fill(path, with: .color(.white.opacity(0.62 * pulse)))
            }
        }
        .allowsHitTesting(false)
    }
}
