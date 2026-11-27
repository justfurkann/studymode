import SwiftUI

/// The Fosfor on the main screens (Bugün, Tekrar, Sınavlar, Hesap): tap it to open the assistant.
/// When the screen opens it says a short line once so people learn it can be tapped. Inside a
/// course or note the floating Fosfor button does this job instead.
struct TalkingFosfor: View {
    @Environment(AssistantPlace.self) private var place
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var size: CGFloat = 54
    var mood: FosforMascotView.Mood = .curious
    var onDark = false

    @State private var line: String?

    private static let lines = [
        "Bana dokun, soru sor!",
        "Takıldığın yer mi var? Dokun.",
        "Bir şey soracaksan buradayım.",
        "Sınava kaç gün kaldı, plan yapalım mı?",
        "Bir konuyu basitçe anlatayım mı?",
    ]
    /// The hint stops after a while: by then people know.
    private static let shownKey = "studymode.fosforHintCount"
    private static let maxShows = 12

    var body: some View {
        FosforMascotView(size: size, mood: mood, onDark: onDark, tappable: false)
            .contentShape(Rectangle())
            .onTapGesture {
                OnboardingHaptics.light()
                withAnimation { line = nil }
                place.show(course: nil, note: nil)
            }
            .overlay(alignment: .trailing) {
                if let line {
                    Text(line)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.cardLine, lineWidth: 1.2))
                        .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
                        .frame(width: 150, alignment: .trailing)
                        // To the left of Fosfor, like a speech bubble.
                        .offset(x: -(size + 10))
                        .transition(.scale(scale: 0.6, anchor: .trailing).combined(with: .opacity))
                        .onTapGesture {
                            withAnimation { self.line = nil }
                            place.show(course: nil, note: nil)
                        }
                        .accessibilityHidden(true)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Fosfor'a sor")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { place.show(course: nil, note: nil) }
            .task {
                let shown = UserDefaults.standard.integer(forKey: Self.shownKey)
                guard shown < Self.maxShows else { return }
                try? await Task.sleep(for: .milliseconds(900))
                guard !Task.isCancelled else { return }
                UserDefaults.standard.set(shown + 1, forKey: Self.shownKey)
                withAnimation(reduceMotion ? nil : .spring(response: 0.4, dampingFraction: 0.7)) {
                    line = Self.lines[shown % Self.lines.count]
                }
                try? await Task.sleep(for: .seconds(4))
                withAnimation { line = nil }
            }
    }
}
