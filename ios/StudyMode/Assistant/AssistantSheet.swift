import SwiftUI

/// Fosfor, the study buddy (the site's Assistant.tsx): ask a quick question about the open note or
/// course without leaving it. Answers come from the course's notes; one can be saved as a card.
struct AssistantSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(AssistantPlace.self) private var place
    @Environment(\.dismiss) private var dismiss

    @State private var courseId: UUID?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var course: Course? { store.courses.first { $0.id == courseId } }
    private var openNote: NoteItem? {
        guard let id = place.noteId, place.courseId == courseId else { return nil }
        return store.notes.first { $0.id == id }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                coursePicker
                Divider().overlay(Theme.border)
                ScrollViewReader { reader in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            if messages.isEmpty { welcome }
                            ForEach(messages) { message in
                                bubble(message).id(message.id)
                            }
                            if busy {
                                HStack(spacing: 8) {
                                    ProgressView()
                                    Text("Fosfor düşünüyor…").font(.subheadline).foregroundStyle(Theme.text2)
                                }
                                .id("busy")
                            }
                            if let error { Message(text: error, kind: .error).id("error") }
                        }
                        .padding(16)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: messages.count) {
                        withAnimation { reader.scrollTo(messages.last?.id, anchor: .bottom) }
                    }
                    .onChange(of: busy) { if busy { withAnimation { reader.scrollTo("busy", anchor: .bottom) } } }
                }
                composer
            }
            .background(Theme.bg)
            .navigationTitle("Fosfor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if !messages.isEmpty {
                        Button("Yeni sohbet") {
                            messages = []
                            Assistant.save([], course: courseId)
                        }
                    }
                }
                ToolbarItem(placement: .confirmationAction) { Button("Kapat") { dismiss() } }
            }
            .onAppear {
                courseId = place.courseId
                messages = Assistant.load(course: courseId)
            }
        }
    }

    private var coursePicker: some View {
        Menu {
            Button { switchCourse(nil) } label: { Label("Genel soru", systemImage: courseId == nil ? "checkmark" : "") }
            ForEach(store.sortedCourses) { c in
                Button { switchCourse(c.id) } label: { Label(c.name, systemImage: courseId == c.id ? "checkmark" : "") }
            }
        } label: {
            HStack(spacing: 8) {
                Circle().fill(course?.tint ?? Theme.text3).frame(width: 9, height: 9)
                VStack(alignment: .leading, spacing: 1) {
                    Text(course?.name ?? "Genel soru (ders seçilmedi)")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                    if let openNote {
                        Text("Açık not: \(openNote.title)").font(.caption).foregroundStyle(Theme.text2).lineLimit(1)
                    }
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.caption.weight(.bold)).foregroundStyle(Theme.text3)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .accessibilityLabel("Ders seç")
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                FosforMascotView(size: 44, mood: .curious)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Merhaba, ben Fosfor!").font(Theme.display(.headline)).foregroundStyle(Theme.text)
                    Text(course == nil
                         ? "Çalışmayla ilgili her şeyi sorabilirsin. Bir ders seçersen o dersin notlarından cevaplarım."
                         : "Bu dersin notlarından cevaplarım. Notta olmayan bir şeyse söylerim.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Assistant.suggestions(note: openNote != nil, course: course != nil), id: \.label) { s in
                    Button {
                        Task { await send(s.label) }
                    } label: {
                        Label(s.label, systemImage: s.icon)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(Theme.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(busy)
                }
            }
        }
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage) -> some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 40)
                Text(message.text)
                    .font(.body)
                    .foregroundStyle(Theme.onHi)
                    .padding(12)
                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.cardLine, lineWidth: 1))
                    .textSelection(.enabled)
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                Text(Assistant.styled(message.text))
                    .font(.body)
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                if course != nil {
                    Button {
                        Task { await toCard(message) }
                    } label: {
                        Label(message.carded ? "Kartta" : "Karta çevir", systemImage: message.carded ? "checkmark" : "plus.rectangle.on.rectangle")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                    }
                    .buttonStyle(.plain)
                    .disabled(message.carded)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField(course == nil ? "Bir şey sor…" : "\(course!.name) hakkında sor…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(focused ? Theme.cardLine : Theme.border, lineWidth: 1))
                .onChange(of: draft) { _, t in if t.count > 2_000 { draft = String(t.prefix(2_000)) } }
            Button {
                let text = draft
                draft = ""
                Task { await send(text) }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Theme.onHi)
                    .frame(width: 42, height: 42)
                    .background(Theme.hi, in: Circle())
                    .overlay(Circle().stroke(Theme.cardLine, lineWidth: 1.5))
            }
            .disabled(busy || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Gönder")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.bg)
    }

    private func switchCourse(_ id: UUID?) {
        guard id != courseId else { return }
        courseId = id
        messages = Assistant.load(course: id)
        error = nil
    }

    private func send(_ raw: String) async {
        let question = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !busy else { return }
        let asking = courseId
        let history = messages
        messages.append(ChatMessage(role: .user, text: question))
        Assistant.save(messages, course: asking)
        busy = true
        error = nil
        defer { busy = false }
        do {
            let context = try await Assistant.context(course: asking, currentNote: openNote?.id)
            let reply = try await Assistant.ask(course: course?.name ?? "", context: context, history: history, question: question)
            // The student may have switched course while waiting; the answer belongs to the one asked.
            var target = asking == courseId ? messages : Assistant.load(course: asking)
            target.append(ChatMessage(role: .assistant, text: reply))
            Assistant.save(target, course: asking)
            if asking == courseId { messages = target }
            store.recordActivity()
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Fosfor'a ulaşılamadı. Bağlantını kontrol edip tekrar dene."
        }
    }

    private func toCard(_ message: ChatMessage) async {
        guard let courseId, let index = messages.firstIndex(of: message) else { return }
        let question = messages[..<index].last { $0.role == .user }?.text ?? "Fosfor'un cevabı"
        do {
            try await store.addAssistantCard(course: courseId, note: openNote?.id, question: question, answer: message.text)
            messages[index].carded = true
            Assistant.save(messages, course: courseId)
            OnboardingHaptics.success()
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol edip tekrar dene."
        }
    }
}

/// The floating Fosfor button above the tab bar (the site's corner assistant).
struct AssistantButton: View {
    @Environment(AssistantPlace.self) private var place

    var body: some View {
        FosforMascotView(size: 34, mood: .curious)
            .contentShape(Rectangle())
            // Wins over the mascot's own hop-on-tap.
            .highPriorityGesture(TapGesture().onEnded {
                OnboardingHaptics.light()
                place.open = true
            })
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Fosfor'a sor")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { place.open = true }
    }
}
