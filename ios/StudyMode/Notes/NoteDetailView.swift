import SwiftUI

/// A note's study flow: Özet (Kavramlar → Ana noktalar → Tam özet) → Test → Kartlar.
struct NoteDetailView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    let note: NoteItem
    /// Where to open (a link on Bugün); nil opens at the saved reading place.
    var start: NoteStart? = nil

    enum Step: Hashable { case summary, test, cards, explain }
    enum Section: String, Codable, Hashable { case terms, points, full }

    @State private var summary: NoteSummary?
    @State private var loadError: String?
    @State private var loaded = false
    @State private var section: Section = .terms
    @State private var step: Step = .summary

    @State private var point = 0
    @State private var fullIndex = 0
    @State private var restoreFull: Int?
    @State private var editing = false
    @State private var showSource = false
    @State private var askDelete = false
    @State private var askRegenerate = false
    @State private var regenerating: (Int, Int)?
    @State private var actionError: String?
    @Environment(\.dismiss) private var dismissNote
    @Environment(AssistantPlace.self) private var place

    private func bookmark() {
        guard loaded, summary != nil, step == .summary, loadError == nil else { return }
        ReadingPlace(noteID: note.id, section: section,
                     index: section == .points ? point : (section == .full ? fullIndex : 0))
            .save(for: auth.session?.user.id)
    }

    private var course: Course? { store.courses.first { $0.id == note.courseId } }
    private var doneSteps: [String] { store.noteSteps(note) }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollViewReader { reader in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header
                            .staggeredAppear(0)
                        content
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 40)
                }
                .coordinateSpace(name: "note-scroll")
                .onPreferenceChange(SectionOffsets.self) { offsets in
                    guard section == .full, restoreFull == nil, !offsets.isEmpty else { return }
                    let past = offsets.filter { $0.value <= 90 }.max { $0.value < $1.value }
                    fullIndex = past?.key ?? 0
                }
                .task(id: restoreFull) {
                    guard let index = restoreFull else { return }
                    await Task.yield()
                    reader.scrollTo("full-\(index)", anchor: .top)
                    restoreFull = nil
                }
            }
        }
        .onChange(of: point) { bookmark() }
        .onChange(of: section) { bookmark() }
        .onChange(of: fullIndex) { bookmark() }
        .onChange(of: step) { bookmark() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { FosforToolbarButton() }
            ToolbarItem(placement: .topBarTrailing) { noteMenu }
        }
        .sheet(isPresented: $editing, onDismiss: { Task { await load() } }) { NoteEditSheet(note: currentNote).environment(store) }
        .sheet(isPresented: $showSource) { SourceTextSheet(note: currentNote).environment(store).environment(place) }
        .confirmationDialog("“\(currentNote.title)” notu ve kartları silinsin mi?", isPresented: $askDelete, titleVisibility: .visible) {
            Button("Notu sil", role: .destructive) { Task { await remove() } }
        } message: {
            Text("Bu işlem geri alınamaz. Site ve uygulama aynı hesabı kullandığı için not ikisinden de silinir.")
        }
        .confirmationDialog("Çalışma seti yeniden hazırlansın mı?", isPresented: $askRegenerate, titleVisibility: .visible) {
            Button("Yeniden hazırla") { regenerate() }
        } message: {
            Text("Özet, sorular ve açık uçlu sorular notun güncel metninden yeniden yazılır. Çalıştığın kartların ilerlemesi korunur.")
        }
        .overlay {
            if let regenerating {
                ZStack {
                    Color.black.opacity(0.25).ignoresSafeArea()
                    VStack(spacing: 10) {
                        ProgressView()
                        Text(regenerating.1 > 1 ? "Yeniden hazırlanıyor · \(regenerating.0)/\(regenerating.1)" : "Yeniden hazırlanıyor…")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                    }
                    .padding(22)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                }
            }
        }
        .alert("Olmadı", isPresented: Binding(get: { actionError != nil }, set: { if !$0 { actionError = nil } })) {
            Button("Tamam") {}
        } message: { Text(actionError ?? "") }
        .task { await load() }
        .onAppear { place.enter("note-\(note.id)", course: note.courseId, note: note.id) }
        .onDisappear { place.leave("note-\(note.id)") }
    }

    /// The note as the store knows it now (the title may have been edited).
    private var currentNote: NoteItem { store.notes.first { $0.id == note.id } ?? note }

    private var noteMenu: some View {
        Menu {
            Button { place.show(course: note.courseId, note: note.id) } label: { Label("Fosfor'a sor", systemImage: "bubble.left.and.text.bubble.right") }
            Button { showSource = true } label: { Label("Kaynak metin", systemImage: "doc.text") }
            Button { editing = true } label: { Label("Notu düzenle", systemImage: "pencil") }
            if currentNote.isPrepared {
                Button { askRegenerate = true } label: { Label("Yeniden hazırla", systemImage: "arrow.clockwise") }
            }
            if let summary {
                ShareLink(item: summary.markdown(title: currentNote.title)) { Label("Özeti paylaş", systemImage: "square.and.arrow.up") }
            }
            Divider()
            Button(role: .destructive) { askDelete = true } label: { Label("Notu sil", systemImage: "trash") }
        } label: {
            Image(systemName: "ellipsis.circle")
        }
        .accessibilityLabel("Not menüsü")
        .disabled(regenerating != nil)
    }

    private func remove() async {
        do {
            try await store.deleteNote(currentNote)
            OnboardingHaptics.success()
            dismissNote()
        } catch {
            actionError = "Not silinemedi. Bağlantını kontrol edip tekrar dene."
        }
    }

    private func regenerate() {
        OnboardingHaptics.medium()
        regenerating = (0, 1)
        UIApplication.shared.isIdleTimerDisabled = true
        Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false; regenerating = nil }
            do {
                let note = currentNote
                let content = try await store.noteContent(note.id)
                let set = try await StudySetMaker.make(title: note.title, text: content) { done, total in regenerating = (done, total) }
                try await store.applyStudySet(set, noteId: note.id, courseId: note.courseId)
                OnboardingHaptics.success()
                await load()
            } catch {
                actionError = (error as? LocalizedError)?.errorDescription ?? "Çalışma seti yeniden hazırlanamadı."
            }
        }
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
            Text(currentNote.title)
                .font(Theme.display(.title))
                .foregroundStyle(Theme.text)
            if let tags = summary?.tags, !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.text2)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 4)
                                .background(Theme.surface, in: Capsule())
                                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
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
            StudyLoadingStage(message: "Notun özeti ve soruları açılıyor…", cardCount: 2)
        } else if let loadError {
            VStack(spacing: 12) {
                Message(text: loadError, kind: .error)
                Button("Tekrar dene") { Task { await load() } }.buttonStyle(SecondaryButtonStyle())
            }
        } else if let summary, !summary.overview.isEmpty || !summary.points.isEmpty {
            if summary.sourceChanged {
                Message(text: "Kaynak metin değişti. Özet, kartlar ve sorular önceki metne ait; güncellemek için sağ üstteki menüden Yeniden hazırla’yı seç.", kind: .warning)
            }
            HStack(spacing: 8) {
                NavigationLink {
                    NoteVisualsView(note: currentNote, summary: summary)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.prem1)
                        Text("Görsel")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)

                NavigationLink {
                    NotePodcastView(note: currentNote, summary: summary)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "waveform.circle.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.prem1)
                        Text("Sesli not")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)

                NavigationLink {
                    NoteCodingView(note: currentNote, summary: summary)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "key.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.accent)
                        Text("Kodla")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(Theme.hiSoft.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.cardLine.opacity(0.6), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
            FosforSegmentedBar(
                segments: [
                    .init(
                        value: Step.summary,
                        title: "Özet",
                        icon: "text.alignleft",
                        isDone: doneSteps.contains("tanis") && doneSteps.contains("anla")
                    ),
                    .init(
                        value: Step.test,
                        title: "Test",
                        icon: "checklist",
                        isDone: doneSteps.contains("sina")
                    ),
                    .init(
                        value: Step.cards,
                        title: "Kartlar",
                        icon: "rectangle.stack",
                        isDone: doneSteps.contains("pekistir")
                    ),
                    .init(
                        value: Step.explain,
                        title: "Anlat",
                        icon: "pencil.line",
                        isDone: doneSteps.contains("anlat")
                    )
                ],
                selection: $step
            )

            Group {
                switch step {
                case .summary:
                    VStack(alignment: .leading, spacing: 18) {
                        FosforSegmentedBar(
                            segments: summarySegments(hasDetailed: summary.detailed != nil),
                            selection: $section
                        )

                        switch section {
                        case .terms:
                            TermsSection(note: note, summary: summary) {
                                OnboardingHaptics.medium()
                                store.markStepDone(note, step: "tanis")
                                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                                    section = .points
                                }
                            }
                            .transition(.opacity.combined(with: .offset(y: 8)))
                        case .points:
                            PointsSection(note: note, points: summary.points, index: $point) {
                                OnboardingHaptics.medium()
                                store.markStepDone(note, step: "anla")
                                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                                    step = .test
                                }
                            }
                            .transition(.opacity.combined(with: .offset(y: 8)))
                        case .full:
                            if let detailed = summary.detailed {
                                VStack(alignment: .leading, spacing: 18) {
                                    FullSummarySection(note: note, detailed: detailed)
                                    if summary.sourceChanged {
                                        Message(text: "Not bu özetten sonra değişti. Güncel hâli için ayrıntılı özeti yeniden yaz.", kind: .warning)
                                    }
                                    DetailedSummaryMaker(note: note, rewrite: true) { await load() }
                                }
                                .transition(.opacity.combined(with: .offset(y: 8)))
                            } else {
                                DetailedSummaryMaker(note: note) { await load() }
                                    .transition(.opacity.combined(with: .offset(y: 8)))
                            }
                        }
                    }
                case .test:
                    QuizSection(note: note) {
                        OnboardingHaptics.medium()
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                            step = .cards
                        }
                    }
                    .transition(.opacity.combined(with: .offset(y: 8)))
                case .cards:
                    NoteCardsSection(note: note)
                        .transition(.opacity.combined(with: .offset(y: 8)))
                case .explain:
                    ExplainSection(note: note)
                        .transition(.opacity.combined(with: .offset(y: 8)))
                }
            }
            .animation(.spring(response: 0.40, dampingFraction: 0.84), value: step)
            .animation(.spring(response: 0.38, dampingFraction: 0.84), value: section)
        } else {
            NotPrepared(note: note) { await load() }
        }
    }

    private func summarySegments(hasDetailed: Bool) -> [FosforSegmentedBar<Section>.Segment] {
        var list: [FosforSegmentedBar<Section>.Segment] = [
            .init(value: .terms, title: "Kavramlar", isDone: doneSteps.contains("tanis")),
            .init(value: .points, title: "Ana noktalar", isDone: doneSteps.contains("anla"))
        ]
        list.append(.init(value: .full, title: "Tam özet", isDone: hasDetailed))
        return list
    }

    private func load() async {
        loadError = nil
        do {
            summary = try await store.summary(for: note)
            if !loaded, let start {
                switch start {
                case .summary: break
                case .explain: step = .explain
                case .terms: section = .terms
                case .points: section = .points
                case .test: step = .test
                case .cards: step = .cards
                }
            } else if !loaded, let place = ReadingPlace.saved(note: note.id, user: auth.session?.user.id) {
                section = place.section
                point = max(0, min(place.index, (summary?.points.count ?? 0) - 1))
                if section == .full, let count = summary?.detailed?.sections.count, count > 0 {
                    fullIndex = max(0, min(place.index, count - 1))
                    restoreFull = fullIndex
                }
            }
        } catch is CancellationError {
            return
        } catch {
            loadError = "Not yüklenemedi. Bağlantını kontrol edip tekrar dene."
        }
        loaded = true
        bookmark()
    }
}

// MARK: - Kavramlar

private struct TermsSection: View {
    @Environment(AssistantPlace.self) private var place: AssistantPlace?
    let note: NoteItem
    let summary: NoteSummary
    let next: () -> Void

    @State private var localMarked: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !summary.overview.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Genel bakış", systemImage: "eye.fill")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    SelectableNoteText(text: summary.overview) { picked in
                        place?.ask(FosforAsk(quote: picked, source: "Genel bakış"), course: note.courseId, note: note.id)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()
                .staggeredAppear(0)
            }

            if !summary.keyTerms.isEmpty {
                HStack {
                    Text("\(summary.keyTerms.count) kavram")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    Text("Bildiğine dokun")
                        .font(.caption)
                        .foregroundStyle(Theme.text3)
                }
                .padding(.top, 4)

                LazyVStack(spacing: 10) {
                    ForEach(Array(summary.keyTerms.enumerated()), id: \.element) { idx, term in
                        let isKnown = summary.checkedTerms.contains(term.term) || localMarked.contains(term.term)
                        TermCard(note: note, term: term, known: isKnown) {
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.34, dampingFraction: 0.76)) {
                                if localMarked.contains(term.term) {
                                    localMarked.remove(term.term)
                                } else {
                                    localMarked.insert(term.term)
                                }
                            }
                        }
                        .staggeredAppear(idx + 1)
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

/// A key term. Tap marks it known; "Anlamadım" (or a long press) sends it to Fosfor.
private struct TermCard: View {
    let note: NoteItem
    let term: NoteSummary.KeyTerm
    let known: Bool
    let onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                MathText(term.term)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Spacer(minLength: 8)
                if known {
                    Label("Biliyorum", systemImage: "checkmark")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.onHi)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.hi, in: Capsule())
                        .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                        .transition(.scale(scale: 0.8).combined(with: .opacity))
                } else {
                    Image(systemName: "circle")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text3.opacity(0.6))
                }
            }
            MathText(term.definition)
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            if !known {
                HStack {
                    Spacer()
                    ConceptExplainer(note: note, topic: "\(term.term): \(term.definition)", compact: true, source: "Kavram")
                }
                .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(known ? Theme.hiSoft.opacity(0.55) : Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(known ? Theme.cardLine : Theme.border, lineWidth: known ? 1.5 : 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .onTapGesture(perform: onTap)
        .askFosfor("\(term.term): \(term.definition)", source: "Kavram", note: note)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(known ? "Bilmiyorum olarak işaretle" : "Biliyorum olarak işaretle")
    }
}

// MARK: - Ana noktalar

/// One point at a time, like the site's point stepper: swipe or use the buttons.
private struct PointsSection: View {
    let note: NoteItem
    let points: [String]
    @Binding var index: Int
    let toCards: () -> Void

    var body: some View {
        if points.isEmpty {
            Text("Bu notta ana nokta yok.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text("Ana nokta \(index + 1) / \(points.count)")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(Theme.text2)
                            .contentTransition(.numericText(value: Double(index + 1)))
                        Spacer()
                        Text("Kaydırabilirsin")
                            .font(.caption)
                            .foregroundStyle(Theme.text3)
                    }
                    FosforProgressBar(value: Double(index + 1), total: Double(points.count), height: 9)
                }

                TabView(selection: $index) {
                    ForEach(Array(points.enumerated()), id: \.offset) { i, point in
                        PointCard(note: note, number: i + 1, total: points.count, text: point)
                            .padding(.horizontal, 2)
                            .padding(.bottom, 8)
                            .tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(height: 270)
                .onChange(of: index) { _, _ in OnboardingHaptics.selection() }

                HStack(spacing: 12) {
                    Button {
                        OnboardingHaptics.light()
                        withAnimation(.spring(response: 0.38, dampingFraction: 0.80)) {
                            index = max(0, index - 1)
                        }
                    } label: {
                        Image(systemName: "arrow.left")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(width: 72)
                    .disabled(index == 0)
                    .accessibilityLabel("Önceki madde")

                    if index < points.count - 1 {
                        Button {
                            OnboardingHaptics.light()
                            withAnimation(.spring(response: 0.38, dampingFraction: 0.80)) {
                                index += 1
                            }
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
    let note: NoteItem
    let number: Int
    let total: Int
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("\(number)")
                    .font(Theme.display(.title3))
                    .foregroundStyle(Theme.onHi)
                    .frame(width: 40, height: 40)
                    .background(Theme.hi, in: Circle())
                    .overlay(Circle().stroke(Theme.cardLine, lineWidth: 1.5))
                Spacer()
                ConceptExplainer(note: note, topic: text, source: "Ana nokta \(number)")
            }
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
        .contentShape(RoundedRectangle(cornerRadius: 20))
        .askFosfor(text, source: "Ana nokta \(number)", note: note)
    }
}

// MARK: - Tam özet

private struct SectionOffsets: PreferenceKey {
    static var defaultValue: [Int: CGFloat] { [:] }
    static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

private struct FullSummarySection: View {
    @Environment(AssistantPlace.self) private var place: AssistantPlace?
    let note: NoteItem
    let detailed: NoteSummary.Detailed

    private func ask(_ text: String, source: String) {
        place?.ask(FosforAsk(quote: text, source: source), course: note.courseId, note: note.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if !detailed.intro.isEmpty {
                SelectableNoteText(text: detailed.intro) { ask($0, source: "Tam özet") }
            }

            ForEach(Array(detailed.sections.enumerated()), id: \.offset) { i, section in
                let source = "Tam özet · \(section.heading)"
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(i + 1)")
                            .font(.footnote.weight(.heavy))
                            .foregroundStyle(Theme.onHi)
                            .frame(width: 26, height: 26)
                            .background(Theme.hi, in: RoundedRectangle(cornerRadius: 7))
                            .overlay(RoundedRectangle(cornerRadius: 7).stroke(Theme.cardLine, lineWidth: 1))
                        MathText(section.heading)
                            .font(Theme.display(.title3, weight: .bold))
                            .foregroundStyle(Theme.text)
                    }
                    ForEach(section.paragraphs, id: \.self) { paragraph in
                        SelectableNoteText(text: paragraph) { ask($0, source: source) }
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
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                                .askFosfor(bullet, source: source, note: note)
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
                        .contentShape(RoundedRectangle(cornerRadius: 14))
                        .askFosfor(section.example, source: "\(source) · örnek", note: note)
                    }
                    HStack {
                        Spacer()
                        ConceptExplainer(
                            note: note,
                            topic: String(([section.heading] + section.paragraphs).joined(separator: "\n").prefix(1_200)),
                            compact: true,
                            source: source
                        )
                    }
                }
                .id("full-\(i)")
                .background(GeometryReader { geo in
                    Color.clear.preference(key: SectionOffsets.self, value: [i: geo.frame(in: .named("note-scroll")).minY])
                })
                .staggeredAppear(i)
            }

            if !detailed.takeaways.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Sınavda dikkat", systemImage: "exclamationmark.triangle.fill")
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
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Bu not henüz hazırlanmadı")
                        .font(Theme.display(.title3))
                        .foregroundStyle(Theme.text)
                    Text("Özet, kartlar ve test yapay zekâyla hazırlanır. Uzun notlarda birkaç dakika sürebilir.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                FosforMascotView(size: 50, mood: progress == nil ? .curious : .marking)
            }

            if let progress {
                VStack(alignment: .leading, spacing: 8) {
                    Text(progress.total > 1 ? "Hazırlanıyor · bölüm \(progress.done)/\(progress.total)" : "Fosfor önemli yerleri işaretliyor…")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                    FosforProgressBar(value: Double(max(1, progress.done)), total: Double(max(progress.total, 1)), height: 10)
                }
                .padding(12)
                .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
            }
            if let error { Message(text: error, kind: .error) }
            Button { prepare() } label: {
                HStack(spacing: 6) {
                    Text(error == nil ? "Şimdi hazırla" : "Tekrar dene")
                    Image(systemName: "sparkles")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(progress != nil)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    private func prepare() {
        OnboardingHaptics.medium()
        error = nil
        progress = (0, 1)
        UIApplication.shared.isIdleTimerDisabled = true
        Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false; progress = nil }
            do {
                let content = try await store.noteContent(note.id)
                let set = try await StudySetMaker.make(title: note.title, text: content) { done, total in progress = (done, total) }
                try await store.applyStudySet(set, noteId: note.id, courseId: note.courseId)
                OnboardingHaptics.success()
                await onReady()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}
