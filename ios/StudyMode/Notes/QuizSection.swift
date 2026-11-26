import SwiftUI

/// A note's test, like the site's QuizTab: one question at a time, "Kontrol et", the explanation,
/// then the score, the mistakes, "Tekrar çöz" and "Yanlışlarımı karta çevir". The last result stays
/// on screen when the student comes back, until they retake it.
struct QuizSection: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    /// "Kartlarla pekiştir".
    let toCards: () -> Void

    @State private var questions: [Question] = []
    @State private var loaded = false
    @State private var loadError: String?
    @State private var index = 0
    @State private var selected: Int?
    @State private var checked = false
    @State private var answers: [Int] = []
    @State private var retaking = false
    @State private var converted = false

    private var finished: Bool { !questions.isEmpty && answers.count == questions.count }
    private var showingPast: Bool { !finished && !retaking && answers.isEmpty && store.lastAttempt(for: note) != nil }

    var body: some View {
        Group {
            if !loaded {
                ProgressView().tint(Theme.text2).frame(maxWidth: .infinity).padding(.top, 30)
            } else if let loadError {
                Message(text: loadError, kind: .error)
            } else if questions.isEmpty {
                EmptyBox(title: "Bu not için soru yok", text: "Not yeniden hazırlanınca sorular burada görünür.")
            } else if finished || showingPast {
                result
            } else {
                questionView
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard !loaded else { return }
        do {
            questions = try await store.questions(for: note)
        } catch is CancellationError {
            return
        } catch {
            loadError = "Sorular yüklenemedi. Bağlantını kontrol edip tekrar dene."
        }
        loaded = true
    }

    // MARK: Question

    private var questionView: some View {
        let question = questions[index]
        let correct = question.answerIndex
        return VStack(alignment: .leading, spacing: 16) {
            if index == 0 && !checked && store.lastAttempt(for: note) == nil {
                Text("Önce ne bildiğini görelim. Bilmediğin soruda tahmin etme; yanlışlar karta dönüşür.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("Soru \(index + 1) / \(questions.count)")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Theme.text2)
                ProgressView(value: Double(index), total: Double(questions.count)).tint(Theme.accent)
            }

            VStack(alignment: .leading, spacing: 14) {
                MathText(question.prompt)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 8) {
                    ForEach(Array(question.options.enumerated()), id: \.offset) { i, option in
                        OptionRow(letter: Self.letters[i % Self.letters.count], text: option, state: state(i, correct: correct)) {
                            if !checked { selected = i }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .focusCard()

            if checked, let selected {
                VStack(alignment: .leading, spacing: 8) {
                    Label(selected == correct ? "Doğru!" : "Yanlış — doğru cevap \(Self.letters[correct]).", systemImage: selected == correct ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .font(.headline)
                        .foregroundStyle(selected == correct ? Theme.success : Theme.danger)
                    if !question.explanation.isEmpty {
                        MathText(question.explanation)
                            .font(.subheadline)
                            .foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let source = question.source, !source.isEmpty {
                        Text("“\(source)”")
                            .font(.footnote.italic())
                            .foregroundStyle(Theme.text3)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(selected == correct ? Theme.hiSoft : Theme.dangerSoft, in: RoundedRectangle(cornerRadius: 14))
            }

            if checked {
                Button(index + 1 == questions.count ? "Sonucu gör" : "Sonraki soru") { next() }
                    .buttonStyle(PrimaryButtonStyle())
            } else {
                Button("Kontrol et") { withAnimation(.snappy) { checked = true } }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(selected == nil)
            }
        }
        .sensoryFeedback(.selection, trigger: selected)
        .sensoryFeedback(trigger: checked) { _, isChecked in
            guard isChecked, let selected else { return nil }
            return selected == correct ? .success : .error
        }
    }

    private func state(_ i: Int, correct: Int) -> OptionRow.State {
        if checked {
            if i == correct { return .correct }
            if i == selected { return .wrong }
            return .idle
        }
        return i == selected ? .selected : .idle
    }

    private func next() {
        guard let selected else { return }
        let all = answers + [selected]
        self.selected = nil
        checked = false
        withAnimation(.snappy) {
            answers = all
            if all.count == questions.count {
                store.saveAttempt(note: note, questions: questions, answers: all)
            } else {
                index += 1
            }
        }
    }

    private func restart() {
        withAnimation(.snappy) {
            retaking = true
            index = 0
            selected = nil
            checked = false
            answers = []
            converted = false
        }
    }

    // MARK: Result

    /// The mistakes of this run, or of the saved attempt when its questions are still the same.
    private var mistakes: (items: [(question: Question, given: Int?)], outdated: Bool) {
        if finished {
            return (questions.enumerated().compactMap { i, q in answers[i] == q.answerIndex ? nil : (q, answers[i]) }, false)
        }
        guard let attempt = store.lastAttempt(for: note) else { return ([], false) }
        let wrongIds = Set(attempt.wrongIds ?? [])
        let same = questions.count == attempt.total && wrongIds.allSatisfy { id in questions.contains { $0.id == id } }
        guard same else { return ([], attempt.score < attempt.total) }
        let answersMatch = attempt.answers?.count == questions.count
        return (questions.enumerated().compactMap { i, q in wrongIds.contains(q.id) ? (q, answersMatch ? attempt.answers?[i] : nil) : nil }, false)
    }

    private var result: some View {
        let attempt = store.lastAttempt(for: note)
        let total = finished ? questions.count : (attempt?.total ?? questions.count)
        let wrong = mistakes
        let score = finished ? questions.count - wrong.items.count : (attempt?.score ?? 0)
        let ratio = Double(score) / Double(max(total, 1))

        return VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 10) {
                Text(finished ? "Sonuç" : "Son sonucun\(attempt.flatMap { Dates.parse($0.createdAt) }.map { " · " + Dates.short($0) } ?? "")")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.text2)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(score)")
                        .font(Theme.display(.largeTitle))
                        .padding(.horizontal, 6)
                        .background(ratio == 1 && finished ? Theme.hi : .clear, in: RoundedRectangle(cornerRadius: 6))
                    Text("/ \(total)").font(Theme.display(.title2))
                }
                .foregroundStyle(Theme.text)
                Text(ratio == 1 ? "Hepsi doğru, harika!" : ratio >= 0.7 ? "İyi gidiyorsun. Eksiklerini karta çevir, kartlarla kapat." : "Eksiklerin belli oldu. Yanlışlarını karta çevir, kartlarla çalış.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 10) {
                    Button(action: toCards) {
                        HStack(spacing: 6) { Text("Kartlarla pekiştir"); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    HStack(spacing: 10) {
                        Button { restart() } label: { Label("Tekrar çöz", systemImage: "arrow.counterclockwise") }
                            .buttonStyle(SecondaryButtonStyle())
                        if !wrong.items.isEmpty {
                            Button {
                                store.cardsFromMistakes(note: note, questions: wrong.items.map(\.question))
                                converted = true
                            } label: {
                                Text(converted ? "Kartlara eklendi" : "Yanlışlarımı karta çevir")
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .disabled(converted)
                        }
                    }
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .focusCard()

            if wrong.outdated {
                Text("Sorular bu testten sonra yeniden hazırlandığı için yanlışların ayrıntısı gösterilemiyor.")
                    .font(.footnote)
                    .foregroundStyle(Theme.text3)
            }

            if !wrong.items.isEmpty {
                SectionTitle("Yanlışların")
                ForEach(wrong.items, id: \.question.id) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        MathText(item.question.prompt)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                        if let given = item.given, item.question.options.indices.contains(given) {
                            Label { MathText(item.question.options[given]) } icon: { Image(systemName: "xmark") }
                                .font(.subheadline)
                                .foregroundStyle(Theme.danger)
                        }
                        Label { MathText(item.question.options[item.question.answerIndex]) } icon: { Image(systemName: "checkmark") }
                            .font(.subheadline)
                            .foregroundStyle(Theme.success)
                        if !item.question.explanation.isEmpty {
                            MathText(item.question.explanation)
                                .font(.footnote)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                }
            }
        }
    }

    static let letters = ["A", "B", "C", "D", "E", "F"]
}

private struct OptionRow: View {
    enum State { case idle, selected, correct, wrong }
    let letter: String
    let text: String
    let state: State
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 12) {
                Text(letter)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(letterForeground)
                    .frame(width: 30, height: 30)
                    .background(letterBackground, in: RoundedRectangle(cornerRadius: 8))
                MathText(text)
                    .font(.body)
                    .foregroundStyle(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
                if state == .correct { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.success).padding(.top, 5) }
                if state == .wrong { Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.danger).padding(.top, 5) }
            }
            .padding(10)
            .background(rowBackground, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(border, lineWidth: state == .idle ? 1 : 2))
            .contentShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(state == .selected ? .isSelected : [])
    }

    private var letterBackground: Color {
        switch state {
        case .selected: Theme.hi
        case .correct: Theme.success
        case .wrong: Theme.danger
        case .idle: Theme.surface2
        }
    }

    private var letterForeground: Color {
        switch state {
        case .selected: Theme.onHi
        case .correct, .wrong: .white
        case .idle: Theme.text
        }
    }

    private var rowBackground: Color {
        switch state {
        case .selected: Theme.hiSoft
        case .correct: Theme.success.opacity(0.12)
        case .wrong: Theme.dangerSoft
        case .idle: Theme.surface
        }
    }

    private var border: Color {
        switch state {
        case .selected: Theme.cardLine
        case .correct: Theme.success
        case .wrong: Theme.danger
        case .idle: Theme.border
        }
    }
}

/// A small titled box for empty states inside a note.
struct EmptyBox: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(Theme.display(.title3))
                .foregroundStyle(Theme.text)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }
}
