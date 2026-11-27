import SwiftUI

enum FosforScreen: String, CaseIterable {
    case desk, review, exam, account

    var lines: [String] {
        switch self {
        case .desk: [
            "Ben fosforluyum. Sen daha parlaksın.",
            "Defteri aç, dramatik müzik benden.",
            "Bugün hangi satırın altını çiziyoruz?",
            "Kalem kutusunda mesai başladı.",
            "Boş sayfayla bakıştık. İlk o kırptı.",
            "Kapağımı buldum. Başlayabiliriz."
        ]
        case .review: [
            "Cevap dilinin ucunda mı? Kartı çevir.",
            "Bu kartı bir yerden gözüm ısırıyor.",
            "Beynin «tanışıyoruz» dedi. Bakalım.",
            "Kartı çevir. Ben gözlerimi kapattım.",
            "Unuttuysan iyi ki bugün karşılaştık.",
            "Hafıza yoklaması. Ben: burada!"
        ]
        case .exam: [
            "«Kesin çıkar» diyen kalem ben değilim.",
            "Sınav kâğıdını görünce beni tanımazdan gel.",
            "Optik formda beni kullanma, yeter.",
            "Silgi de geldi. Moral desteğiymiş.",
            "Formülle aranız nasıl? Arayı yaparım.",
            "Bu masada panik en arka sırada."
        ]
        case .account: [
            "Profil fotoğrafımda kapağım yamuk mu?",
            "Buraya imza atardım. Fosforlu olurdu.",
            "Adımı kaydederken soyadım Kalem olsun.",
            "Hesap sende. Kalem kutusu bende.",
            "Vesikalıkta da böyle sarı çıktım.",
            "Benim ayarım fabrikadan fosforlu."
        ]
        }
    }

    func drawLine() -> String {
        let key = "fosfor.remaining." + rawValue
        let previous = UserDefaults.standard.string(forKey: key + ".last")
        var bag = (UserDefaults.standard.stringArray(forKey: key) ?? []).filter(lines.contains)
        if bag.isEmpty {
            bag = lines.shuffled()
            if bag.count > 1 && bag.last == previous { bag.swapAt(0, bag.count - 1) }
        }
        let line = bag.removeLast()
        UserDefaults.standard.set(bag, forKey: key)
        UserDefaults.standard.set(line, forKey: key + ".last")
        return line
    }
}

/// A screen header row. The main screens used to carry a talking Fosfor here; Fosfor now has its own
/// tab, so the header keeps only its content.
struct HeaderRow<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            content()
            Spacer(minLength: 0)
        }
    }
}

/// The big Fosfor at the top of its tab: says a line now and then, a new one on every tap.
struct FosforHero: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("fosfor.didShowChatHint") private var didShowHint = false
    var mood: FosforMascotView.Mood = .curious
    @State private var line: String?

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                if let line {
                    SpeechBubble(text: line, tailTrailingOffset: nil)
                        .frame(maxWidth: 250)
                        .transition(.opacity.combined(with: .scale(scale: 0.9, anchor: .bottom)))
                        .accessibilityHidden(true)
                }
            }
            .frame(minHeight: 52, alignment: .bottom)

            FosforMascotView(size: 112, mood: mood)
                .simultaneousGesture(TapGesture().onEnded { say() })
                .accessibilityLabel("Fosfor")
                .accessibilityHint("Dokununca bir şey söyler")
        }
        .frame(maxWidth: .infinity)
        .animation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.8), value: line)
        .task(id: scenePhase == .active) {
            guard scenePhase == .active else { return }
            do {
                try await Task.sleep(for: .seconds(0.6))
                while !Task.isCancelled {
                    if didShowHint { say() } else { line = "Bana dokun, ya da aşağıdan bir şey sor."; didShowHint = true }
                    try await Task.sleep(for: .seconds(6))
                    line = nil
                    try await Task.sleep(for: .seconds(20))
                }
            } catch { /* The tab left or the app went to the background. */ }
        }
    }

    private func say() {
        let screen = FosforScreen.allCases.randomElement() ?? .desk
        line = screen.drawLine()
    }
}

/// Crisp Fosforlu speech bubble with a downward tail pointing at Fosfor's cap.
struct SpeechBubble: View {
    let text: String
    /// Space from the bubble's right edge to the tail; nil centres the tail.
    let tailTrailingOffset: CGFloat?

    var body: some View {
        VStack(alignment: tailTrailingOffset == nil ? .center : .trailing, spacing: 0) {
            Text(text)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(Theme.cardLine, lineWidth: 1.3)
                )
                .shadow(color: Theme.cardDrop.opacity(0.18), radius: 8, y: 3)

            // Little pointer triangle sitting directly above Fosfor's cap
            ZStack {
                BubbleTail()
                    .fill(Theme.surface)
                BubbleTailStroke()
                    .stroke(Theme.cardLine, style: StrokeStyle(lineWidth: 1.3, lineCap: .round, lineJoin: .round))
            }
            .frame(width: 12, height: 6)
            .offset(y: -1)
            .padding(.trailing, tailTrailingOffset ?? 0)
        }
    }
}

private struct BubbleTail: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}

private struct BubbleTailStroke: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return p
    }
}
