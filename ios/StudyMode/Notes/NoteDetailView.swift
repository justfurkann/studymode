import SwiftUI

/// A note's summary, in the site's order: Kavramlar → Ana noktalar → (Tam özet, when it was written).
/// Test and Kartlar join this screen in the next steps. Read only: nothing here writes to the account.
struct NoteDetailView: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem

    enum Step: Hashable { case summary, test, cards }
    enum Section: Hashable { case terms, points, full }

    @State private var summary: NoteSummary?
    @State private var loadError: String?
    @State private var loaded = false
    @State private var section: Section = .terms
    @State private var step: Step = .summary

    private var course: Course? { store.courses.first { $0.id == note.courseId } }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    content
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 40)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let course {
                HStack(spacing: 6) {
                    Circle().fill(course.tint).frame(width: 9, height: 9)
                    Text(course.name)
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.text2)
            }
            Text(note.title)
                .font(Theme.display(.title))
                .foregroundStyle(Theme.text)
            if let tags = summary?.tags, !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Theme.text2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Theme.surface2, in: Capsule())
                        }
                    }
                }
            }
        }
        .padding(.top, 4)
    }

    @ViewBuilder
    private var content: some View {
        if !loaded {
            ProgressView().tint(Theme.text2).frame(maxWidth: .infinity).padding(.top, 40)
        } else if let loadError {
            VStack(spacing: 12) {
                Message(text: loadError, kind: .error)
                Button("Tekrar dene") { Task { await load() } }.buttonStyle(SecondaryButtonStyle())
            }
        } else if let summary, !summary.overview.isEmpty || !summary.points.isEmpty {
            Picker("Adım", selection: $step) {
                Text("Özet").tag(Step.summary)
                Text("Test").tag(Step.test)
                Text("Kartlar").tag(Step.cards)
            }
            .pickerStyle(.segmented)
            .controlSize(.large)

            switch step {
            case .summary:
                Picker("Bölüm", selection: $section) {
                    Text("Kavramlar").tag(Section.terms)
                    Text("Ana noktalar").tag(Section.points)
                    if summary.detailed != nil { Text("Tam özet").tag(Section.full) }
                }
                .pickerStyle(.segmented)
                .controlSize(.small)

                switch section {
                    case .terms: TermsSection(summary: summary) {
                    // Like the site's "Devam: Ana noktalar": the Tanış step is done.
                    store.markStepDone(note, step: "tanis")
                    withAnimation { section = .points }
                }
                case .points: PointsSection(points: summary.points) {
                    // Reaching the end of the main points completes Anla, as on the site.
                    store.markStepDone(note, step: "anla")
                    withAnimation { step = .test }
                }
                case .full: if let detailed = summary.detailed { FullSummarySection(detailed: detailed) }
                }
            case .test:
                QuizSection(note: note) { withAnimation { step = .cards } }
            case .cards:
                NoteCardsSection(note: note)
            }
        } else {
            NotPrepared(note: note) { await load() }
        }
    }

    private func load() async {
        loadError = nil
        do {
            summary = try await store.summary(for: note)
            if summary?.detailed == nil, section == .full { section = .terms }
        } catch is CancellationError {
            return
        } catch {
            loadError = "Not yüklenemedi. Bağlantını kontrol edip tekrar dene."
        }
        loaded = true
    }
}

// MARK: - Kavramlar

private struct TermsSection: View {
    let summary: NoteSummary
    let next: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !summary.overview.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Genel bakış", systemImage: "eye")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.text2)
                    MathText(summary.overview)
                        .font(.body)
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()
            }

            if !summary.keyTerms.isEmpty {
                Text("\(summary.keyTerms.count) kavram")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text2)
                    .padding(.top, 4)
                LazyVStack(spacing: 10) {
                    ForEach(summary.keyTerms, id: \.self) { term in
                        TermCard(term: term, known: summary.checkedTerms.contains(term.term))
                    }
                }
            }

            Button(action: next) {
                HStack(spacing: 6) {
                    Text("Devam: Ana noktalar")
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .padding(.top, 8)
        }
    }
}

private struct TermCard: View {
    let term: NoteSummary.KeyTerm
    let known: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                MathText(term.term)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Spacer(minLength: 8)
                if known {
                    Label("Biliyorum", systemImage: "checkmark")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.onHi)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Theme.hi, in: Capsule())
                }
            }
            MathText(term.definition)
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - Ana noktalar

/// One point at a time, like the site's point stepper: swipe or use the buttons.
private struct PointsSection: View {
    let points: [String]
    let toCards: () -> Void
    @State private var index = 0

    var body: some View {
        if points.isEmpty {
            Text("Bu notta ana nokta yok.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(index + 1) / \(points.count)")
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Theme.text2)
                    ProgressView(value: Double(index + 1), total: Double(points.count))
                        .tint(Theme.accent)
                }

                TabView(selection: $index) {
                    ForEach(Array(points.enumerated()), id: \.offset) { i, point in
                        PointCard(number: i + 1, text: point)
                            .padding(.horizontal, 2)
                            .padding(.bottom, 8)
                            .tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(height: 240)

                HStack(spacing: 12) {
                    Button {
                        withAnimation { index = max(0, index - 1) }
                    } label: {
                        Image(systemName: "arrow.left")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(width: 72)
                    .disabled(index == 0)
                    .accessibilityLabel("Önceki madde")

                    if index < points.count - 1 {
                        Button {
                            withAnimation { index += 1 }
                        } label: {
                            HStack(spacing: 6) { Text("Sonraki"); Image(systemName: "arrow.right") }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    } else {
                        Button(action: toCards) {
                            HStack(spacing: 6) { Text("Teste geç"); Image(systemName: "arrow.right") }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
            }
        }
    }
}

private struct PointCard: View {
    let number: Int
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("\(number)")
                .font(Theme.display(.title3))
                .foregroundStyle(Theme.onHi)
                .frame(width: 40, height: 40)
                .background(Theme.hi, in: Circle())
            ScrollView {
                MathText(text)
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Theme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .focusCard()
    }
}

// MARK: - Tam özet

private struct FullSummarySection: View {
    let detailed: NoteSummary.Detailed

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if !detailed.intro.isEmpty {
                MathText(detailed.intro)
                    .font(.body)
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(Array(detailed.sections.enumerated()), id: \.offset) { i, section in
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(i + 1)")
                            .font(.footnote.weight(.heavy))
                            .foregroundStyle(Theme.onHi)
                            .frame(width: 24, height: 24)
                            .background(Theme.hi, in: RoundedRectangle(cornerRadius: 6))
                        MathText(section.heading)
                            .font(Theme.display(.title3, weight: .bold))
                            .foregroundStyle(Theme.text)
                    }
                    ForEach(section.paragraphs, id: \.self) { paragraph in
                        MathText(paragraph)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if !section.bullets.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(section.bullets, id: \.self) { bullet in
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Circle().fill(Theme.accent).frame(width: 6, height: 6).offset(y: -2)
                                    MathText(bullet)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.text)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                    }
                    if !section.example.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Nottaki örnek")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.text2)
                            MathText(section.example)
                                .font(.subheadline)
                                .foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
            }

            if !detailed.takeaways.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Sınavda dikkat", systemImage: "exclamationmark.triangle")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    ForEach(detailed.takeaways, id: \.self) { item in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(Theme.text2)
                            MathText(item)
                                .font(.subheadline)
                                .foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()
            }
        }
    }
}

private struct NotPrepared: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    let onReady: () async -> Void
    @State private var progress: (done: Int, total: Int)?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Bu not henüz hazırlanmadı")
                .font(Theme.display(.title3))
                .foregroundStyle(Theme.text)
            Text("Özet, kartlar ve test yapay zekâyla hazırlanır. Uzun notlarda birkaç dakika sürebilir.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            if let progress {
                VStack(alignment: .leading, spacing: 6) {
                    Text(progress.total > 1 ? "Hazırlanıyor · bölüm \(progress.done)/\(progress.total)" : "Hazırlanıyor…")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                    ProgressView(value: Double(progress.done), total: Double(max(progress.total, 1))).tint(Theme.accent)
                }
            }
            if let error { Message(text: error, kind: .error) }
            Button { prepare() } label: {
                HStack(spacing: 6) { Text(error == nil ? "Şimdi hazırla" : "Tekrar dene"); Image(systemName: "sparkles") }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(progress != nil)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    private func prepare() {
        error = nil
        progress = (0, 1)
        UIApplication.shared.isIdleTimerDisabled = true
        Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false; progress = nil }
            do {
                let content = try await store.noteContent(note.id)
                let set = try await StudySetMaker.make(title: note.title, text: content) { done, total in progress = (done, total) }
                try await store.applyStudySet(set, noteId: note.id, courseId: note.courseId)
                await onReady()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
