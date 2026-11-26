import Foundation
import Supabase

/// Adds to today's study_days counts with the site's `bump_study_day` function (docs/IOS_SYNC.md):
/// one atomic call that creates the row if needed, so the site and the app never overwrite each
/// other's counts. Negative deltas undo.
enum StudyDays {
    private struct Bump: Encodable {
        let p_day: String
        let p_reviews: Int
        let p_quizzes: Int
        let p_actions: Int
        let p_new_cards: Int
    }

    /// The returned row is the day's total over all devices; `store` shows it instead of its own guess.
    static func bump(day: String, reviews: Int = 0, quizzes: Int = 0, actions: Int = 0, newCards: Int = 0, into store: StudyStore?) async throws {
        let row: StudyDayCount = try await supabase.rpc(
            "bump_study_day",
            params: Bump(p_day: day, p_reviews: reviews, p_quizzes: quizzes, p_actions: actions, p_new_cards: newCards)
        ).single().execute().value
        await store?.applyDay(row)
    }
}

extension StudyStore {
    func applyDay(_ row: StudyDayCount) {
        if let index = days.firstIndex(where: { $0.day == row.day }) {
            days[index] = row
        } else {
            days.insert(row, at: 0)
            days.sort { $0.day > $1.day }
        }
        if row.day == SRS.dayKey(), serverNewToday != nil { serverNewToday = row.newCards ?? serverNewToday }
    }
}
