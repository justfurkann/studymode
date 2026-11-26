import SwiftUI

struct ExamStudyView: View {
    @Environment(StudyStore.self) private var store
    let exam: CourseExam
    @State private var session: SessionBox?
    @State private var quiz = false

    private var notes: [NoteItem] { store.notes.filter { $0.courseId == exam.courseId && exam.covers($0.id) } }
    private var due: [Card] {
        store.dueCards().filter { $0.courseId == exam.courseId && exam.covers($0.noteId) }
    }

    var body: some View {
        List {
            Section {
                Text(Exams.dateText(exam))
                Button("Bekleyen kartları çalış (\(due.count))") { session = SessionBox(cards: due) }
                    .disabled(due.isEmpty)
                Button("Kısa testi aç") { quiz = true }.disabled(notes.isEmpty)
            }
            Section("Sınav kapsamındaki notlar") {
                if notes.isEmpty { Text("Bu sınav için henüz not yok.") }
                ForEach(notes) { note in NavigationLink(note.title, value: note) }
            }
        }
        .navigationTitle(Exams.name(exam, store.audience))
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: "Sınav tekrarı", cards: box.cards, mode: .grades).environment(store)
        }
        .sheet(isPresented: $quiz) { ExamQuickTest(notes: notes).environment(store) }
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
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if loading { ProgressView("Sorular hazırlanıyor") }
                    else if failure {
                        Text("Sorular yüklenemedi.")
                        Button("Tekrar dene") { Task { await load() } }
                    } else if questions.isEmpty { Text("Bu notlarda henüz test sorusu yok.") }
                    else if index == questions.count {
                        Text("\(questions.count) soruda \(score) doğru").font(.title2.bold())
                        Button("Bitir") { dismiss() }.buttonStyle(PrimaryButtonStyle())
                    } else {
                        let question = questions[index]
                        Text("Soru \(index + 1) / \(questions.count)").font(.subheadline)
                        MathText(question.prompt).font(.headline)
                        ForEach(question.options.indices, id: \.self) { option in
                            Button {
                                guard selected == nil else { return }
                                selected = option
                                if option == question.answerIndex { score += 1 }
                            } label: {
                                HStack {
                                    MathText(question.options[option])
                                    Spacer()
                                    if selected != nil, option == question.answerIndex { Image(systemName: "checkmark.circle.fill") }
                                    else if selected == option { Image(systemName: "xmark.circle") }
                                }.padding(12).background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                            }.buttonStyle(.plain)
                        }
                        if selected != nil {
                            MathText(question.explanation)
                            Button(index + 1 == questions.count ? "Sonucu gör" : "Sonraki soru") {
                                index += 1
                                selected = nil
                            }.buttonStyle(PrimaryButtonStyle())
                        }
                    }
                }.padding().frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("Kısa test")
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
