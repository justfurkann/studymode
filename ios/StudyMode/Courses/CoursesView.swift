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
                    Button {
                        OnboardingHaptics.light()
                        adding = true
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus")
                            Text("Not ekle")
                        }
                        .fontWeight(.semibold)
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
            ScrollView {
                StudyLoadingStage(message: "Derslerin ve notların yükleniyor…", cardCount: 3)
                    .padding(.horizontal, 16)
            }
        case let .failed(message):
            VStack(spacing: 14) {
                Message(text: message, kind: .error)
                Button("Tekrar dene") { Task { await store.load() } }
                    .buttonStyle(SecondaryButtonStyle())
            }
            .padding(20)
        case .ready:
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if store.courses.isEmpty {
                        emptyDeskCard
                            .staggeredAppear(0)
                    } else {
                        dailyReview
                            .staggeredAppear(0)
                        library
                            .staggeredAppear(1)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
    }

    private var emptyDeskCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("İlk notunla")
                            .font(Theme.display(.title2))
                            .foregroundStyle(Theme.text)
                        Highlighted(text: "başla", font: Theme.display(.title2))
                    }
                    Text("Defterinden bir sayfa çek, PDF seç veya notunu yapıştır. Özet, kartlar ve test kendiliğinden oluşsun.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                }
                Spacer(minLength: 8)
                FosforMascotView(size: 54, mood: .curious)
            }

            Button {
                OnboardingHaptics.medium()
                adding = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus.circle.fill")
                    Text("Not ekle")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .focusCard()
    }

    private var dailyReview: some View {
        let queue = store.todayQueue
        let done = min(ReviewRules.dailyGoal, store.reviewsToday)
        let reached = store.goalLeft == 0
        let fraction = CGFloat(done) / CGFloat(max(ReviewRules.dailyGoal, 1))

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Label("Bugünkü tekrar", systemImage: "rectangle.stack.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white.opacity(0.84))
                        if store.streak > 0 {
                            Label("\(store.streak) gün", systemImage: "flame.fill")
                                .font(.caption2.weight(.bold).monospacedDigit())
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Theme.hi, in: Capsule())
                        }
                    }

                    Text(queue.isEmpty
                         ? (reached ? "Hedef tamamlandı" : "Bekleyen kart yok")
                         : "\(queue.count) kart hazır")
                        .font(Theme.display(.largeTitle))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText(value: Double(queue.count)))

                    Text("Günlük hedef · \(done) / \(ReviewRules.dailyGoal) kart")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.78))
                }

                Spacer(minLength: 8)

                FosforMascotView(
                    size: 54,
                    mood: reached ? .cheering : (queue.isEmpty ? .proud : .marking)
                )
            }

            // Crisp neon progress bar on dark navy hero surface
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(.white.opacity(0.14))
                    Capsule()
                        .fill(Theme.hi)
                        .frame(width: fraction == 0 ? 0 : max(14, geo.size.width * min(1, fraction)))
                        .animation(.spring(response: 0.50, dampingFraction: 0.80), value: done)
                }
            }
            .frame(height: 8)

            if !queue.isEmpty {
                Button {
                    OnboardingHaptics.medium()
                    session = SessionBox(cards: queue)
                } label: {
                    HStack {
                        Text(done > 0 ? "Tekrara devam et" : "Tekrara başla")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(.headline)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 48)
                    .foregroundStyle(Theme.onHi)
                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 13))
                    .overlay(RoundedRectangle(cornerRadius: 13).stroke(Color.black.opacity(0.28), lineWidth: 1.5))
                }
                .buttonStyle(TactileCardButtonStyle(scale: 0.98))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color(light: 0x1B2250, dark: 0x22284E), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.cardLine, lineWidth: 2))
        .background(RoundedRectangle(cornerRadius: 22).fill(Theme.cardDrop).offset(y: 5))
    }

    private var library: some View {
        let courses = store.sortedCourses
        let visible = showAll ? Array(courses) : Array(courses.prefix(4))
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Derslerim").font(Theme.display(.title2))
                Spacer()
                Text("\(courses.count) ders").font(.subheadline).foregroundStyle(Theme.text2)
            }

            LazyVStack(spacing: 10) {
                ForEach(Array(visible.enumerated()), id: \.element.id) { idx, course in
                    NavigationLink(value: course) {
                        CourseRow(course: course)
                    }
                    .buttonStyle(TactileCardButtonStyle())
                    .staggeredAppear(idx + 1)
                }

                if courses.count > 4 {
                    Button {
                        OnboardingHaptics.selection()
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.80)) {
                            showAll.toggle()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text(showAll ? "Daha az göster" : "Tüm dersleri göster (\(courses.count))")
                            Image(systemName: showAll ? "chevron.up" : "chevron.down")
                                .font(.caption.weight(.bold))
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .foregroundStyle(Theme.text)
    }
}

private struct CourseRow: View {
    @Environment(StudyStore.self) private var store
    let course: Course

    var body: some View {
        let readiness = store.readiness(of: course)
        let noteCount = store.notes(in: course).count

        HStack(spacing: 13) {
            RoundedRectangle(cornerRadius: 4)
                .fill(course.tint)
                .frame(width: 6, height: 42)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(course.name)
                        .font(Theme.display(.headline, weight: .bold))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if let exam = store.nextExam(course), let countdown = Exams.countdown(exam, store.audience) {
                        CountdownChip(text: countdown.text, tone: countdown.tone)
                    }
                }

                HStack(spacing: 8) {
                    Text(noteCount == 0 ? "Henüz not yok" : "\(noteCount) not · \(store.cardCount(course: course)) kart")
                        .font(.caption)
                        .foregroundStyle(Theme.text2)

                    if let readiness {
                        Spacer(minLength: 4)
                        Text("Hazırlık: %\(readiness)")
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .foregroundStyle(Theme.text2)
                    }
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.text3)
        }
        .multilineTextAlignment(.leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
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
        .overlay(
            Capsule()
                .stroke(tone == .danger ? Theme.cardLine : Color.clear, lineWidth: 1)
        )
    }

    private var background: Color {
        switch tone {
        case .danger: Theme.hi
        case .warning: Theme.hiSoft
        case .neutral: Theme.surface2
        }
    }
}
