import SwiftUI

/// The Fosfor on the main screens (Bugün, Tekrar, Sınavlar, Hesap): tap it to open the assistant.
/// Floats a witty speech bubble *above* Fosfor's head so it never covers card text to the left.
struct TalkingFosfor: View {
    @Environment(AssistantPlace.self) private var place
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 54
    var mood: FosforMascotView.Mood = .curious
    var onDark = false

    @State private var line: String?

    private static let lines = [
        "Bana dokun, soru sor!",
        "Notlar birikmiş sanki... bir el atayım mı?",
        "Vizeye son gece çalışmıyoruz dimi? Dimi?!",
        "Kahveni aldıysan başlayalım, ben hazırım.",
        "Hoca kesin sorar dediğin yeri bana sor.",
        "Ezberlemekten beynin yandıysa basitçe anlatayım.",
        "Ben uyumuyorum, gece 3'te de sorabilirsin.",
        "Kopya yok ama benden ipucu almak serbest.",
        "Bu konuyu 5 yaşındaki çocuğa anlatır gibi anlatayım mı?",
        "Sınavda ne çıkabilir, tahmin edelim mi?",
        "Şu formül gözünü korkutmasın, dokun halledelim.",
        "Kafan karıştıysa tıkla, düğümü çözelim.",
        "Sıkıldıysan beni dürt, sana bir soru sorayım.",
        "Not uzun diye erteleme, beraber bölelim.",
        "Unutma eğrisi peşimizde, kaçmadan tekrar yapalım!",
        "İki dakikada özet geçeyim, kafa rahat etsin.",
        "Takıldığın tek bir cümle bile olsa bana at.",
        "Bugün hedefi eritirsek kralsın.",
    ]

    private static let lastLineKey = "studymode.fosforLastLine"

    var body: some View {
        FosforMascotView(size: size, mood: mood, onDark: onDark, tappable: false)
            .contentShape(Rectangle())
            .onTapGesture {
                OnboardingHaptics.light()
                withAnimation { line = nil }
                place.show(course: nil, note: nil)
            }
            .overlay(alignment: .topTrailing) {
                if let line {
                    SpeechBubble(text: line, tailTrailingOffset: max(12, size * 0.42))
                        .frame(maxWidth: 210, alignment: .trailing)
                        .fixedSize(horizontal: false, vertical: true)
                        // Floats right above Fosfor's cap so it never overlaps text on the left.
                        .alignmentGuide(.top) { d in d[.bottom] + 6 }
                        .transition(.scale(scale: 0.65, anchor: .bottomTrailing).combined(with: .opacity))
                        .onTapGesture {
                            OnboardingHaptics.light()
                            withAnimation { self.line = nil }
                            place.show(course: nil, note: nil)
                        }
                        .accessibilityHidden(true)
                }
            }
            .zIndex(20)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Fosfor'a sor")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { place.show(course: nil, note: nil) }
            .task {
                try? await Task.sleep(for: .milliseconds(850))
                guard !Task.isCancelled else { return }
                let picked = Self.nextLine()
                withAnimation(reduceMotion ? nil : .spring(response: 0.42, dampingFraction: 0.72)) {
                    line = picked
                }
                try? await Task.sleep(for: .seconds(4.6))
                guard !Task.isCancelled else { return }
                withAnimation(.easeOut(duration: 0.25)) { line = nil }
            }
    }

    private static func nextLine() -> String {
        let last = UserDefaults.standard.integer(forKey: lastLineKey)
        var idx = Int.random(in: 0..<lines.count)
        if idx == last { idx = (idx + 1) % lines.count }
        UserDefaults.standard.set(idx, forKey: lastLineKey)
        return lines[idx]
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
                .lineLimit(3)
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
