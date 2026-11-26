import SwiftUI

// "Bu konuyu anlamadım" now opens Fosfor with the passage: see Assistant/AskFosfor.swift.

// MARK: - Tam özet

/// "Ayrıntılı özet hazırla": shown in Tam özet until the note has a detailed summary.
struct DetailedSummaryMaker: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    var rewrite = false
    let onDone: () async -> Void

    @State private var progress: (Int, Int)?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !rewrite {
                Label("Konuyu baştan sona anlatan ayrıntılı özet", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Text("Yapay zekâ notunu bölüm bölüm açıklasın: ezberlenecekler, nottaki örnekler ve sınavda dikkat edilecekler. Bir kez hazırlanır, notunla saklanır.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let error { Message(text: error, kind: .error) }
            Button {
                Task { await write() }
            } label: {
                HStack(spacing: 6) {
                    if progress != nil { ProgressView() } else { Image(systemName: rewrite ? "arrow.clockwise" : "sparkles") }
                    Text(progress != nil ? "Yazılıyor…" : rewrite ? "Ayrıntılı özeti yeniden yaz" : "Ayrıntılı özet hazırla")
                }
            }
            .buttonStyle(rewrite ? AnyButtonStyle(SecondaryButtonStyle()) : AnyButtonStyle(PrimaryButtonStyle()))
            .disabled(progress != nil)
            if let progress {
                Text(progress.1 > 1 ? "Uzun not \(progress.1) bölümde yazılıyor · \(progress.0)/\(progress.1)" : "Not okunuyor ve anlatılıyor; uzun notlarda bir dakika sürebilir.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .modifier(ConditionalFocusCard(enabled: !rewrite))
    }

    private func write() async {
        OnboardingHaptics.medium()
        error = nil
        progress = (0, 1)
        UIApplication.shared.isIdleTimerDisabled = true
        defer { UIApplication.shared.isIdleTimerDisabled = false; progress = nil }
        do {
            let content = try await store.noteContent(note.id)
            let detailed = try await NoteAI.detailedSummary(title: note.title, content: content) { done, total in progress = (done, total) }
            try await store.setSummaryField(note, key: "detailed", value: detailed)
            store.recordActivity()
            OnboardingHaptics.success()
            await onDone()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Ayrıntılı özet hazırlanamadı."
        }
    }
}

private struct ConditionalFocusCard: ViewModifier {
    let enabled: Bool
    func body(content: Content) -> some View {
        if enabled { content.focusCard() } else { content }
    }
}

struct AnyButtonStyle: ButtonStyle {
    private let make: (Configuration) -> AnyView
    init<S: ButtonStyle>(_ style: S) { make = { AnyView(style.makeBody(configuration: $0)) } }
    func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

// MARK: - Notu düzenle

/// The site's NoteEditor: title, course and the note's text. A changed text keeps the study set but
/// marks it as out of date until it is prepared again.
struct NoteEditSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let note: NoteItem

    @State private var title = ""
    @State private var content = ""
    @State private var original = ""
    @State private var courseId: UUID?
    @State private var loading = true
    @State private var saving = false
    @State private var error: String?

    private var valid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && content.filter { !$0.isWhitespace }.count >= 120
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Not başlığı") {
                    TextField("Başlık", text: $title)
                        .onChange(of: title) { _, t in if t.count > 200 { title = String(t.prefix(200)) } }
                }
                Section("Ders") {
                    Picker("Ders", selection: $courseId) {
                        ForEach(store.courses) { course in
                            Text(course.name).tag(Optional(course.id))
                        }
                    }
                }
                Section {
                    if loading {
                        ProgressView()
                    } else {
                        TextField("Not içeriği", text: $content, axis: .vertical)
                            .lineLimit(8...30)
                    }
                } header: {
                    Text("Not içeriği")
                } footer: {
                    Text("Metin değişirse mevcut çalışma seti korunur ve güncel olmadığı belirtilir. Yeni içeriği kullanmak için “Yeniden hazırla”yı seç.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(Theme.danger) }
                }
            }
            .navigationTitle("Notu düzenle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Vazgeç") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Kaydediliyor…" : "Kaydet") { Task { await save() } }
                        .disabled(!valid || saving || loading)
                }
            }
            .task {
                title = note.title
                courseId = note.courseId
                do {
                    content = try await store.noteContent(note.id)
                    original = content
                } catch {
                    self.error = "Notun metni yüklenemedi."
                }
                loading = false
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await store.editNote(
                note,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                content: text == original.trimmingCharacters(in: .whitespacesAndNewlines) ? nil : text,
                course: courseId ?? note.courseId
            )
            OnboardingHaptics.success()
            dismiss()
        } catch {
            self.error = "Değişiklikler kaydedilemedi. Bağlantını kontrol edip tekrar dene."
        }
    }
}

// MARK: - Kaynak metin

struct SourceTextSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(AssistantPlace.self) private var place: AssistantPlace?
    @Environment(\.dismiss) private var dismiss
    let note: NoteItem
    @State private var content: String?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            Group {
                if let content {
                    VStack(alignment: .leading, spacing: 0) {
                        let words = content.split(whereSeparator: \.isWhitespace).count
                        HStack(spacing: 6) {
                            Text("\(words.formatted(.number.locale(Dates.turkish))) kelime · \(max(1, Int((Double(words) / 200).rounded()))) dk")
                            Spacer()
                            Label("Seç → Fosfor'a sor", systemImage: "text.cursor")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        SelectableNoteText(text: content, scrolls: true) { picked in
                            // Fosfor opens from the tab view, so this sheet steps aside first.
                            dismiss()
                            Task { @MainActor in
                                try? await Task.sleep(for: .milliseconds(450))
                                place?.ask(FosforAsk(quote: picked, source: "Kaynak metin"), course: note.courseId, note: note.id)
                            }
                        }
                    }
                } else if failed {
                    Message(text: "Notun metni yüklenemedi.", kind: .error).padding(16)
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Theme.bg)
            .navigationTitle("Kaynak metin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Kapat") { dismiss() } } }
            .task {
                do { content = try await store.noteContent(note.id) } catch { failed = true }
            }
        }
    }
}

extension NoteSummary {
    /// The summary as Markdown, for "Özeti paylaş" (summaryMarkdown on the site).
    func markdown(title: String) -> String {
        var lines = ["# \(title)", ""]
        if !overview.isEmpty { lines += [overview, ""] }
        if !keyTerms.isEmpty {
            lines.append("## Kavramlar")
            lines += keyTerms.map { "- **\($0.term)**: \($0.definition)" }
            lines.append("")
        }
        if !points.isEmpty {
            lines.append("## Ana noktalar")
            lines += points.map { "- \($0)" }
            lines.append("")
        }
        if let detailed {
            lines.append("## Tam özet")
            if !detailed.intro.isEmpty { lines += [detailed.intro, ""] }
            for section in detailed.sections {
                lines.append("### \(section.heading)")
                lines += section.paragraphs + [""]
                lines += section.bullets.map { "- \($0)" }
                if !section.example.isEmpty { lines.append("Örnek: \(section.example)") }
                lines.append("")
            }
            if !detailed.takeaways.isEmpty {
                lines.append("### Sınavda dikkat")
                lines += detailed.takeaways.map { "- \($0)" }
            }
        }
        return lines.joined(separator: "\n")
    }
}
