import SwiftUI

/// One study round over a fixed queue of cards, like the site's ReviewSession and note card round.
/// `.grades` (Tekrar tab): Bilemedim / Zor / İyi / Kolay with when each brings the card back.
/// `.simple` (a note's Kartlar): Tekrar / Bildim. Cards answered "again" go to the back of the queue.
struct ReviewSession: View {
    enum Mode { case grades, simple }

    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let title: String
    let mode: Mode
    /// Called once when the queue is finished (the note's Kartlar step uses it).
    var onFinish: (() -> Void)?

    @State private var queue: [UUID]
    @State private var total: Int
    @State private var answered = 0
    @State private var knownFirstTry = 0
    @State private var missed: Set<UUID> = []
    @State private var revealed = false
    @State private var showHint = false
    @State private var finished = false
    private let startIds: [UUID]

    init(title: String, cards: [Card], mode: Mode, onFinish: (() -> Void)? = nil) {
        self.title = title
        self.mode = mode
        self.onFinish = onFinish
        let ids = cards.map(\.id)
        startIds = ids
        _queue = State(initialValue: ids)
        _total = State(initialValue: ids.count)
    }

    private var card: Card? { queue.first.flatMap { id in store.cards.first { $0.id == id } } }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                VStack(spacing: 18) {
                    if let card, !finished {
                        progress
                        CardFace(card: card, revealed: revealed, hint: showHint ? CardHint.make(card.back) : nil)
                            .onTapGesture { if !revealed { withAnimation(.snappy) { revealed = true } } }
                        controls(for: card)
                    } else {
                        done
                    }
                }
                .padding(16)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                        .accessibilityLabel("Kapat")
                }
            }
            .overlay(alignment: .top) { SaveErrorBanner() }
        }
        .sensoryFeedback(.selection, trigger: revealed)
    }

    private var progress: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(answered) / \(total)")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Theme.text2)
                Spacer()
                Text("\(queue.count) kart kaldı")
                    .font(.footnote)
                    .foregroundStyle(Theme.text3)
            }
            ProgressView(value: Double(max(0, total - queue.count)), total: Double(max(total, 1)))
                .tint(Theme.accent)
        }
    }

    @ViewBuilder
    private func controls(for card: Card) -> some View {
        if !revealed {
            VStack(spacing: 10) {
                Button { withAnimation(.snappy) { revealed = true } } label: { Text("Cevabı göster") }
                    .buttonStyle(PrimaryButtonStyle())
                if !showHint, !CardHint.make(card.back).isEmpty {
                    Button { withAnimation { showHint = true } } label: { Label("İpucu", systemImage: "lightbulb") }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
        } else {
            switch mode {
            case .simple:
                HStack(spacing: 10) {
                    Button { answer(card, .again) } label: { Label("Tekrar", systemImage: "arrow.counterclockwise") }
                        .buttonStyle(SecondaryButtonStyle())
                    Button { answer(card, .good) } label: { Label("Bildim", systemImage: "checkmark") }
                        .buttonStyle(PrimaryButtonStyle())
                }
            case .grades:
                HStack(spacing: 8) {
                    ForEach(Grade.allCases, id: \.self) { grade in
                        Button { answer(card, grade) } label: {
                            VStack(spacing: 2) {
                                Text(grade.label).font(.subheadline.weight(.semibold))
                                Text(SRS.intervalLabel(store.preview(card, grade)))
                                    .font(.caption2.monospacedDigit())
                                    .opacity(0.75)
                            }
                        }
                        .buttonStyle(GradeButtonStyle(primary: grade == .good))
                    }
                }
            }
        }
    }

    private var done: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .heavy))
                .foregroundStyle(Theme.onHi)
                .frame(width: 76, height: 76)
                .background(Theme.hi, in: Circle())
            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Text("Tur")
                        .font(Theme.display(.title))
                        .foregroundStyle(Theme.text)
                    Highlighted(text: "bitti!", font: Theme.display(.title))
                }
                Text(summaryLine)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            VStack(spacing: 10) {
                Button("Bitir") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                if mode == .simple, !startIds.isEmpty {
                    Button("Baştan çalış") { restart() }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var summaryLine: String {
        if total == 0 { return "Şu an çalışılacak kart yok." }
        if mode == .simple { return "\(total) kartın \(knownFirstTry) tanesini ilk denemede bildin." }
        return "\(total) kartı tekrar ettin. Sıradaki tekrarları zamanı gelince burada bulacaksın."
    }

    private func answer(_ card: Card, _ grade: Grade) {
        store.review(card, grade)
        answered += 1
        if grade == .again {
            missed.insert(card.id)
        } else if !missed.contains(card.id) {
            knownFirstTry += 1
        }
        revealed = false
        showHint = false
        withAnimation(.snappy) {
            var next = Array(queue.dropFirst())
            if grade == .again { next.append(card.id) }
            queue = next
            if next.isEmpty {
                finished = true
                onFinish?()
            }
        }
    }

    private func restart() {
        queue = startIds
        total = startIds.count
        answered = 0
        knownFirstTry = 0
        missed = []
        finished = false
    }
}

/// Front, then the answer below it once turned. Formulas are drawn with MathText.
private struct CardFace: View {
    let card: Card
    let revealed: Bool
    let hint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Soru")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text3)
                    MathText(card.front)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                    if let hint, !revealed {
                        Label(hint, systemImage: "lightbulb")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                            .padding(10)
                            .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 10))
                    }
                    if revealed {
                        Divider().overlay(Theme.border)
                        Text("Cevap")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text3)
                        MathText(card.back)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                        if let source = card.source, !source.isEmpty {
                            Text("“\(source)”")
                                .font(.footnote.italic())
                                .foregroundStyle(Theme.text3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize)
            if !revealed {
                Text("Dokun ya da “Cevabı göster”e bas")
                    .font(.caption)
                    .foregroundStyle(Theme.text3)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .focusCard()
        .contentShape(Rectangle())
    }
}

private struct GradeButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(primary ? Theme.onHi : Theme.text)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(primary ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(primary ? Theme.cardLine : Theme.border, lineWidth: primary ? 2 : 1.5))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// The site's cardHint: a short answer shows its first letter and length ("M_________"),
/// a longer one its first few words.
enum CardHint {
    static func make(_ back: String) -> String {
        let text = TeX.plain(back).trimmingCharacters(in: .whitespacesAndNewlines)
        let firstSentence = text.components(separatedBy: "\n").first.map { line -> String in
            if let r = line.range(of: #"(?<=[.!?])\s"#, options: .regularExpression) { return String(line[..<r.lowerBound]) }
            return line
        }?.trimmingCharacters(in: .whitespaces) ?? ""
        let words = firstSentence.split(whereSeparator: \.isWhitespace).map(String.init)
        guard let first = words.first else { return "" }
        if words.count <= 2 {
            let word = first.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?"))
            guard word.count > 1 else { return word }
            return String(word.prefix(1)) + String(repeating: "_", count: word.count - 1) + (words.count > 1 ? " …" : "")
        }
        let shown = min(4, max(1, words.count / 3))
        return words.prefix(shown).joined(separator: " ") + " …"
    }
}

/// A failed save, shown on top of whatever is open.
struct SaveErrorBanner: View {
    @Environment(StudyStore.self) private var store

    var body: some View {
        if let error = store.saveError {
            Message(text: error, kind: .error)
                .padding(.horizontal, 16)
                .onTapGesture { store.saveError = nil }
                .task {
                    try? await Task.sleep(for: .seconds(5))
                    store.saveError = nil
                }
        }
    }
}
