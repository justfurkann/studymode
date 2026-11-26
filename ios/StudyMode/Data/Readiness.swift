import Foundation

/// "Hazırlık", exactly as the site computes it (src/lib/examFocus.ts examReadiness, with
/// learningPath.ts computeTopicMastery and computeNoteProgress), so the app and the site never show
/// two different numbers for the same course.
extension StudyStore {
    /// Without a test or card review a note counts at most this much (UNTESTED_CAP).
    static let untestedCap = 40.0

    /// Test and card performance of one note, 0-100; nil when neither has been done (not assessed).
    func mastery(of note: NoteItem) -> Double? {
        let noteCards = cards.filter { $0.noteId == note.id }
        let studied = noteCards.filter { $0.reps > 0 || $0.lapses > 0 }
        let tries = attempts.filter { $0.noteId == note.id && $0.total > 0 }.sorted { $0.createdAt > $1.createdAt }
        if tries.isEmpty && studied.isEmpty { return nil }

        var quiz: Double?
        if let latest = tries.first {
            let ratio = { (a: QuizAttempt) in Double(a.score) / Double(a.total) }
            let best = tries.max { ratio($0) < ratio($1) } ?? latest
            quiz = ratio(latest) * 0.7 + ratio(best) * 0.3
        }
        var cardScore: Double?
        if !studied.isEmpty && !noteCards.isEmpty {
            let total = noteCards.reduce(0.0) { sum, card in
                if card.reps == 0 && card.lapses == 0 { return sum }
                if card.reps == 0 && card.lapses > 0 { return sum + 0.2 }
                if card.interval >= 7 { return sum + 1 }
                return sum + 0.7
            }
            cardScore = total / Double(noteCards.count)
        }
        let combined: Double
        switch (quiz, cardScore) {
        case let (q?, c?): combined = q * 0.6 + c * 0.4
        case let (q?, nil): combined = q
        case let (nil, c?): combined = c
        default: combined = 0
        }
        return (combined * 100).rounded()
    }

    /// Share of the five learning steps done, 0-100 (computeNoteProgress.percent).
    func progress(of note: NoteItem) -> Double {
        let done = Set(noteSteps(note))
        let terms = note.keyTerms ?? []
        let checked = Set(note.checkedTerms ?? [])
        let noteCards = cards.filter { $0.noteId == note.id }
        let studied = noteCards.filter { $0.reps > 0 || $0.lapses > 0 }.count
        let tested = attempts.contains { $0.noteId == note.id && $0.total > 0 }

        var count = 0
        if done.contains("tanis") || (!terms.isEmpty && terms.allSatisfy { checked.contains($0.term) }) { count += 1 }
        if done.contains("anla") { count += 1 }
        if done.contains("pekistir") || (!noteCards.isEmpty && studied >= min(noteCards.count, Int((Double(noteCards.count) * 0.5).rounded(.up)))) { count += 1 }
        if done.contains("sina") || tested { count += 1 }
        if done.contains("anlat") { count += 1 }
        return (Double(count) / 5 * 100).rounded()
    }

    /// Readiness of a set of notes, 0-100; nil when there are no notes (we cannot know).
    func readiness(of notes: [NoteItem]) -> Int? {
        guard !notes.isEmpty else { return nil }
        let total = notes.reduce(0.0) { sum, note in
            if let m = mastery(of: note) { return sum + m }
            if note.generator == nil { return sum }
            return sum + min(Self.untestedCap, progress(of: note) * 0.4)
        }
        return Int((total / Double(notes.count)).rounded())
    }

    /// A course's readiness: for its next exam's notes when it has one, otherwise all its notes.
    func readiness(of course: Course) -> Int? {
        let courseNotes = notes(in: course)
        if let exam = nextExam(course) {
            return readiness(of: courseNotes.filter { exam.covers($0.id) })
        }
        return readiness(of: courseNotes)
    }
}
