import SwiftUI

enum FosforScreen: String {
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

/// The bubble takes a real row above the mascot. The card title and actions keep their own space.
struct TalkingFosfor<Content: View>: View {
    @Environment(AssistantPlace.self) private var place
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("fosfor.didShowChatHint") private var didShowHint = false
    let screen: FosforScreen
    var size: CGFloat = 54
    var mood: FosforMascotView.Mood = .curious
    var onDark = false
    @ViewBuilder let content: () -> Content
    @State private var line: String?

    private var canSpeak: Bool { scenePhase == .active && !place.open }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            if let line {
                Button(action: ask) {
                    SpeechBubble(text: line, tailTrailingOffset: size / 2 - 6)
                }
                .buttonStyle(.plain)
                .accessibilityHidden(true)
                .transition(.opacity)
            }

            HStack(alignment: .top, spacing: 8) {
                content()
                Spacer(minLength: 0)
                Button(action: ask) {
                    FosforChatLabel(size: size, mood: mood, onDark: onDark)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Fosfor’a sor")
                .accessibilityHint("Sohbeti açar")
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: line)
        .task(id: canSpeak) {
            line = nil
            guard canSpeak else { return }
            do {
                try await Task.sleep(for: .seconds(1))
                while !Task.isCancelled {
                    line = didShowHint ? screen.drawLine() : "Takıldığın yeri bana sorabilirsin."
                    didShowHint = true
                    try await Task.sleep(for: .seconds(5))
                    line = nil
                    try await Task.sleep(for: .seconds(30))
                }
            } catch { /* SwiftUI cancels the timer when this screen leaves or the chat opens. */ }
        }
        .onDisappear { line = nil }
    }

    private func ask() {
        OnboardingHaptics.light()
        place.show(course: nil, note: nil)
    }
}

/// The mascot and its visible action form a single tap target.
struct FosforChatLabel: View {
    let size: CGFloat
    let mood: FosforMascotView.Mood
    let onDark: Bool

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            FosforMascotView(size: size, mood: mood, onDark: onDark, tappable: false)
            Label("Fosfor’a sor", systemImage: "bubble.left")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 7)
                .padding(.vertical, 4)
                .background(Theme.hi, in: Capsule())
        }
        .contentShape(Rectangle())
    }
}

/// Crisp Fosforlu speech bubble with a downward tail pointing at Fosfor's cap.
private struct SpeechBubble: View {
    let text: String
    let tailTrailingOffset: CGFloat

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
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
            .padding(.trailing, tailTrailingOffset)
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
