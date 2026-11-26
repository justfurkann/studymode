import Foundation

/// The site's spaced-repetition scheduler (src/lib/srs.ts), line for line, so a card answered in the
/// app comes back on the same day it would have on the site.
enum Grade: String, CaseIterable {
    case again, hard, good, easy

    var label: String {
        switch self {
        case .again: "Bilemedim"
        case .hard: "Zor"
        case .good: "İyi"
        case .easy: "Kolay"
        }
    }
}

struct Schedule: Equatable {
    var due: Date
    var interval: Double
    var ease: Double
    var reps: Int
    var lapses: Int
}

enum SRS {
    private static let day: TimeInterval = 24 * 60 * 60
    private static let minEase = 1.3
    private static let relearnMinutes = 10.0

    /// Whole days from `now` until the local start of `examDate`; nil if there is none.
    static func daysUntil(_ examDate: String?, now: Date = .now) -> Int? {
        guard let examDate, let exam = Dates.day(examDate) else { return nil }
        let today = Calendar.current.startOfDay(for: now)
        return Int((exam.timeIntervalSince(today) / day).rounded())
    }

    static func schedule(interval: Double, ease: Double, reps: Int, lapses: Int, grade: Grade, now: Date = .now, examDate: String? = nil) -> Schedule {
        var interval = interval
        var ease = ease

        if grade == .again {
            return Schedule(
                due: now.addingTimeInterval(relearnMinutes * 60),
                interval: 0,
                ease: max(minEase, ease - 0.2),
                reps: 0,
                lapses: reps > 0 ? lapses + 1 : lapses
            )
        }

        switch grade {
        case .hard:
            interval = reps == 0 ? 1 : max(1, interval * 1.2)
            ease = max(minEase, ease - 0.15)
        case .good:
            interval = reps == 0 ? 1 : reps == 1 ? 3 : interval * ease
        case .easy:
            interval = reps == 0 ? 4 : max(interval + 1, interval * ease * 1.3)
            ease += 0.15
        case .again:
            break
        }

        // With an upcoming exam the card comes back at least twice before it.
        if let left = daysUntil(examDate, now: now), left > 0 {
            interval = min(interval, max(1, floor(Double(left) / 2)))
        }

        interval = (interval * 10).rounded() / 10
        return Schedule(
            due: now.addingTimeInterval(interval.rounded() * day),
            interval: interval,
            ease: (ease * 100).rounded() / 100,
            reps: reps + 1,
            lapses: lapses
        )
    }

    /// "10 dk", "3 gün", "2 ay".
    static func intervalLabel(_ result: Schedule, now: Date = .now) -> String {
        let seconds = result.due.timeIntervalSince(now)
        if seconds < 3600 { return "\(max(1, Int((seconds / 60).rounded()))) dk" }
        let days = Int((seconds / day).rounded())
        if days < 30 { return "\(days) gün" }
        return "\(Int((Double(days) / 30).rounded())) ay"
    }

    /// "YYYY-MM-DD" in the phone's time zone, like localDayKey on the site.
    static func dayKey(_ date: Date = .now) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}
