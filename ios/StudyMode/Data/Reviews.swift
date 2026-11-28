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
        updated.updatedAt = ISO.string(now)
        replace(updated)
        countLocally(review: card)
        let wasNew = card.isNew
        let trackNew = serverNewToday != nil

        let update = CardReviewUpdate(due: updated.due, interval: result.interval, ease: result.ease, reps: result.reps, lapses: result.lapses, updated_at: ISO.string(now))
        let day = SRS.dayKey(now)
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("cards").update(update).eq("id", value: card.id).execute()
                try await StudyDays.bump(day: day, reviews: 1, newCards: wasNew && trackNew ? 1 : 0, into: self)
            } catch {
                await MainActor.run {
                    self?.replace(card)
                    self?.saveError = "Son tekrarın kaydedilemedi. İnternet bağlantını kontrol et; kart yeniden karşına gelecek."
                }
            }
        }
    }

    /// Reverts the last card review locally and on Supabase using negative `bump_study_day` deltas.
    func undoReview(_ previous: Card, wasNew: Bool, now: Date = .now) {
        replace(previous)
        uncountLocally(wasNew: wasNew)
        let trackNew = serverNewToday != nil

        let restore = CardReviewUpdate(
            due: previous.due,
            interval: previous.interval,
            ease: previous.ease,
            reps: previous.reps,
            lapses: previous.lapses,
            updated_at: previous.updatedAt ?? ISO.string(now)
        )
        let day = SRS.dayKey(now)
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("cards").update(restore).eq("id", value: previous.id).execute()
                try await StudyDays.bump(day: day, reviews: -1, newCards: wasNew && trackNew ? -1 : 0, into: self)
            } catch {
                await MainActor.run {
                    self?.saveError = "Son cevap geri alınamadı. İnternet bağlantını kontrol et."
                }
            }
        }
    }
}
