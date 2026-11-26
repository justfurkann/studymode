import SwiftUI

/// Step 5, "Anlat" (the site's PracticeTab): write each open question's answer in your own words,
/// get it graded, compare with the model answer, then finish the note.
struct ExplainSection: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem

    @State private var items: [PracticeItem] = []
    @State private var loaded = false
    @State private var loadError: String?
    @State private var session: SessionBox?

    private var stepDone: Bool { store.noteSteps(note).contains("anlat") }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !loaded {
                StudyLoadingStage(message: "Açık uçlu sorular açılıyor…", cardCount: 1)
            } else if let loadError {
                Message(text: loadError, kind: .error)
                Button("Tekrar dene") { Task { await load() } }.buttonStyle(SecondaryButtonStyle())
            } else if items.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "pencil.line").foregroundStyle(Theme.text3)
                    Text("Bu notta açık uçlu soru yok.").font(.subheadline).foregroundStyle(Theme.text2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            } else {
                Text("Notuna bakmadan, konuyu bilmeyen birine anlatır gibi yaz. Anlatabiliyorsan öğrenmişsin demektir.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    PracticeCard(note: note, item: item, index: index) { updated, interacted in
                        if let i = items.firstIndex(where: { $0.id == updated.id }) { items[i] = updated }
                        if interacted, !stepDone { store.markStepDone(note, step: "anlat") }
                    }
                }
                finishPanel
            }
        }
        .task { await load() }
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: note.title, cards: box.cards, mode: .grades).environment(store)
        }
    }

    private var finishPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            if stepDone {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "checkmark.circle.fill").font(.title2).foregroundStyle(Theme.success)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Bu notu bitirdin!").font(.headline).foregroundStyle(Theme.text)
                        Text("Unutmamak için kartlar aralıklı tekrarla yine karşına gelecek.")
                            .font(.footnote).foregroundStyle(Theme.text2)
                    }
                }
                let due = store.cards(of: note).filter { $0.isDue() }
                if !due.isEmpty {
                    Button {
                        session = SessionBox(cards: due.sorted { $0.dueDate < $1.dueDate })
                    } label: {
                        Label("Kartları tekrar et", systemImage: "brain")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
            } else {
                Text("Konuyu kendi cümlelerinle anlatabildin mi?").font(.headline).foregroundStyle(Theme.text)
                let canFinish = Practice.canComplete(items)
                Button {
                    OnboardingHaptics.success()
                    store.markStepDone(note, step: "anlat")
                } label: {
                    Label("Bitir: Konuyu öğrendim", systemImage: "checkmark")
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!canFinish)
                .opacity(canFinish ? 1 : 0.5)
                if !canFinish {
                    Text("Bitirmek için en az bir soruya kendi cümlelerinle cevap yaz.")
                        .font(.caption).foregroundStyle(Theme.text2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    private func load() async {
        loadError = nil
        do {
            items = try await store.practice(for: note)
        } catch is CancellationError {
            return
        } catch {
            loadError = "Sorular yüklenemedi. Bağlantını kontrol edip tekrar dene."
        }
        loaded = true
    }
}

private struct PracticeCard: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    let item: PracticeItem
    let index: Int
    /// The updated item, and whether this counts as working on the step (graded or revealed with an answer).
    let onChange: (PracticeItem, Bool) -> Void

    @State private var draft = ""
    @State private var saved = ""
    @State private var busy = false
    @State private var error: String?
    @State private var revealed = false
    @State private var saveTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Soru \(index + 1)").font(.caption.weight(.semibold)).foregroundStyle(Theme.text2)
            MathText(item.question)
                .font(.headline)
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)

            TextField("Önce notuna bakmadan kendi cümlelerinle cevapla…", text: $draft, axis: .vertical)
                .lineLimit(5...14)
                .focused($focused)
                .disabled(busy)
                .padding(12)
                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(focused ? Theme.cardLine : Theme.border, lineWidth: focused ? 1.5 : 1))
                .accessibilityLabel("Soru \(index + 1) için cevabın")
                .onChange(of: draft) { _, text in
                    if text.count > 10000 { draft = String(text.prefix(10000)) }
                    scheduleSave()
                }
                .onChange(of: focused) { _, isFocused in if !isFocused { save() } }

            if item.answer != nil {
                Button {
                    Task { await evaluate() }
                } label: {
                    HStack(spacing: 6) {
                        if busy { ProgressView() } else { Image(systemName: "sparkles") }
                        Text("Cevabımı değerlendir")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            if let error { Message(text: error, kind: .error) }

            if let evaluation = item.evaluation {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Geri bildirim · \(Int((evaluation.score * 100).rounded()))/100")
                        .font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    MathText(evaluation.feedback).font(.subheadline).foregroundStyle(Theme.text)
                    Text("Bu bir çalışma önerisidir; resmi sınav puanı değildir.")
                        .font(.caption2).foregroundStyle(Theme.text3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                .transition(.opacity.combined(with: .offset(y: 6)))
            }

            if revealed {
                VStack(alignment: .leading, spacing: 6) {
                    if let answer = item.answer {
                        Text("Örnek cevap").font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                        MathText(answer).font(.subheadline).foregroundStyle(Theme.text)
                        Text("Cevabını karşılaştır: ana fikri yakaladın mı, eksik kalan bir nokta var mı?")
                            .font(.caption).foregroundStyle(Theme.text2)
                    } else {
                        Text("Kendini değerlendir").font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                        if let hint = item.hint { MathText(hint).font(.subheadline).foregroundStyle(Theme.text) }
                        Text("Bu notta örnek cevap yok. Cevabını notundaki ilgili bölümle karşılaştır.")
                            .font(.caption).foregroundStyle(Theme.text2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
            } else {
                Button {
                    save()
                    withAnimation { revealed = true }
                    if !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { onChange(current, true) }
                } label: {
                    Label(item.answer != nil ? "Örnek cevabı göster" : "Değerlendir", systemImage: "lightbulb")
                }
                .buttonStyle(SecondaryButtonStyle())
                if let hint = item.hint, item.answer != nil {
                    HStack(alignment: .top, spacing: 4) {
                        Text("İpucu:").font(.caption.weight(.semibold))
                        MathText(hint).font(.caption)
                    }
                    .foregroundStyle(Theme.text2)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .onAppear {
            draft = item.draft ?? ""
            saved = draft
        }
        .onDisappear { save() }
        .animation(.spring(response: 0.38, dampingFraction: 0.84), value: item.evaluation)
    }

    private var current: PracticeItem {
        var copy = item
        copy.draft = draft
        return copy
    }

    /// Saves 0.7 s after the last keystroke (SAVE_DELAY_MS).
    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(700))
            if !Task.isCancelled { save() }
        }
    }

    private func save() {
        saveTask?.cancel()
        guard draft != saved else { return }
        let firstReal = !Practice.isMeaningful(saved) && Practice.isMeaningful(draft)
        saved = draft
        store.savePractice(note: note, itemId: item.id, draft: draft, evaluation: nil, countsAsActivity: firstReal)
        onChange(current, false)
    }

    private func evaluate() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, item.answer != nil else { return }
        focused = false
        saveTask?.cancel()
        busy = true
        error = nil
        defer { busy = false }
        do {
            let result = try await Practice.grade(item, answer: draft)
            saved = draft
            store.savePractice(note: note, itemId: item.id, draft: draft, evaluation: result, countsAsActivity: true)
            var updated = current
            updated.evaluation = result
            OnboardingHaptics.success()
            onChange(updated, true)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Cevabın değerlendirilemedi. Tekrar deneyebilirsin."
        }
    }
}
