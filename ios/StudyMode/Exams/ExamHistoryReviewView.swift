import SwiftUI

/// Native iOS port of `src/pages/ExamHistory.tsx` + `src/components/ExamReview.tsx`:
/// Opens any past mock exam result, shows score breakdown, question-by-question answers,
/// explanations/AI feedback, matched source note links, mistake-to-card conversion, and delete.
struct ExamHistoryReviewView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let summary: ExamResultSummary

    @State private var detail: ExamResultDetail?
    @State private var loading = true
    @State private var error: String?
    @State private var toast: String?
    @State private var askDelete = false
    @State private var convertedMistakes = false

    private var course: Course? { store.courses.first { $0.id == summary.courseId } }
    private var courseNotes: [NoteItem] {
        guard let course else { return [] }
        return store.notes(in: course)
    }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let toast {
                        Message(text: toast, kind: .info)
                    }

                    if loading {
                        StudyLoadingStage(message: "Prova detayları yükleniyor…", cardCount: 2)
                    } else if let error {
                        VStack(spacing: 12) {
                            Message(text: error, kind: .error)
                            Button("Tekrar dene") { Task { await load() } }
                                .buttonStyle(SecondaryButtonStyle())
                        }
                    } else if let detail {
                        scoreCard(detail)
                            .staggeredAppear(0)
                        questionsSection(detail)
                            .staggeredAppear(1)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle(course?.name ?? "Sınav provası")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive) {
                    askDelete = true
                } label: {
                    Image(systemName: "trash")
                }
                .accessibilityLabel("Sınav sonucunu sil")
            }
        }
        .confirmationDialog("Bu sınav provası sonucu silinsin mi?", isPresented: $askDelete, titleVisibility: .visible) {
            Button("Sonucu sil", role: .destructive) {
                OnboardingHaptics.medium()
                store.deleteExamResult(id: summary.id)
                dismiss()
            }
        } message: {
            Text("Bu işlem geri alınamaz.")
        }
        .task { await load() }
    }

    // MARK: - Score Hero Card

    private func scoreCard(_ detail: ExamResultDetail) -> some View {
        let pct = detail.percent
        let mistakes = mistakeItems(detail)
        let encouragement: String = pct >= 85
            ? "Bu konulara hazırsın gibi görünüyor."
            : pct >= 60
                ? "Fena değil; aşağıdaki eksiklerine odaklan."
                : "Bu konuları biraz daha çalışmalısın. Eksiklerini karta çevirip tekrar et."

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                if let course {
                    Circle().fill(course.tint).frame(width: 8, height: 8)
                }
                Text("Sınav provası · \(formattedDate(detail.createdAt))")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text2)
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(pct)")
                    .font(Theme.display(.largeTitle, weight: .heavy))
                    .foregroundStyle(Theme.text)
                    .monospacedDigit()
                Text("puan")
                    .font(Theme.display(.title3, weight: .bold))
                    .foregroundStyle(Theme.text2)
                Spacer()
                Text("\(detail.score.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish))) / \(detail.total)")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Theme.hi, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
            }

            Text(encouragement)
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)

            Text(metaLine(detail))
                .font(.caption)
                .foregroundStyle(Theme.text3)

            if !mistakes.isEmpty {
                Button {
                    OnboardingHaptics.success()
                    let count = store.cardsFromMockExam(courseId: detail.courseId, mistakes: mistakes)
                    convertedMistakes = true
                    toast = "\(count) eksik soru karta çevrildi ve tekrar destene eklendi."
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: convertedMistakes ? "checkmark.circle.fill" : "rectangle.stack.badge.plus")
                        Text(convertedMistakes ? "Eksikler karta çevrildi" : "Eksikleri karta çevir (\(mistakes.count) soru)")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(convertedMistakes)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    // MARK: - Questions Breakdown

    private func questionsSection(_ detail: ExamResultDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle("Cevapların (\(detail.questions.count) soru)")

            ForEach(Array(detail.questions.enumerated()), id: \.element.id) { idx, q in
                let value = idx < detail.scores.count ? detail.scores[idx] : 0
                let good = value >= 0.7
                let answer = idx < detail.answers.count ? detail.answers[idx] : .none
                let fb = idx < detail.feedback.count ? detail.feedback[idx] : ""
                let matched = matchedNote(for: q)

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Soru \(idx + 1)\(q.type == .blank ? " · Boşluk doldurma" : q.type == .open ? " · Klasik" : "")")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text2)
                        Spacer()
                        Text(q.type == .open ? "\(Int((value * 100).rounded()))/100" : (good ? "Doğru" : "Yanlış"))
                            .font(.caption2.weight(.heavy))
                            .foregroundStyle(good ? Theme.success : (value > 0 ? Theme.onHi : Theme.danger))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(
                                good ? Theme.success.opacity(0.14) : (value > 0 ? Theme.hi : Theme.dangerSoft),
                                in: Capsule()
                            )
                    }

                    Text(q.prompt)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)

                    if q.type != .open {
                        if !good {
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(Theme.danger)
                                Text(choiceText(answer: answer, options: q.options))
                                    .foregroundStyle(Theme.danger)
                            }
                            .font(.subheadline)
                        }
                        if q.answerIndex >= 0 && q.answerIndex < q.options.count {
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Theme.success)
                                Text(q.options[q.answerIndex])
                                    .foregroundStyle(Theme.success)
                            }
                            .font(.subheadline.weight(.medium))
                        }
                        if !q.explanation.isEmpty {
                            Text(q.explanation)
                                .font(.caption)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Senin cevabın")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Theme.text3)
                            Text(openText(answer))
                                .font(.subheadline)
                                .foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.bg, in: RoundedRectangle(cornerRadius: 10))

                        if !fb.isEmpty {
                            Text(fb)
                                .font(.caption)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if !q.modelAnswer.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Örnek cevap")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Theme.success)
                                Text(q.modelAnswer)
                                    .font(.caption)
                                    .foregroundStyle(Theme.text)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.success.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                        }
                    }

                    if let quote = q.source, !quote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("“\(quote)”")
                            .font(.caption)
                            .italic()
                            .foregroundStyle(Theme.text3)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    if let note = matched {
                        NavigationLink(value: note) {
                            HStack(spacing: 6) {
                                Image(systemName: "doc.text.fill")
                                    .font(.caption)
                                Text("İlgili not: \(note.title)")
                                    .font(.caption.weight(.bold))
                                    .lineLimit(1)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption2.weight(.bold))
                            }
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 8)
                            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(14)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            }
        }
    }

    // MARK: - Helpers

    private func load() async {
        loading = true
        error = nil
        do {
            detail = try await store.fetchExamDetail(id: summary.id)
        } catch {
            self.error = "Sınav detayları yüklenemedi. İnternet bağlantını kontrol edip tekrar dene."
        }
        loading = false
    }

    private func choiceText(answer: MockExamAnswer, options: [String]) -> String {
        if case let .choice(i) = answer, i >= 0, i < options.count {
            return options[i]
        }
        return "Boş bıraktın"
    }

    private func openText(_ answer: MockExamAnswer) -> String {
        if case let .text(s) = answer {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? "—" : t
        }
        return "—"
    }

    private func matchedNote(for q: ExamResultDetail.StoredQuestion) -> NoteItem? {
        // 1. Direct noteId match
        if let rawId = q.noteId, let uuid = UUID(uuidString: rawId),
           let direct = courseNotes.first(where: { $0.id == uuid }) {
            return direct
        }
        // 2. Direct noteTitle match
        if let title = q.noteTitle?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
           let byTitle = courseNotes.first(where: { $0.title.localizedCaseInsensitiveCompare(title) == .orderedSame }) {
            return byTitle
        }
        // 3. Keyword overlap against course notes' titles, keyTerms, and overviews
        let haystack = "\(q.prompt) \(q.source ?? "")".lowercased(with: Locale(identifier: "tr_TR"))
        let tokens = haystack
            .components(separatedBy: CharacterSet.letters.union(.decimalDigits).inverted)
            .filter { $0.count >= 4 }
        guard !tokens.isEmpty else { return nil }

        var best: (note: NoteItem, hits: Int)?
        for note in courseNotes {
            let noteText = ([note.title, note.overview ?? ""] + (note.keyTerms?.map(\.term) ?? []))
                .joined(separator: " ")
                .lowercased(with: Locale(identifier: "tr_TR"))
            let hits = tokens.reduce(0) { $0 + (noteText.contains($1) ? 1 : 0) }
            if hits > 0, hits > (best?.hits ?? 0) {
                best = (note, hits)
            }
        }
        return best?.note
    }

    private func mistakeItems(_ detail: ExamResultDetail) -> [(noteId: UUID?, front: String, back: String, source: String?)] {
        var list: [(noteId: UUID?, front: String, back: String, source: String?)] = []
        for (idx, q) in detail.questions.enumerated() {
            let score = idx < detail.scores.count ? detail.scores[idx] : 0
            guard score < 0.7 else { continue }
            let back: String
            if q.type == .open {
                back = q.modelAnswer.isEmpty ? (idx < detail.feedback.count ? detail.feedback[idx] : "Örnek cevap") : q.modelAnswer
            } else {
                let ans = (q.answerIndex >= 0 && q.answerIndex < q.options.count) ? q.options[q.answerIndex] : ""
                back = q.explanation.isEmpty ? ans : "\(ans) — \(q.explanation)"
            }
            guard !back.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let nid = q.noteId.flatMap(UUID.init(uuidString:)) ?? matchedNote(for: q)?.id
            list.append((noteId: nid, front: q.prompt, back: back, source: q.source))
        }
        return list
    }

    private func metaLine(_ detail: ExamResultDetail) -> String {
        let fmt: String = switch detail.format {
        case "classic": "Klasik"
        case "mixed": "Karışık"
        default: "Test"
        }
        let diff: String? = switch detail.difficulty {
        case "easy": "Kolay"
        case "medium": "Orta"
        case "hard": "Zor"
        default: nil
        }
        let src = detail.source == "ai" ? "Yapay zekâ soruları" : "Hazır sorular"
        let dur: String = detail.durationSeconds.map { "\(max(1, Int((Double($0) / 60.0).rounded()))) dk sürdü" } ?? "süresiz"
        return [diff.map { "\(fmt) · \($0)" } ?? fmt, src, dur].joined(separator: " · ")
    }

    private func formattedDate(_ iso: String) -> String {
        guard let date = Dates.parse(iso) else { return "" }
        return date.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.abbreviated).hour().minute())
    }
}
