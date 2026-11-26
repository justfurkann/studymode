import Foundation
import Supabase

/// Writing a card review, the same way the site's store.reviewCard does: the card's review state
/// is updated (only those columns), and today's study_days row gets one more review, which keeps
/// the streak and the daily card goal the same on the site and in the app.
private struct CardReviewUpdate: Encodable {
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let updated_at: String
}

private struct StudyDayRow: Decodable {
    let id: UUID
    let reviews: Int
    let new_cards: Int?
}

private struct StudyDayReviewsUpdate: Encodable {
    let reviews: Int
    let updated_at: String
}

private struct StudyDayReviewsAndNewUpdate: Encodable {
    let reviews: Int
    let new_cards: Int
    let updated_at: String
}

private struct NewStudyDay: Encodable {
    let id: UUID
    let day: String
    let reviews: Int
    let quizzes: Int
    let actions: Int
    let created_at: String
    let updated_at: String
}

private struct NewStudyDayWithNew: Encodable {
    let id: UUID
    let day: String
    let reviews: Int
    let quizzes: Int
    let actions: Int
    let new_cards: Int
    let created_at: String
    let updated_at: String
}

enum ISO {
    /// Same shape as JavaScript's toISOString(): "2026-11-26T10:00:00.000Z".
    private static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    static func string(_ date: Date) -> String { formatter.string(from: date) }
}

extension StudyStore {
    /// The nearest upcoming exam that covers the card's note caps its interval (examDateForCard).
    func examDate(for card: Card, now: Date = .now) -> String? {
        guard let course = courses.first(where: { $0.id == card.courseId }) else { return nil }
        return examsFor(course)
            .filter { Exams.daysLeft($0, now: now) != nil && $0.covers(card.noteId) }
            .min { $0.date < $1.date }?
            .date
    }

    func preview(_ card: Card, _ grade: Grade, now: Date = .now) -> Schedule {
        SRS.schedule(interval: card.interval, ease: card.ease, reps: card.reps, lapses: card.lapses, grade: grade, now: now, examDate: examDate(for: card, now: now))
    }

    /// Updates the card on screen at once and saves it in the background, one write after another.
    func review(_ card: Card, _ grade: Grade, now: Date = .now) {
        let result = preview(card, grade, now: now)
        var updated = card
        updated.due = ISO.string(result.due)
        updated.interval = result.interval
        updated.ease = result.ease
        updated.reps = result.reps
        updated.lapses = result.lapses
        replace(updated)
        countLocally(review: card)
        let wasNew = card.isNew
        let trackNew = serverNewToday != nil

        let update = CardReviewUpdate(due: updated.due, interval: result.interval, ease: result.ease, reps: result.reps, lapses: result.lapses, updated_at: ISO.string(now))
        let day = SRS.dayKey(now)
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("cards").update(update).eq("id", value: card.id).execute()
                try await Self.addReview(day: day, now: now, newCard: wasNew && trackNew)
            } catch {
                await MainActor.run {
                    self?.replace(card)
                    self?.saveError = "Son tekrarın kaydedilemedi. İnternet bağlantını kontrol et; kart yeniden karşına gelecek."
                }
            }
        }
    }

    /// Today's row, read fresh right before writing so counts made on the site are not lost.
    /// `newCard` is only true once study_days.new_cards exists (the load found it).
    private static func addReview(day: String, now: Date, newCard: Bool) async throws {
        let columns = newCard ? "id,reviews,new_cards" : "id,reviews"
        let rows: [StudyDayRow] = try await supabase.from("study_days").select(columns).eq("day", value: day).order("created_at").limit(1).execute().value
        let stamp = ISO.string(now)
        if let row = rows.first {
            if newCard {
                try await supabase.from("study_days").update(StudyDayReviewsAndNewUpdate(reviews: row.reviews + 1, new_cards: (row.new_cards ?? 0) + 1, updated_at: stamp)).eq("id", value: row.id).execute()
            } else {
                try await supabase.from("study_days").update(StudyDayReviewsUpdate(reviews: row.reviews + 1, updated_at: stamp)).eq("id", value: row.id).execute()
            }
        } else if newCard {
            try await supabase.from("study_days").insert(NewStudyDayWithNew(id: UUID(), day: day, reviews: 1, quizzes: 0, actions: 0, new_cards: 1, created_at: stamp, updated_at: stamp)).execute()
        } else {
            try await supabase.from("study_days").insert(NewStudyDay(id: UUID(), day: day, reviews: 1, quizzes: 0, actions: 0, created_at: stamp, updated_at: stamp)).execute()
        }
    }
}
