import StoreKit
import SwiftUI

/// "Premium": mirrors the website's violet/magenta/gold Premium experience (`src/pages/Premium.tsx`
/// and `.prem-*` in `global.css`) while keeping Apple's StoreKit 2 purchase flow, restore, manage
/// subscriptions, and required subscription disclosures.
struct PremiumView: View {
    @Environment(PremiumStore.self) private var premium
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var manage = false
    @State private var selectedID: String = PremiumStore.ID.sixMonths
    @State private var glowPulse = false
    @State private var sheenOffset: CGFloat = -1.4

    private struct Feature: Identifiable {
        let id: String
        let icon: String
        let title: String
        let detail: String
    }

    private let features: [Feature] = [
        .init(
            id: "ses",
            icon: "headphones",
            title: "Sesli not",
            detail: "Notun iki kişilik gerçek insan sesli sohbete dönüşür; yolda, otobüste dinle."
        ),
        .init(
            id: "ara",
            icon: "magnifyingglass",
            title: "Akıllı arama",
            detail: "Kelimesi geçmese de notlarında anlamla arama yap, ilgili konuyu anında bul."
        ),
        .init(
            id: "gorsel",
            icon: "photo.on.rectangle.angled",
            title: "Yapay zekâ görselleri",
            detail: "Karmaşık kavramları şema ve görsele dönüştür, tek dokunuşla karta ekle."
        ),
        .init(
            id: "freeplus",
            icon: "sparkles",
            title: "Free+ ve yüksek limit",
            detail: "Daha güçlü yapay zekâ modeli ve günde 150 istek hakkı."
        ),
    ]

    private var selectedProduct: Product? {
        premium.products.first { $0.id == selectedID }
            ?? premium.products.first { $0.id == PremiumStore.ID.sixMonths }
            ?? premium.products.first
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                heroCard
                    .staggeredAppear(0)

                if premium.unsynced > 0 {
                    Message(
                        text: "Satın alman alındı; hesabına işleniyor. İnternete bağlanınca kendiliğinden tamamlanır.",
                        kind: .warning
                    )
                }

                featuresSection
                    .staggeredAppear(1)

                plansSection
                    .staggeredAppear(2)

                if let message = premium.message, !showPreview {
                    Message(text: message, kind: .warning)
                }

                restoreButton
                    .staggeredAppear(3)

                legal
                    .padding(.top, 2)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 32)
        }
        .background(GridPaper())
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .manageSubscriptionsSheet(isPresented: $manage, subscriptionGroupID: PremiumStore.ID.groupID)
        .task {
            await premium.loadProducts()
            await premium.refresh()
            pickDefaultPlan()
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 3.4).repeatForever(autoreverses: true)) {
                glowPulse = true
            }
            withAnimation(.easeInOut(duration: 4.6).repeatForever(autoreverses: false)) {
                sheenOffset = 2.2
            }
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

    // MARK: - Cosmic Hero Card (.prem-hero)

    private var heroCard: some View {
        ZStack(alignment: .topLeading) {
            // Layered cosmic violet -> magenta -> warm amber glow
            GeometryReader { geo in
                ZStack {
                    LinearGradient(
                        colors: [Theme.premDeep, Theme.prem1, Theme.prem2],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    RadialGradient(
                        colors: [Theme.prem2.opacity(0.68), .clear],
                        center: .topTrailing,
                        startRadius: 10,
                        endRadius: geo.size.width * 0.85
                    )

                    RadialGradient(
                        colors: [Theme.prem3.opacity(0.36), .clear],
                        center: .bottomLeading,
                        startRadius: 8,
                        endRadius: geo.size.width * 0.72
                    )

                    // Subtle breathing warm orb at top-right (`.prem-hero::after`)
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Theme.prem3.opacity(glowPulse ? 0.44 : 0.26), .clear],
                                center: .center,
                                startRadius: 4,
                                endRadius: 110
                            )
                        )
                        .frame(width: 220, height: 220)
                        .position(x: geo.size.width - 26, y: 12)

                    // Diagonal sheen sweep (`.prem-hero-shine`)
                    if !reduceMotion {
                        LinearGradient(
                            colors: [.clear, .white.opacity(0.18), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geo.size.width * 0.46)
                        .rotationEffect(.degrees(18))
                        .scaleEffect(y: 1.8)
                        .offset(x: sheenOffset * geo.size.width)
                    }
                }
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 10) {
                        // Frosted tag pill (`.prem-tag`)
                        HStack(spacing: 6) {
                            Image(systemName: "crown.fill")
                                .font(.caption2.weight(.bold))
                            Text("STUDYMODE PREMIUM")
                                .font(.caption2.weight(.heavy))
                                .tracking(0.8)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .background(.white.opacity(0.15), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.28), lineWidth: 1))

                        // Title with signature Fosforlu highlight word
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text("Notun")
                                    .font(Theme.display(.title))
                                    .foregroundStyle(.white)
                                Highlighted(text: "konuşsun", font: Theme.display(.title))
                            }
                            Text("sen dinle.")
                                .font(Theme.display(.title))
                                .foregroundStyle(.white)
                        }
                    }

                    Spacer(minLength: 4)

                    FosforMascotView(size: 58, mood: .cheering, onDark: true)
                        .padding(.top, 2)
                }

                Text("Sesli not, akıllı arama, yapay zekâ görselleri ve Free+ modeli. Sitede ve uygulamada aynı hesapla geçerli.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)

                statusBadge
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(.white.opacity(0.22), lineWidth: 1.2)
        )
        .shadow(color: Theme.prem1.opacity(0.42), radius: 18, y: 10)
    }

    @ViewBuilder
    private var statusBadge: some View {
        if premium.isPremium {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(Theme.hi)
                    Text("Premium açık")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                    if premium.role == "vip" || premium.role == "admin" {
                        Text(premium.role == "admin" ? "Yönetici" : "VIP")
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(.white.opacity(0.2), in: Capsule())
                    }
                }

                if premium.role == "vip" || premium.role == "admin" {
                    Text("Hesabın tüm Premium özelliklere zaten erişebiliyor.")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.84))
                } else if let until = premium.until {
                    Text(
                        premium.willRenew
                            ? "Abonelik \(until.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year())) tarihinde yenilenecek."
                            : "\(until.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year().hour().minute())) tarihine kadar geçerli."
                    )
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.86))
                }

                if premium.activeSubscription != nil {
                    Button {
                        OnboardingHaptics.light()
                        manage = true
                    } label: {
                        Label("Aboneliği yönet", systemImage: "slider.horizontal.3")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(.white.opacity(0.18), in: Capsule())
                            .overlay(Capsule().stroke(.white.opacity(0.28), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(.white.opacity(0.22), lineWidth: 1))
        } else {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.hi)
                Text("Tek hesap · Web + iPhone + iPad senkron")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.92))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Theme.premDeep.opacity(0.45), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(.white.opacity(0.18), lineWidth: 1))
        }
    }

    // MARK: - Feature Cards (.prem-tool)

    private var featuresSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Premium neler açar?")
                .font(Theme.display(.headline))
                .foregroundStyle(Theme.text)
                .padding(.horizontal, 2)

            VStack(spacing: 10) {
                ForEach(features) { feature in
                    HStack(alignment: .top, spacing: 13) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(
                                    LinearGradient(
                                        colors: [Theme.prem1, Theme.prem2],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 42, height: 42)
                                .shadow(color: Theme.prem2.opacity(0.36), radius: 8, y: 4)

                            Image(systemName: feature.icon)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            Text(feature.title)
                                .font(Theme.display(.subheadline, weight: .bold))
                                .foregroundStyle(Theme.text)
                            Text(feature.detail)
                                .font(.footnote)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(
                                LinearGradient(
                                    colors: [Theme.prem1.opacity(0.38), Theme.prem2.opacity(0.32)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.3
                            )
                    )
                }
            }
        }
    }

    // MARK: - Plans & Purchase CTA

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
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text("Paketini seç")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text("App Store güvencesiyle")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.premText)
            }
            .padding(.horizontal, 2)

            if showPreview {
                VStack(spacing: 10) {
                    ForEach(previewPlans) { plan in
                        planCard(
                            id: plan.id,
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
                            id: product.id,
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
                        label: premium.isPremium
                            ? "Paketi seç · \(target.displayPrice)"
                            : "Premium'a geç · \(target.displayPrice)",
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

    private func planCard(
        id: String,
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
                // Radio / Active indicator
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
                                .tracking(0.4)
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
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [Theme.prem1, Theme.prem2, Theme.prem3],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2.2
                        )
                } else {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(isActive ? Theme.prem1.opacity(0.6) : Theme.border, lineWidth: isActive ? 1.6 : 1)
                }
            }
            .shadow(color: isSelected ? Theme.prem2.opacity(0.22) : .clear, radius: 12, y: 6)
            .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.985))
        .disabled(isActive || premium.purchasing != nil)
    }

    private func purchaseCTA(label: String, busy: Bool, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "crown.fill")
                        .font(.subheadline.weight(.bold))
                }
                Text(busy ? "İşleniyor…" : label)
                    .font(Theme.display(.headline, weight: .heavy))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(
                LinearGradient(
                    colors: [Theme.prem1, Theme.prem2],
                    startPoint: .leading,
                    endPoint: .trailing
                ),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(.white.opacity(0.22), lineWidth: 1)
            )
            .shadow(color: Theme.prem2.opacity(0.42), radius: 14, y: 7)
            .opacity(disabled && !busy ? 0.65 : 1)
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.975))
        .disabled(disabled)
        .padding(.top, 2)
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
                Link("Gizlilik", destination: Config.siteURL.appending(path: "gizlilik"))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.premText)
        }
    }
}
