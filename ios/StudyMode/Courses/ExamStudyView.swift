import SwiftUI

struct ExamStudyView: View {
    @Environment(StudyStore.self) private var store
    let exam: CourseExam
    @State private var session: SessionBox?
    @State private var quiz = false
    @State private var editing = false
    @State private var mockExam = false

    private var currentExam: CourseExam {
        store.exams.first { $0.id.lowercased() == exam.id.lowercased() } ?? exam
    }

    private var course: Course? {
        store.courses.first { $0.id == currentExam.courseId }
    }

    private var notes: [NoteItem] {
        store.notes.filter { $0.courseId == currentExam.courseId && currentExam.covers($0.id) }
    }

    private var due: [Card] {
        store.dueCards().filter { $0.courseId == currentExam.courseId && currentExam.covers($0.noteId) }
    }

    var body: some View {
        let readiness = store.readiness(for: currentExam)
        let countdown = Exams.countdown(currentExam, store.audience)

        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Exam hero summary card
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            if let course {
                                HStack(spacing: 6) {
                                    Circle().fill(course.tint).frame(width: 9, height: 9)
                                    Text(course.name)
                                }
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(Theme.text2)
                            }
                            Spacer()
                            if let countdown {
                                CountdownChip(text: countdown.text, tone: countdown.tone)
                            }
                        }

                        Text(Exams.dateText(currentExam))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)

                        if let readiness {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Sınav hazırlığı: %\(readiness)")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.text2)
                                FosforProgressBar(value: Double(readiness), total: 100, height: 9)
                            }
                        }

                        VStack(spacing: 10) {
                            if course != nil {
                                Button {
                                    OnboardingHaptics.medium()
                                    mockExam = true
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "sparkles")
                                        Text("Tam sınav provası başlat")
                                    }
                                }
                                .buttonStyle(PrimaryButtonStyle())
                                .disabled(notes.isEmpty)
                            }

                            HStack(spacing: 10) {
                                Button {
                                    OnboardingHaptics.light()
                                    session = SessionBox(cards: due)
                                } label: {
                                    Text("Kartlar (\(due.count))")
                                }
                                .buttonStyle(SecondaryButtonStyle())
                                .disabled(due.isEmpty)

                                Button {
                                    OnboardingHaptics.light()
                                    quiz = true
                                } label: {
                                    Text("Hızlı 5 soru")
                                }
                                .buttonStyle(SecondaryButtonStyle())
                                .disabled(notes.isEmpty)
                            }
                        }
                        .padding(.top, 4)
                    }
                    .focusCard()

                    // Covered notes list
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle("Sınav kapsamındaki notlar (\(notes.count))")
                        if notes.isEmpty {
                            EmptyBox(
                                title: "Bu sınav için henüz not yok",
                                text: "Ders sayfasından not eklediğinde sınav kapsamına dahil olur."
                            )
                        } else {
                            LazyVStack(spacing: 10) {
                                ForEach(notes) { note in
                                    NavigationLink(value: note) {
                                        HStack {
                                            Text(note.title)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(Theme.text)
                                                .lineLimit(2)
                                                .multilineTextAlignment(.leading)
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(Theme.text3)
                                        }
                                        .padding(14)
                                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 15))
                                        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Theme.border, lineWidth: 1))
                                    }
                                    .buttonStyle(TactileCardButtonStyle())
                                }
                            }
                        }
                    }
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle(Exams.name(currentExam, store.audience))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Düzenle") {
                    OnboardingHaptics.light()
                    editing = true
                }
            }
        }
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: "Sınav tekrarı", cards: box.cards, mode: .grades).environment(store)
        }
        .sheet(isPresented: $quiz) {
            ExamQuickTest(notes: notes).environment(store)
        }
        .sheet(isPresented: $editing) {
            CourseExamEditorSheet(course: course, editing: currentExam).environment(store)
        }
        .fullScreenCover(isPresented: $mockExam) {
            if let course {
                MockExamView(course: course, preselectedExam: currentExam).environment(store)
            }
        }
    }
}

private struct ExamQuickTest: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let notes: [NoteItem]
    @State private var questions: [Question] = []
    @State private var loading = true
    @State private var failure = false
    @State private var index = 0
    @State private var selected: Int?
    @State private var score = 0

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if loading {
                            StudyLoadingStage(message: "Hızlı sorular seçiliyor…", cardCount: 2)
                        } else if failure {
                            Message(text: "Sorular yüklenemedi.", kind: .error)
                            Button("Tekrar dene") { Task { await load() } }
                                .buttonStyle(SecondaryButtonStyle())
                        } else if questions.isEmpty {
                            EmptyBox(title: "Test sorusu yok", text: "Bu notlarda henüz hazır test sorusu yok.")
                        } else if index == questions.count {
                            VStack(spacing: 14) {
                                CelebrationBadgeView()
                                Text("\(questions.count) soruda \(score) doğru")
                                    .font(Theme.display(.title2))
                                    .foregroundStyle(Theme.text)
                                Button("Bitir") { dismiss() }
                                    .buttonStyle(PrimaryButtonStyle())
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 20)
                        } else {
                            let question = questions[index]
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Soru \(index + 1) / \(questions.count)")
                                    .font(.subheadline.weight(.bold).monospacedDigit())
                                    .foregroundStyle(Theme.text2)
                                FosforProgressBar(value: Double(index + (selected != nil ? 1 : 0)), total: Double(questions.count), height: 8)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                MathText(question.prompt)
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(Theme.text)

                                ForEach(question.options.indices, id: \.self) { option in
                                    Button {
                                        guard selected == nil else { return }
                                        OnboardingHaptics.selection()
                                        selected = option
                                        let isCorrect = option == question.answerIndex
                                        if isCorrect { score += 1 }
                                        StudySound.playAnswer(isCorrect: isCorrect)
                                    } label: {
                                        HStack {
                                            MathText(question.options[option])
                                                .foregroundStyle(Theme.text)
                                            Spacer()
                                            if selected != nil, option == question.answerIndex {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundStyle(Theme.success)
                                            } else if selected == option {
                                                Image(systemName: "xmark.circle.fill")
                                                    .foregroundStyle(Theme.danger)
                                            }
                                        }
                                        .padding(12)
                                        .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .focusCard()

                            if selected != nil {
                                if !question.explanation.isEmpty {
                                    MathText(question.explanation)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.text)
                                        .padding(12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                                }
                                Button(index + 1 == questions.count ? "Sonucu gör" : "Sonraki soru") {
                                    index += 1
                                    selected = nil
                                }
                                .buttonStyle(PrimaryButtonStyle())
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .navigationTitle("Kısa test")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Kapat") { dismiss() } }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        failure = false
        defer { loading = false }
        do {
            var pool: [[Question]] = []
            for note in notes.shuffled() {
                try Task.checkCancellation()
                let choices = try await store.questions(for: note).shuffled()
                if !choices.isEmpty { pool.append(choices) }
                if pool.count == 5 { break }
            }
            var result: [Question] = []
            while result.count < 5 && pool.contains(where: { !$0.isEmpty }) {
                for i in pool.indices where result.count < 5 && !pool[i].isEmpty {
                    result.append(pool[i].removeLast())
                }
            }
            questions = result
        } catch { failure = true }
    }
}
