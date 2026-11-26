import SwiftUI

/// Opens a note after it is added, from wherever "Not ekle" was used.
private struct OpenNoteKey: EnvironmentKey {
    static let defaultValue: (Course, UUID) -> Void = { _, _ in }
}

extension EnvironmentValues {
    var openNote: (Course, UUID) -> Void {
        get { self[OpenNoteKey.self] }
        set { self[OpenNoteKey.self] = newValue }
    }
}

struct CoursesView: View {
    @Environment(StudyStore.self) private var store
    @State private var session: SessionBox?
    @State private var showAll = false
    @State private var path = NavigationPath()
    @State private var adding = false

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                GridPaper()
                content
            }
            .navigationTitle("Çalışma masam")
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { adding = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus")
                            Text("Not ekle")
                        }
                    }
                    .disabled(store.status != .ready)
                }
            }
            .navigationDestination(for: Course.self) { CourseDetailView(course: $0) }
            .navigationDestination(for: NoteItem.self) { NoteDetailView(note: $0) }
        }
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: "Tekrar", cards: box.cards, mode: .daily).environment(store)
        }
        .environment(\.openNote, openNote)
        .sheet(isPresented: $adding) {
            AddNoteView(onDone: openNote).environment(store)
        }
    }

    /// After a note is added: its course, then the note itself.
    private func openNote(_ course: Course, _ noteId: UUID) {
        var next = NavigationPath()
        next.append(course)
        if let note = store.notes.first(where: { $0.id == noteId }) { next.append(note) }
        path = next
    }

    @ViewBuilder
    private var content: some View {
        switch store.status {
        case .idle, .loading:
            ProgressView().tint(Theme.text2)
        case let .failed(message):
            VStack(spacing: 14) {
                Message(text: message, kind: .error)
                Button("Tekrar dene") { Task { await store.load() } }
                    .buttonStyle(SecondaryButtonStyle())
            }
            .padding(20)
        case .ready:
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if store.courses.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("İlk notunla başla")
                                .font(Theme.display(.title2))
                            Text("Defterinden bir sayfa çek, PDF seç veya notunu yapıştır.")
                                .foregroundStyle(Theme.text2)
                            Button("Not ekle") { adding = true }
                                .buttonStyle(PrimaryButtonStyle())
                        }
                        .focusCard()
                    } else {
                        dailyReview
                        library
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
    }

    private var dailyReview: some View {
        let queue = store.todayQueue
        let done = min(ReviewRules.dailyGoal, store.reviewsToday)
        return VStack(alignment: .leading, spacing: 12) {
            Label("Bugünkü tekrar", systemImage: "rectangle.stack")
                .font(.subheadline.weight(.semibold))
            Text(queue.isEmpty
                 ? (store.goalLeft == 0 ? "Hedef tamamlandı" : "Bekleyen kart yok")
                 : "\(queue.count) kart hazır")
                .font(Theme.display(.largeTitle))
            Text("Günlük hedef · \(done) / \(ReviewRules.dailyGoal) kart")
                .font(.subheadline)
            if !queue.isEmpty {
                Button {
                    session = SessionBox(cards: queue)
                } label: {
                    HStack {
                        Text(done > 0 ? "Tekrara devam et" : "Tekrara başla")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(.headline)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 46)
                    .foregroundStyle(Theme.onHi)
                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .foregroundStyle(.white)
        .background(Color(light: 0x20274E, dark: 0x252B51), in: RoundedRectangle(cornerRadius: 20))
    }

    private var library: some View {
        let courses = store.sortedCourses
        let visible = showAll ? courses[...] : courses.prefix(4)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Derslerim").font(Theme.display(.title2))
                Spacer()
                Text("\(courses.count) ders").font(.subheadline).foregroundStyle(Theme.text2)
            }
            LazyVStack(spacing: 0) {
                ForEach(visible) { course in
                    NavigationLink(value: course) { CourseRow(course: course) }
                        .buttonStyle(.plain)
                    if course.id != visible.last?.id { Divider().padding(.horizontal, 16) }
                }
                if courses.count > 4 {
                    Divider()
                    Button(showAll ? "Daha az göster" : "Tüm dersleri göster") { showAll.toggle() }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
            }
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
        }
        .foregroundStyle(Theme.text)
    }
}

private struct CourseRow: View {
    @Environment(StudyStore.self) private var store
    let course: Course

    var body: some View {
        HStack(spacing: 12) {
            Circle().fill(course.tint).frame(width: 8, height: 8)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(course.name)
                    .font(Theme.display(.headline, weight: .bold))
                    .foregroundStyle(Theme.text)
                if let exam = store.nextExam(course), let countdown = Exams.countdown(exam, store.audience) {
                    CountdownChip(text: countdown.text, tone: countdown.tone)
                } else {
                    Text(store.notes(in: course).first?.title ?? "Henüz not yok")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text3)
        }
        .multilineTextAlignment(.leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct CountdownChip: View {
    let text: String
    let tone: Exams.Tone

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "calendar")
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(tone == .danger ? Theme.onHi : Theme.text)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(background, in: Capsule())
    }

    private var background: Color {
        switch tone {
        case .danger: Theme.hi
        case .warning: Theme.hiSoft
        case .neutral: Theme.surface2
        }
    }
}
