import Foundation
import Supabase

/// A note's test, written the way the site's store does it (addAttempt, recordStudyActivity
/// {quizzes: 1}, toggleCompletedStep 'sina', addCards from wrong answers).
private struct QuestionsRow: Decodable {
    let questions: [Question]?
}

private struct NewAttempt: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID
    let score: Int
    let total: Int
    let wrong_ids: [String]
    let answers: [Int]
    let created_at: String
}

private struct NewCard: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID?
    let front: String
    let back: String
    let source: String?
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let created_at: String
    let updated_at: String
}

private struct DayQuizzes: Decodable {
    let id: UUID
    let quizzes: Int
}

private struct QuizzesUpdate: Encodable {
    let quizzes: Int
    let updated_at: String
}

private struct NewQuizDay: Encodable {
    let id: UUID
    let day: String
    let reviews: Int
    let quizzes: Int
    let actions: Int
    let created_at: String
    let updated_at: String
}

extension StudyStore {
    func questions(for note: NoteItem) async throws -> [Question] {
        let row: QuestionsRow = try await supabase.from("notes").select("questions").eq("id", value: note.id).single().execute().value
        return (row.questions ?? []).filter { $0.options.count >= 2 && $0.options.indices.contains($0.answerIndex) }
    }

    func lastAttempt(for note: NoteItem) -> QuizAttempt? {
        attempts.filter { $0.noteId == note.id }.max { $0.createdAt < $1.createdAt }
    }

    /// Saves a finished test: the attempt, one more test on today's study day (streak), and the
    /// Test step (any score completes it: the test measures where the student stands).
    func saveAttempt(note: NoteItem, questions: [Question], answers: [Int], now: Date = .now) {
        let wrong = questions.enumerated().filter { answers.indices.contains($0.offset) && answers[$0.offset] != $0.element.answerIndex }.map(\.element.id)
        let score = questions.count - wrong.count
        let stamp = ISO.string(now)
        let attempt = QuizAttempt(noteId: note.id, score: score, total: questions.count, createdAt: stamp, wrongIds: wrong, answers: answers)
        attempts.append(attempt)
        if let index = days.firstIndex(where: { $0.day == SRS.dayKey(now) }) {
            days[index] = StudyDayCount(day: days[index].day, reviews: days[index].reviews, quizzes: days[index].quizzes + 1, actions: days[index].actions, newCards: days[index].newCards)
        } else {
            days.insert(StudyDayCount(day: SRS.dayKey(now), reviews: 0, quizzes: 1, actions: 0, newCards: 0), at: 0)
        }
        markStepDone(note, step: "sina")

        let row = NewAttempt(id: UUID(), course_id: note.courseId, note_id: note.id, score: score, total: questions.count, wrong_ids: wrong, answers: answers, created_at: stamp)
        let day = SRS.dayKey(now)
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("quiz_attempts").insert(row).execute()
                let rows: [DayQuizzes] = try await supabase.from("study_days").select("id,quizzes").eq("day", value: day).order("created_at").limit(1).execute().value
                if let today = rows.first {
                    try await supabase.from("study_days").update(QuizzesUpdate(quizzes: today.quizzes + 1, updated_at: stamp)).eq("id", value: today.id).execute()
                } else {
                    try await supabase.from("study_days").insert(NewQuizDay(id: UUID(), day: day, reviews: 0, quizzes: 1, actions: 0, created_at: stamp, updated_at: stamp)).execute()
                }
            } catch {
                await MainActor.run { self?.saveError = "Test sonucun kaydedilemedi. İnternet bağlantını kontrol et." }
            }
        }
    }

    /// "Yanlışlarımı karta çevir": the question on the front, the right answer and its explanation
    /// on the back, as new cards of the note (newCardState). Returns how many were added.
    @discardableResult
    func cardsFromMistakes(note: NoteItem, questions: [Question], now: Date = .now) -> Int {
        let stamp = ISO.string(now)
        let rows = questions.map { q in
            NewCard(
                id: UUID(), course_id: note.courseId, note_id: note.id,
                front: q.prompt.replacingOccurrences(of: "Notlarına göre bu açıklama hangi kavrama ait?", with: "Bu açıklama hangi kavrama ait?\n"),
                back: q.options[q.answerIndex] + (q.explanation.isEmpty ? "" : "\n\n\(q.explanation)"),
                source: q.source, due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0, created_at: stamp, updated_at: stamp
            )
        }
        guard !rows.isEmpty else { return 0 }
        addCardsLocally(rows.map { Card(id: $0.id, courseId: $0.course_id, noteId: $0.note_id, front: $0.front, back: $0.back, source: $0.source, due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0) })
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("cards").insert(rows).execute()
            } catch {
                await MainActor.run { self?.saveError = "Kartlar eklenemedi. İnternet bağlantını kontrol et." }
            }
        }
        return rows.count
    }
}
