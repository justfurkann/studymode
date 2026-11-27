import StoreKit
import SwiftUI

/// "Premium": what it gives, the three App Store plans, restore, and the subscription terms Apple
/// asks for (auto-renewal, cancel in Settings, links to the terms and the privacy policy).
struct PremiumView: View {
    @Environment(PremiumStore.self) private var premium
    @State private var manage = false

    private let features: [(icon: String, text: String)] = [
        ("waveform", "Notun iki kişilik sesli sohbete dönüşür"),
        ("magnifyingglass", "Notlarında anlamla arama"),
        ("photo", "Konuyu anlatan yapay zekâ görselleri"),
        ("sparkles", "Daha güçlü model (Free+), günde 150 istek"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if premium.isPremium { activeCard }
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(features, id: \.text) { f in
                        Label(f.text, systemImage: f.icon)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))

                plans
                if let message = premium.message, !showPreview { Message(text: message, kind: .warning) }
                if premium.unsynced > 0 {
                    Message(text: "Satın alman alındı; hesabına işleniyor. İnternete bağlanınca kendiliğinden tamamlanır.", kind: .warning)
                }
                Button {
                    Task { await premium.restore() }
                } label: {
                    Label("Satın alımları geri yükle", systemImage: "arrow.clockwise")
                }
                .buttonStyle(SecondaryButtonStyle())
                legal
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(GridPaper())
        .navigationTitle("Premium")
        .navigationBarTitleDisplayMode(.inline)
        .manageSubscriptionsSheet(isPresented: $manage, subscriptionGroupID: PremiumStore.ID.groupID)
        .task {
            await premium.loadProducts()
            await premium.refresh()
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("StudyMode").font(Theme.display(.title)).foregroundStyle(Theme.text).lineLimit(1)
                Highlighted(text: "Premium", font: Theme.display(.title))
                Text("Sitede ve uygulamada aynı hesapla geçerli.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
            }
            Spacer(minLength: 0)
            FosforMascotView(size: 52, mood: .cheering)
        }
    }

    private var activeCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Premium açık", systemImage: "checkmark.seal.fill")
                .font(.headline)
                .foregroundStyle(Theme.text)
            if premium.role == "vip" || premium.role == "admin" {
                Text("Hesabın her şeye zaten erişebiliyor.").font(.subheadline).foregroundStyle(Theme.text2)
            } else if let until = premium.until {
                Text(premium.willRenew
                     ? "Abonelik \(until.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year())) tarihinde yenilenecek."
                     : "\(until.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).year().hour().minute())) tarihine kadar geçerli.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
            }
            if premium.activeSubscription != nil {
                Button("Aboneliği yönet") { manage = true }
                    .font(.subheadline.weight(.semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.cardLine, lineWidth: 1.5))
    }

    /// The simulator cannot load App Store products; there the plans are drawn from App Store
    /// Connect's names and prices (not tappable), for the review screenshot and layout checks.
    private var showPreview: Bool {
        #if targetEnvironment(simulator)
        return premium.products.isEmpty && !premium.loading
        #else
        return false
        #endif
    }

    @ViewBuilder
    private var plans: some View {
        if showPreview {
            VStack(spacing: 10) {
                previewRow(name: "Premium 2 Hafta", note: "Tek seferlik · 14 gün, yenilenmez", price: "₺49,99", best: false)
                previewRow(name: "Premium Aylık", note: "Otomatik yenilenir · istediğin an iptal", price: "₺99,99", best: false)
                previewRow(name: "Premium 6 Aylık", note: "Otomatik yenilenir · istediğin an iptal", price: "₺499,99", best: true)
            }
        } else if premium.products.isEmpty {
            if premium.loading {
                ProgressView("Paketler yükleniyor…").frame(maxWidth: .infinity)
            }
        } else {
            VStack(spacing: 10) {
                ForEach(premium.products, id: \.id) { product in
                    planRow(product)
                }
            }
        }
    }

    private func previewRow(name: String, note: String, price: String, best: Bool) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(name).font(.headline).foregroundStyle(Theme.text)
                    if best {
                        Text("En avantajlı").font(.caption2.weight(.heavy)).foregroundStyle(Theme.onHi)
                            .padding(.horizontal, 7).padding(.vertical, 3).background(Theme.hi, in: Capsule())
                    }
                }
                Text(note).font(.caption).foregroundStyle(Theme.text2)
            }
            Spacer()
            Text(price).font(.headline.monospacedDigit()).foregroundStyle(Theme.text)
        }
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    private func planRow(_ product: Product) -> some View {
        let isActive = premium.activeSubscription == product.id
        let renews = product.type == .autoRenewable
        return Button {
            Task { await premium.buy(product) }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(product.displayName).font(.headline).foregroundStyle(Theme.text)
                        if product.id == PremiumStore.ID.sixMonths {
                            Text("En avantajlı").font(.caption2.weight(.heavy)).foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 7).padding(.vertical, 3).background(Theme.hi, in: Capsule())
                        }
                    }
                    Text(renews ? "Otomatik yenilenir · istediğin an iptal" : "Tek seferlik · 14 gün, yenilenmez")
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                }
                Spacer()
                if premium.purchasing == product.id {
                    ProgressView()
                } else if isActive {
                    Text("Aktif").font(.subheadline.weight(.bold)).foregroundStyle(Theme.text2)
                } else {
                    Text(product.displayPrice).font(.headline.monospacedDigit()).foregroundStyle(Theme.text)
                }
            }
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(isActive ? Theme.cardLine : Theme.border, lineWidth: isActive ? 2 : 1))
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(TactileCardButtonStyle())
        .disabled(premium.purchasing != nil || isActive)
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
        }
    }
}
