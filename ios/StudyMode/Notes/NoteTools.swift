import SwiftUI

// MARK: - "Bu konuyu anlamadım"

/// The site's ConceptExplainer: under a key term or point, ask the AI to explain it more simply,
/// with an everyday example, or step by step. Only the passage of the note around the topic is sent.
struct ConceptExplainer: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    let topic: String
    var compact = false

    @State private var open = false
    @State private var mode: NoteAI.ExplainMode?
    @State private var busy = false
    @State private var reply: String?
    @State private var error: String?

    var body: some View {
        if !open {
            Button {
                OnboardingHaptics.light()
                withAnimation(.spring(response: 0.34, dampingFraction: 0.84)) { open = true }
            } label: {
                Label("Bu konuyu anlamadım", systemImage: "questionmark.circle")
                    .font((compact ? Font.caption : .subheadline).weight(.semibold))
                    .foregroundStyle(Theme.text2)
                    .padding(.vertical, compact ? 4 : 8)
                    .frame(minHeight: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Nasıl açıklamamı istersin?")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    Button("Kapat") {
                        withAnimation { open = false; reply = nil; error = nil; mode = nil }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text2)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(NoteAI.ExplainMode.allCases) { option in
                            Button {
                                Task { await ask(option) }
                            } label: {
                                HStack(spacing: 5) {
                                    if busy && mode == option { ProgressView().controlSize(.mini) }
                                    Text(option.label)
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(mode == option ? Theme.onHi : Theme.text)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
                                .background(mode == option ? Theme.hi : Theme.surface2, in: Capsule())
                                .overlay(Capsule().stroke(mode == option ? Theme.cardLine : Theme.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .disabled(busy)
                        }
                    }
                }
                if let error { Message(text: error, kind: .error) }
                if let reply {
                    MathText(reply)
                        .font(.subheadline)
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                        .transition(.opacity.combined(with: .offset(y: 6)))
                }
            }
            .padding(12)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
            .transition(.opacity.combined(with: .offset(y: 6)))
        }
    }

    private func ask(_ option: NoteAI.ExplainMode) async {
        mode = option
        busy = true
        error = nil
        defer { busy = false }
        do {
            let content = try await store.noteContent(note.id)
            let text = try await NoteAI.explain(title: note.title, topic: topic, content: content, mode: option)
            withAnimation { reply = text }
            store.recordActivity()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Açıklama hazırlanamadı. Bağlantını kontrol edip tekrar dene."
        }
    }
}

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
    @Environment(\.dismiss) private var dismiss
    let note: NoteItem
    @State private var content: String?
    @State private var failed = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let content {
                        let words = content.split(whereSeparator: \.isWhitespace).count
                        Text("\(words.formatted(.number.locale(Dates.turkish))) kelime · \(max(1, Int((Double(words) / 200).rounded()))) dk")
                            .font(.caption)
                            .foregroundStyle(Theme.text2)
                        Text(content)
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .textSelection(.enabled)
                            .lineSpacing(4)
                    } else if failed {
                        Message(text: "Notun metni yüklenemedi.", kind: .error)
                    } else {
                        ProgressView().frame(maxWidth: .infinity)
                    }
                }
                .padding(16)
            }
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
