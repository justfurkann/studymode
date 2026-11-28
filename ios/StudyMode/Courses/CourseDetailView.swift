import SwiftUI

/// One course: its exams and its notes, newest first.
struct CourseDetailView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.openNote) private var openNote
    let course: Course
    @State private var adding = false
    @State private var addingExam = false
    @State private var editingExam: CourseExam?
    @State private var showMockExam = false
    @State private var editingCourse = false
    @State private var sharing = false
    @State private var askDelete = false
    @State private var deleteError = false
    @Environment(\.dismiss) private var dismissCourse
    @Environment(AssistantPlace.self) private var place
    @Environment(PremiumStore.self) private var premium
    // Search (the site's CourseDetail): ordinary search and the tag filter for everyone; meaning
    // search with vectors only on Premium.
    @State private var query = ""
    @State private var tag = ""
    @State private var docs: [UUID: SearchNote] = [:]
    @State private var queryVector: QueryVector?
    @State private var searchError: String?
    private var index = SmartSearchIndex.shared

    private struct QueryVector { let q: String; let v: [Double] }

    /// The course as the store knows it now (name and color may have been edited).
    private var current: Course { store.courses.first { $0.id == course.id } ?? course }

    private var trimmedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// The course's notes with their text when it has been fetched, otherwise what the list knows.
    private func searchNotes(_ notes: [NoteItem]) -> [SearchNote] {
        notes.map { docs[$0.id] ?? SearchNote(item: $0) }
    }

    private func tags(_ notes: [NoteItem]) -> [String] {
        var seen = Set<String>()
        return notes.flatMap { $0.tags ?? [] }.filter { seen.insert($0).inserted }
    }

    /// The text is fetched when a search or tag is in use, or when the course already has vectors
    /// (to know which notes changed since).
    private func docsKey(_ notes: [NoteItem]) -> String {
        let active = !trimmedQuery.isEmpty || !tag.isEmpty || (premium.isPremium && index.hasVectors(course: course.id))
        guard active else { return "" }
        return notes.map { "\($0.id)\($0.updatedAt ?? "")" }.joined(separator: ",")
    }

    private func loadDocs() async {
        do {
            let rows = try await SmartSearchIndex.fetchNotes(course: course.id)
            docs = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        } catch {
            // No network: search runs on titles, overviews and tags until the text can be fetched.
        }
    }

    var body: some View {
        let notes = store.notes(in: course)
        let exams = store.examsFor(course)
        let showSearch = notes.count >= 3 || !tags(notes).isEmpty
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header(noteCount: notes.count)
                        .staggeredAppear(0)
                    examsSection(exams, hasNotes: !notes.isEmpty)
                        .staggeredAppear(1)
                    notesSection(notes)
                        .staggeredAppear(2)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
        // The big header already names the course; an inline title would repeat it.
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .searchable(if: showSearch, text: $query, prompt: "Başlık, içerik veya anlam")
        .task(id: docsKey(notes)) {
            guard !docsKey(notes).isEmpty else { return }
            await loadDocs()
        }
        .task(id: query) { await fetchQueryVector() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { FosforToolbarButton() }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    OnboardingHaptics.light()
                    adding = true
                } label: {
                    Label("Not ekle", systemImage: "plus")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { editingCourse = true } label: { Label("Dersi düzenle", systemImage: "pencil") }
                    Button { sharing = true } label: { Label("Dersi paylaş", systemImage: "person.2") }
                    Divider()
                    Button(role: .destructive) { askDelete = true } label: { Label("Dersi sil", systemImage: "trash") }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("Ders menüsü")
            }
        }
        .sheet(isPresented: $editingCourse) { CourseEditSheet(course: current).environment(store) }
        .sheet(isPresented: $sharing) { CourseShareSheet(course: current).environment(store) }
        .confirmationDialog("“\(current.name)” dersi silinsin mi?", isPresented: $askDelete, titleVisibility: .visible) {
            Button("Dersi sil", role: .destructive) {
                Task {
                    do {
                        try await store.deleteCourse(current)
                        dismissCourse()
                    } catch {
                        deleteError = true
                    }
                }
            }
        } message: {
            Text("Dersin bütün notları, kartları, test sonuçları ve sınavları da silinir. Bu işlem geri alınamaz; site ve uygulama aynı hesabı kullandığı için ikisinden de silinir.")
        }
        .onAppear { place.enter("course-\(course.id)", course: course.id, note: nil) }
        // Back on a main screen the floating Fosfor goes away (the one on the screen stays).
        .onDisappear { place.leave("course-\(course.id)") }
        .alert("Ders silinemedi", isPresented: $deleteError) { Button("Tamam") {} } message: { Text("Bağlantını kontrol edip tekrar dene.") }
        .sheet(isPresented: $adding) {
            AddNoteView(course: course, onDone: openNote).environment(store)
        }
        .sheet(isPresented: $addingExam) {
            CourseExamEditorSheet(course: course).environment(store)
        }
        .sheet(item: $editingExam) { exam in
            CourseExamEditorSheet(course: course, editing: exam).environment(store)
        }
        .fullScreenCover(isPresented: $showMockExam) {
            MockExamView(course: course, preselectedExam: store.nextExam(course)).environment(store)
        }
    }

    private func header(noteCount: Int) -> some View {
        let readiness = store.readiness(of: course)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Circle().fill(current.tint).frame(width: 14, height: 14)
                Text(current.name)
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
            }

            HStack {
                Text("\(noteCount) not · \(store.cardCount(course: course)) kart")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                Spacer()
                if let readiness {
                    Text("Hazırlık: %\(readiness)")
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.text)
                }
            }

            if let readiness {
                FosforProgressBar(value: Double(readiness), total: 100, height: 9)
            }
        }
        .padding(.top, 8)
    }

    private func examsSection(_ exams: [CourseExam], hasNotes: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                SectionTitle("Sınavlar")
                Spacer()
                Button {
                    OnboardingHaptics.light()
                    addingExam = true
                } label: {
                    Label("Sınav ekle", systemImage: "plus")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.surface, in: Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            if exams.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "calendar.badge.plus")
                        .foregroundStyle(Theme.text3)
                    Text("Vize ya da final tarihini ekle, tekrar sırasını ona göre ayarlayalım.")
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(exams.enumerated()), id: \.element.id) { index, exam in
                        if index > 0 { Divider().overlay(Theme.border) }
                        NavigationLink(value: exam) { ExamRow(exam: exam) }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button {
                                    editingExam = exam
                                } label: {
                                    Label("Sınavı düzenle", systemImage: "pencil")
                                }
                                Button(role: .destructive) {
                                    store.deleteCourseExam(exam)
                                } label: {
                                    Label("Sınavı sil", systemImage: "trash")
                                }
                            }
                    }
                }
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            }

            if hasNotes {
                Button {
                    OnboardingHaptics.medium()
                    showMockExam = true
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                        Text("Sınav provası oluştur")
                        Spacer()
                        if let last = store.lastMockExam(for: course) {
                            Text("Son: %\(last.percent)")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.text2)
                        }
                        Image(systemName: "arrow.right")
                            .font(.caption.weight(.bold))
                    }
                    .padding(.horizontal, 14)
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
    }

    /// Query vector after a short pause (site: 380 ms), at least 3 letters, only with vectors in the course.
    private func fetchQueryVector() async {
        searchError = nil
        let text = trimmedQuery
        guard SemanticSearch.jsLength(text) >= 3, premium.isPremium, index.hasVectors(course: course.id) else {
            queryVector = nil
            return
        }
        do {
            try await Task.sleep(for: .milliseconds(380))
            let v = try await index.queryVector(text)
            if trimmedQuery == text { queryVector = QueryVector(q: text, v: v) }
        } catch is CancellationError {
        } catch {
            queryVector = nil
            searchError = SmartSearchIndex.message(error)
        }
    }

    private func prepareSearch(_ notes: [NoteItem]) {
        searchError = nil
        Task {
            do {
                if notes.contains(where: { docs[$0.id] == nil }) {
                    let rows = try await SmartSearchIndex.fetchNotes(course: course.id)
                    docs = Dictionary(rows.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
                }
                try await index.prepare(searchNotes(notes))
                OnboardingHaptics.success()
                await fetchQueryVector()
            } catch {
                searchError = SmartSearchIndex.message(error)
            }
        }
    }

    @ViewBuilder
    private func searchTools(_ notes: [NoteItem]) -> some View {
        let tagList = tags(notes)
        let canPrepare = premium.isPremium && (notes.count >= 3 || !tagList.isEmpty)
        if !tagList.isEmpty || canPrepare {
            HStack(spacing: 8) {
                if !tagList.isEmpty {
                    Menu {
                        Picker("Etiket", selection: $tag) {
                            Text("Tüm etiketler").tag("")
                            ForEach(tagList, id: \.self) { Text($0).tag($0) }
                        }
                    } label: {
                        Label(tag.isEmpty ? "Tüm etiketler" : tag, systemImage: "tag")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(tag.isEmpty ? Theme.surface : Theme.hiSoft, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    }
                }
                if canPrepare {
                    prepareButton(notes)
                }
                Spacer(minLength: 0)
            }
        }
    }

    @ViewBuilder
    private func prepareButton(_ notes: [NoteItem]) -> some View {
        let all = searchNotes(notes)
        let known = notes.allSatisfy { docs[$0.id] != nil }
        let missing = known ? index.missing(all).count : all.count
        let ready = known && !all.isEmpty && missing == 0
        Button {
            OnboardingHaptics.light()
            prepareSearch(notes)
        } label: {
            HStack(spacing: 5) {
                if index.progress != nil {
                    ProgressView().controlSize(.mini).tint(.white)
                } else {
                    Image(systemName: "sparkles")
                }
                Text(index.progress.map { "Hazırlanıyor \($0.done)/\($0.total)" } ?? (ready ? "Akıllı arama hazır" : "Akıllı aramayı aç"))
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(LinearGradient(colors: [Theme.prem1, Theme.prem2], startPoint: .leading, endPoint: .trailing), in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(index.progress != nil || ready)
        .accessibilityHint("Notlarını anlamına göre aranabilir yapar")
        if known, !ready, index.progress == nil, index.hasVectors(course: course.id) {
            Text("\(all.count - missing)/\(all.count) not hazır")
                .font(.caption2)
                .foregroundStyle(Theme.text3)
        }
    }

    private func notesSection(_ notes: [NoteItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Notlar")
            searchTools(notes)
            if let searchError {
                Text(searchError)
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !notes.isEmpty, !trimmedQuery.isEmpty || !tag.isEmpty {
                searchResults(notes)
            } else if notes.isEmpty {
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bu derste henüz not yok")
                            .font(Theme.display(.headline))
                            .foregroundStyle(Theme.text)
                        Text("Sağ üstteki + ile yapıştır, fotoğraf çek ya da PDF ekle.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                    }
                    Spacer(minLength: 4)
                    FosforMascotView(size: 48, mood: .curious)
                }
                .padding(16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(Array(notes.enumerated()), id: \.element.id) { idx, note in
                        NavigationLink(value: note) {
                            NoteRow(note: note)
                        }
                        .buttonStyle(TactileCardButtonStyle())
                        .staggeredAppear(idx + 2)
                    }
                }
            }
        }
    }

    /// searchNotesSemantic: words first, then notes close in meaning, with the best sentence.
    @ViewBuilder
    private func searchResults(_ notes: [NoteItem]) -> some View {
        let all = searchNotes(notes)
        let vectors = premium.isPremium ? index.vectors(for: all) : [:]
        let qv = queryVector.flatMap { $0.q == trimmedQuery ? $0.v : nil }
        let matches = SemanticSearch.search(all, query: query, tag: tag, vectors: vectors, queryVector: qv)
        let byId = Dictionary(notes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        if matches.isEmpty {
            Text("Aramana uygun not bulunamadı.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .padding(.vertical, 6)
        } else {
            LazyVStack(spacing: 10) {
                ForEach(matches) { match in
                    if let item = byId[match.note.id] {
                        NavigationLink(value: item) {
                            NoteRow(
                                note: item,
                                snippet: trimmedQuery.isEmpty ? nil : match.snippet,
                                matchedTerm: match.matchedTerm,
                                semantic: !trimmedQuery.isEmpty && match.kind == .semantic
                            )
                        }
                        .buttonStyle(TactileCardButtonStyle())
                    }
                }
            }
        }
    }
}

extension View {
    /// `.searchable` only when there is something to search (the site shows its box from 3 notes or a tag).
    @ViewBuilder
    func searchable(if on: Bool, text: Binding<String>, prompt: String) -> some View {
        if on { searchable(text: text, prompt: Text(prompt)) } else { self }
    }
}

struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(Theme.display(.title3, weight: .bold))
            .foregroundStyle(Theme.text)
    }
}

private struct ExamRow: View {
    @Environment(StudyStore.self) private var store
    let exam: CourseExam

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(Exams.name(exam, store.audience))
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    if let weight = exam.weight {
                        Text("%\(Int(weight.rounded()))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.surface2, in: Capsule())
                    }
                }
                Text(Exams.dateText(exam))
                    .font(.footnote)
                    .foregroundStyle(Theme.text2)
            }
            Spacer(minLength: 8)
            trailing
        }
        .padding(14)
    }

    @ViewBuilder
    private var trailing: some View {
        if let countdown = Exams.countdown(exam, store.audience) {
            CountdownChip(
                text: countdown.days == 0 ? "Bugün" : countdown.days == 1 ? "Yarın" : "\(countdown.days) gün",
                tone: countdown.tone
            )
        } else if let grade = exam.grade {
            Text("Notun: \(grade.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish)))")
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(Theme.hi, in: Capsule())
                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
        } else {
            Text("Bitti")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text3)
        }
    }
}

private struct NoteRow: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    var snippet: String? = nil
    var matchedTerm: String? = nil
    var semantic = false

    var body: some View {
        let cards = store.cardCount(note: note)
        let stepsDone = min(5, store.noteSteps(note).count)

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                Text(note.title)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    StatusChip(note: note, stepsDone: stepsDone)

                    if note.isPrepared {
                        HStack(spacing: 3) {
                            ForEach(0..<5, id: \.self) { idx in
                                Capsule()
                                    .fill(idx < stepsDone ? Theme.hi : Theme.surface2)
                                    .overlay(
                                        Capsule()
                                            .stroke(idx < stepsDone ? Theme.cardLine : Theme.border, lineWidth: 0.8)
                                    )
                                    .frame(width: 9, height: 5)
                            }
                        }
                        .accessibilityHidden(true)
                    }

                    if cards > 0 {
                        Text("\(cards) kart")
                            .font(.caption)
                            .foregroundStyle(Theme.text2)
                    }
                    if let date = Dates.parse(note.createdAt) {
                        Text(Dates.short(date))
                            .font(.caption)
                            .foregroundStyle(Theme.text3)
                    }
                }

                if let snippet {
                    (Text(matchedTerm.map { "\($0): " } ?? "").bold() + Text(snippet))
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                }
                if semantic {
                    Label("Anlamsal eşleşme", systemImage: "sparkles")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.premText)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(Theme.premSoft, in: Capsule())
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.bold))
                .foregroundStyle(Theme.text3)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

private struct StatusChip: View {
    let note: NoteItem
    let stepsDone: Int

    var body: some View {
        if !note.isPrepared {
            Label("Hazırlanmadı", systemImage: "circle.dashed")
                .labelStyle(Chip(foreground: Theme.text2, background: Theme.surface2))
        } else if stepsDone >= 5 {
            Label("Bitti", systemImage: "checkmark.circle.fill")
                .labelStyle(Chip(foreground: Theme.onHi, background: Theme.hi))
        } else if stepsDone > 0 {
            Label("\(stepsDone)/5 adım", systemImage: "circle.lefthalf.filled")
                .labelStyle(Chip(foreground: Theme.text, background: Theme.hiSoft))
        } else {
            Label("Hazır", systemImage: "sparkles")
                .labelStyle(Chip(foreground: Theme.text, background: Theme.hiSoft))
        }
    }

    private struct Chip: LabelStyle {
        let foreground: Color
        let background: Color

        func makeBody(configuration: Configuration) -> some View {
            HStack(spacing: 4) {
                configuration.icon
                configuration.title
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(background, in: Capsule())
        }
    }
}
