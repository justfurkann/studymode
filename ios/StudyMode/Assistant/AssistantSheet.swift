import SwiftUI

/// Fosfor, the study buddy (the site's Assistant.tsx). It knows which course and note is open, and
/// anything in a note can be sent to it ("Anlamadım", long press, selected text): the sheet opens half
/// height over the note and answers that exact passage, so the student keeps reading underneath.
struct AssistantSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(AssistantPlace.self) private var place
    @Environment(\.dismiss) private var dismiss
    /// Fosfor's own tab: a general chat that starts with no course, a big Fosfor on top, no close
    /// button, and it never takes the questions sent from a note (the sheet over the note does).
    var inTab = false
    @State private var courseId: UUID?
    @State private var noteId: UUID?
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var busy = false
    @State private var error: String?
    @State private var retry: (() async -> Void)?
    @State private var showComparePicker = false
    @FocusState private var focused: Bool

    private var availableTerms: [String] {
        var seen: Set<String> = []
        var out: [String] = []
        let sourceNotes: [NoteItem] = if let note { [note] } else if let course { store.notes(in: course) } else { [] }
        for n in sourceNotes {
            for t in n.keyTerms ?? [] {
                let clean = t.term.trimmingCharacters(in: .whitespacesAndNewlines)
                let key = clean.lowercased(with: Locale(identifier: "tr_TR"))
                if !clean.isEmpty, seen.insert(key).inserted {
                    out.append(clean)
                    if out.count >= 14 { return out }
                }
            }
        }
        return out
    }

    private var course: Course? { store.courses.first { $0.id == courseId } }
    private var note: NoteItem? {
        guard let noteId else { return nil }
        return store.notes.first { $0.id == noteId && $0.courseId == courseId }
    }
    /// The passage the conversation is about, if it started from one.
    private var lastQuote: ChatMessage? { messages.last { $0.role == .user && $0.quote != nil } }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollViewReader { reader in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if messages.isEmpty && !busy { welcome }
                        ForEach(messages) { message in
                            row(message).id(message.id)
                        }
                        if busy { TypingRow(readingNotes: courseId != nil).id("busy") }
                        if let error { errorRow(error).id("error") }
                        if !busy, error == nil, messages.last?.role == .assistant, let quote = lastQuote {
                            followUps(for: quote).id("follow")
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.count) {
                    withAnimation(.easeOut(duration: 0.25)) { reader.scrollTo(messages.last?.id, anchor: .top) }
                }
                .onChange(of: busy) { if busy { withAnimation { reader.scrollTo("busy", anchor: .bottom) } } }
            }
            composer
        }
        .background(Theme.bg)
        .onAppear {
            if inTab {
                // Keep the course picked here; reload in case the sheet over a note added messages.
                messages = Assistant.load(course: courseId)
                return
            }
            courseId = place.courseId
            noteId = place.noteId
            messages = Assistant.load(course: courseId)
            takePending()
        }
        .onChange(of: place.pending) { if !inTab { takePending() } }
        .sheet(isPresented: $showComparePicker) {
            CompareConceptsSheet(terms: availableTerms) { prompt in
                Task { await send(prompt) }
            }
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            // In the tab the big Fosfor below is enough; one Fosfor per screen.
            if !inTab {
                FosforMascotView(size: 40, mood: busy ? .thinking : .curious, tappable: false)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Fosfor")
                    .font(Theme.display(.title3))
                    .foregroundStyle(Theme.text)
                contextMenu
            }
            Spacer(minLength: 8)
            if !messages.isEmpty {
                iconButton("square.and.pencil", label: "Yeni sohbet") {
                    withAnimation { messages = [] }
                    error = nil
                    Assistant.save([], course: courseId)
                }
                .disabled(busy)
            }
            if !inTab {
                iconButton("xmark", label: "Kapat") { dismiss() }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 18)
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.border).frame(height: 1) }
    }

    /// Which course (and note) Fosfor reads from; tap to switch.
    private var contextMenu: some View {
        Menu {
            Button { switchCourse(nil) } label: { Label("Genel soru", systemImage: courseId == nil ? "checkmark" : "") }
            ForEach(store.sortedCourses) { c in
                Button { switchCourse(c.id) } label: { Label(c.name, systemImage: courseId == c.id ? "checkmark" : "") }
            }
        } label: {
            HStack(spacing: 5) {
                Circle().fill(course?.tint ?? Theme.text3).frame(width: 7, height: 7)
                Text(contextLine)
                    .lineLimit(1)
                Image(systemName: "chevron.down").font(.caption2.weight(.bold))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.text2)
        }
        .accessibilityLabel("Fosfor'un okuduğu ders: \(contextLine)")
    }

    private var contextLine: String {
        guard let course else { return "Genel soru" }
        if let note { return "\(course.name) · \(note.title)" }
        return course.name
    }

    private func iconButton(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)
                .frame(width: 36, height: 36)
                .background(Theme.surface2, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: Empty state

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 16) {
            if inTab { FosforHero() }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("Takıldığın yeri")
                        .font(Theme.display(.title2))
                        .foregroundStyle(Theme.text)
                    Highlighted(text: "sor", font: Theme.display(.title2))
                }
                Text(note != nil
                     ? "“\(note!.title)” notunu okuyorum. Cevaplarım bu nottan ve dersin diğer notlarından gelir."
                     : course != nil
                        ? "\(course!.name) notlarından cevaplarım. Notta olmayan bir şeyse söylerim."
                        : "Çalışmayla ilgili her şeyi sorabilirsin. Bir ders seçersen o dersin notlarından cevaplarım.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            let items = Assistant.suggestions(note: note != nil, course: course != nil)
            if inTab {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(items, id: \.label) { s in
                        Button {
                            handleSuggestion(s)
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Image(systemName: s.icon)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Theme.onHi)
                                    .frame(width: 30, height: 30)
                                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 9))
                                Text(s.label)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.text)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(TactileCardButtonStyle(scale: 0.97))
                        .disabled(busy)
                    }
                }
            } else {
                VStack(spacing: 8) {
                    ForEach(items, id: \.label) { s in
                        Button {
                            handleSuggestion(s)
                        } label: {
                            HStack(spacing: 11) {
                                Image(systemName: s.icon)
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.onHi)
                                    .frame(width: 28, height: 28)
                                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 8))
                                Text(s.label)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Spacer(minLength: 6)
                                Image(systemName: "chevron.right")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Theme.text3)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(TactileCardButtonStyle(scale: 0.98))
                        .disabled(busy)
                    }
                }
            }

            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "hand.tap")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text2)
                Text("Notta anlamadığın bir yere **basılı tut** ya da metni seç, “Fosfor'a sor”a dokun. Hangi not, hangi kısım olduğunu ben anlarım.")
                    .font(.footnote)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(.top, 4)
    }

    private func handleSuggestion(_ s: (label: String, icon: String)) {
        if s.icon == "arrow.left.arrow.right" {
            OnboardingHaptics.selection()
            showComparePicker = true
        } else {
            Task { await send(s.label) }
        }
    }

    // MARK: Messages

    @ViewBuilder
    private func row(_ message: ChatMessage) -> some View {
        if message.role == .user {
            HStack {
                Spacer(minLength: 48)
                VStack(alignment: .leading, spacing: 8) {
                    if let quote = message.quote {
                        QuoteBlock(quote: quote, source: message.source)
                    }
                    Text(message.text)
                        .font(.body)
                        .foregroundStyle(Theme.onHi)
                        .textSelection(.enabled)
                }
                .padding(12)
                .background(Theme.hi, in: UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18, bottomTrailingRadius: 5, topTrailingRadius: 18))
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        } else {
            HStack(alignment: .top, spacing: 8) {
                FosforMascotView(size: 28, animated: false, tappable: false)
                VStack(alignment: .leading, spacing: 10) {
                    MathText(message.text)
                        .font(.body)
                        .foregroundStyle(Theme.text)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                    HStack(spacing: 14) {
                        Button {
                            UIPasteboard.general.string = Assistant.plain(message.text)
                            OnboardingHaptics.light()
                        } label: {
                            Label("Kopyala", systemImage: "doc.on.doc")
                        }
                        if course != nil {
                            Button {
                                Task { await toCard(message) }
                            } label: {
                                Label(message.carded ? "Kartta" : "Karta çevir", systemImage: message.carded ? "checkmark" : "plus.rectangle.on.rectangle")
                            }
                            .disabled(message.carded)
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text2)
                    .buttonStyle(.plain)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 18, bottomTrailingRadius: 18, topTrailingRadius: 18))
                .overlay(UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 18, bottomTrailingRadius: 18, topTrailingRadius: 18).stroke(Theme.border, lineWidth: 1))
            }
            .transition(.opacity.combined(with: .offset(y: 8)))
        }
    }

    /// After an answer about a passage: other ways to explain it, or a quick check question.
    private func followUps(for quoted: ChatMessage) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NoteAI.ExplainMode.allCases) { mode in
                    chip(mode.shortLabel, icon: mode.icon) {
                        await ask(FosforAsk(quote: quoted.quote ?? "", source: quoted.source, mode: mode))
                    }
                }
                chip("Bana soru sor", icon: "questionmark.circle") {
                    await send("Bununla ilgili bana tek bir kısa soru sor, cevabımı bekle.")
                }
            }
            .padding(.leading, 36)
        }
        .transition(.opacity)
    }

    private func chip(_ title: String, icon: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .background(Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.cardLine.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func errorRow(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Message(text: text, kind: .error)
            if let retry {
                Button {
                    Task { await retry() }
                } label: {
                    Label("Tekrar dene", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.text)
            }
        }
    }

    // MARK: Composer

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField(lastQuote != nil ? "Bu kısımla ilgili bir şey sor…" : (course.map { "\($0.name) hakkında sor…" } ?? "Bir şey sor…"),
                      text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .font(.body)
                .foregroundStyle(Theme.text)
                .padding(.vertical, 10)
                .padding(.leading, 14)
                .onChange(of: draft) { _, t in if t.count > 2_000 { draft = String(t.prefix(2_000)) } }
                .onSubmit(submit)
            Button(action: submit) {
                Image(systemName: "arrow.up")
                    .font(.subheadline.weight(.heavy))
                    .foregroundStyle(canSend ? Theme.onHi : Theme.text3)
                    .frame(width: 34, height: 34)
                    .background(canSend ? Theme.hi : Theme.surface2, in: Circle())
            }
            .disabled(!canSend)
            .padding(5)
            .accessibilityLabel("Gönder")
        }
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(focused ? Theme.cardLine : Theme.border, lineWidth: focused ? 1.5 : 1))
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(Theme.bg)
    }

    private var canSend: Bool { !busy && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    private func submit() {
        guard canSend else { return }
        let text = draft
        draft = ""
        Task { await send(text) }
    }

    // MARK: Actions

    /// A request from the note (Anlamadım, long press, selection): switch to its course and answer it.
    private func takePending() {
        guard let request = place.pending else { return }
        place.pending = nil
        if place.courseId != courseId {
            courseId = place.courseId
            messages = Assistant.load(course: courseId)
        }
        noteId = place.noteId
        Task { await ask(request) }
    }

    private func switchCourse(_ id: UUID?) {
        guard id != courseId else { return }
        courseId = id
        if id != place.courseId { noteId = nil } else { noteId = place.noteId }
        messages = Assistant.load(course: id)
        error = nil
    }

    /// Explain a passage of the open note. With a note, the `explain` task reads the part of the note
    /// around the passage (the same answer "Bu konuyu anlamadım" gave on its own); otherwise the chat
    /// task gets the passage in the question.
    private func ask(_ request: FosforAsk) async {
        guard !busy else { return }
        let quote = request.quote.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !quote.isEmpty else { return }
        let asking = courseId
        let history = messages
        let user = ChatMessage(role: .user, text: request.question, quote: String(quote.prefix(1_200)), source: request.source)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { messages.append(user) }
        Assistant.save(messages, course: asking)
        await answer(asking: asking, retry: { await ask(request) }) {
            if request.prompt == nil, let note {
                let content = try await store.noteContent(note.id)
                return try await NoteAI.explain(title: note.title, topic: quote, content: content, mode: request.mode)
            }
            let context = try await Assistant.context(course: asking, currentNote: note?.id)
            return try await Assistant.ask(course: course?.name ?? "", context: context, history: history, question: user.turnText)
        }
    }

    private func send(_ raw: String) async {
        let question = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !busy else { return }
        let asking = courseId
        let history = messages
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) { messages.append(ChatMessage(role: .user, text: question)) }
        Assistant.save(messages, course: asking)
        await answer(asking: asking, retry: { await resend(question) }) {
            let context = try await Assistant.context(course: asking, currentNote: note?.id)
            return try await Assistant.ask(course: course?.name ?? "", context: context, history: history, question: question)
        }
    }

    /// "Tekrar dene" after a failure: the question is already in the chat, only the answer is missing.
    private func resend(_ question: String) async {
        if messages.last?.role == .user, messages.last?.text == question, messages.last?.quote == nil { messages.removeLast() }
        await send(question)
    }

    private func answer(asking: UUID?, retry again: @escaping () async -> Void, _ work: () async throws -> String) async {
        busy = true
        error = nil
        retry = nil
        defer { busy = false }
        do {
            let reply = try await work()
            // The student may have switched course while waiting; the answer belongs to the one asked.
            var target = asking == courseId ? messages : Assistant.load(course: asking)
            target.append(ChatMessage(role: .assistant, text: reply))
            Assistant.save(target, course: asking)
            if asking == courseId { withAnimation(.spring(response: 0.4, dampingFraction: 0.86)) { messages = target } }
            store.recordActivity()
            OnboardingHaptics.light()
        } catch {
            // Drop the unanswered question so "Tekrar dene" doesn't repeat it.
            if asking == courseId, messages.last?.role == .user { messages.removeLast(); Assistant.save(messages, course: asking) }
            self.error = (error as? LocalizedError)?.errorDescription ?? "Fosfor'a ulaşılamadı. Bağlantını kontrol edip tekrar dene."
            retry = again
        }
    }

    private func toCard(_ message: ChatMessage) async {
        guard let courseId, let index = messages.firstIndex(of: message) else { return }
        let asked = messages[..<index].last { $0.role == .user }
        // A passage makes a better card front than "Bunu anlamadım…".
        let front = asked?.quote.map { "\($0.prefix(180))" } ?? asked?.text ?? "Fosfor'un cevabı"
        do {
            try await store.addAssistantCard(course: courseId, note: note?.id, question: front, answer: message.text)
            messages[index].carded = true
            Assistant.save(messages, course: courseId)
            OnboardingHaptics.success()
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol edip tekrar dene."
            retry = nil
        }
    }
}

/// The passage a question is about, inside the student's (yellow) bubble.
private struct QuoteBlock: View {
    let quote: String
    let source: String?
    @State private var expanded = false

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            RoundedRectangle(cornerRadius: 2).fill(Theme.onHi.opacity(0.55)).frame(width: 3)
            VStack(alignment: .leading, spacing: 3) {
                Text(source ?? "Notundan")
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.onHi.opacity(0.7))
                MathText(quote)
                    .font(.subheadline)
                    .foregroundStyle(Theme.onHi)
                    .lineLimit(expanded ? nil : 4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(10)
        .background(Theme.onHi.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .contentShape(Rectangle())
        .onTapGesture { withAnimation(.easeOut(duration: 0.2)) { expanded.toggle() } }
    }
}

/// A waiting message and three dots that bounce in sequence while Fosfor prepares a reply.
private struct TypingRow: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var messageIndex = 0
    @State private var startedAt = Date.now

    let readingNotes: Bool

    private var messages: [String] {
        [
            readingNotes ? "Notlarına bakıyor…" : "Sorunu düşünüyor…",
            "Cevabı hazırlıyor…",
            "Yanıtı toparlıyor…"
        ]
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(topLeadingRadius: 5, bottomLeadingRadius: 18, bottomTrailingRadius: 18, topTrailingRadius: 18)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            FosforMascotView(size: 28, mood: .thinking, animated: false, tappable: false)
            HStack(spacing: 10) {
                ZStack(alignment: .leading) {
                    ForEach(Array(messages.enumerated()), id: \.offset) { index, message in
                        Text(message)
                            .opacity(index == messageIndex ? 1 : 0)
                    }
                }
                .font(.footnote.weight(.semibold))
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: messageIndex)

                if reduceMotion {
                    dots(lifted: nil)
                } else {
                    TimelineView(.periodic(from: startedAt, by: 0.3)) { timeline in
                        let elapsed = max(0, timeline.date.timeIntervalSince(startedAt))
                        let phase = Int((elapsed / 0.3).rounded()) % 3
                        dots(lifted: phase)
                            .animation(.easeInOut(duration: 0.2), value: phase)
                    }
                }
            }
            .foregroundStyle(Theme.text2)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(minHeight: 39)
            .background(Theme.surface, in: bubbleShape)
            .overlay(bubbleShape.strokeBorder(Theme.border, lineWidth: 1))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Fosfor cevap hazırlıyor")
        .task {
            messageIndex = 0
            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: .seconds(3))
                } catch {
                    return
                }
                messageIndex = (messageIndex + 1) % messages.count
            }
        }
    }

    private func dots(lifted: Int?) -> some View {
        HStack(spacing: 3) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(Theme.text2.opacity(lifted == nil ? 0.65 : 1))
                    .frame(width: 5, height: 5)
                    .offset(y: index == lifted ? -3 : 0)
            }
        }
    }
}

/// Fosfor in the top bar of course and note screens: talks about what is open. It sits next to the
/// menu instead of floating over the content, so it never covers a button in the note.
struct FosforToolbarButton: View {
    @Environment(AssistantPlace.self) private var place

    var body: some View {
        Button {
            OnboardingHaptics.light()
            place.show(course: place.courseId, note: place.noteId)
        } label: {
            FosforMascotView(size: 26, mood: .curious, animated: false, tappable: false)
                .frame(width: 30, height: 30)
        }
        .accessibilityLabel("Fosfor'a sor")
    }
}

/// Quick 2-concept picker for Fosfor's "Karıştırılan kavramları karşılaştır" suggestion.
private struct CompareConceptsSheet: View {
    @Environment(\.dismiss) private var dismiss
    let terms: [String]
    let onCompare: (String) -> Void

    @State private var left = ""
    @State private var right = ""

    private var canCompareSpecific: Bool {
        !left.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !right.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Karşılaştırmak istediğin iki kavramı aşağıdan seç ya da kendin yaz.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)

                    HStack(spacing: 10) {
                        TextField("1. kavram", text: $left)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.border, lineWidth: 1))

                        Text("vs")
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(Theme.text3)

                        TextField("2. kavram", text: $right)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.border, lineWidth: 1))
                    }

                    if !terms.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Nottaki kavramlar")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.text2)

                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                                ForEach(terms, id: \.self) { term in
                                    let isLeft = left == term
                                    let isRight = right == term
                                    let picked = isLeft || isRight
                                    Button {
                                        OnboardingHaptics.selection()
                                        if isLeft {
                                            left = ""
                                        } else if isRight {
                                            right = ""
                                        } else if left.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                            left = term
                                        } else if right.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                            right = term
                                        } else {
                                            right = term
                                        }
                                    } label: {
                                        Text(term)
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(picked ? Theme.onHi : Theme.text)
                                            .lineLimit(1)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 7)
                                            .frame(maxWidth: .infinity)
                                            .background(picked ? Theme.hi : Theme.surface, in: Capsule())
                                            .overlay(Capsule().stroke(picked ? Theme.cardLine : Theme.border, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    VStack(spacing: 10) {
                        Button {
                            let l = left.trimmingCharacters(in: .whitespacesAndNewlines)
                            let r = right.trimmingCharacters(in: .whitespacesAndNewlines)
                            OnboardingHaptics.medium()
                            dismiss()
                            onCompare("“\(l)” ile “\(r)” kavramlarını karşılaştır: temel farkları, ortak yönleri ve sınavda en çok karıştırılan tuzak noktaları kısa maddeler hâlinde özetle.")
                        } label: {
                            Label("Seçilenleri karşılaştır", systemImage: "arrow.left.arrow.right")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!canCompareSpecific)

                        Button {
                            OnboardingHaptics.light()
                            dismiss()
                            onCompare("Bu nottaki en çok karıştırılan iki kavramı seçip farklarını ve sınav tuzaklarını karşılaştır.")
                        } label: {
                            Text("Fosfor kendisi seçsin ve karşılaştırsın")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("Kavramları karşılaştır")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
        }
    }
}
