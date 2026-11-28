import Foundation

/// Deadlines survive wrist-down, relaunch and long absences. A new focus round always needs a tap.
struct FocusClock: Codable, Equatable {
    enum Plan: String, Codable, CaseIterable {
        case quick, classic, long
        var minutes: Int {
            switch self {
            case .quick: 15
            case .classic: 25
            case .long: 50
            }
        }
        var watchLabel: String {
            switch self {
            case .quick: "Hızlı · 15 + 5 dk"
            case .classic: "Klasik · 25 + 10 dk"
            case .long: "Derin · 50 + 15 dk"
            }
        }
        func rest(round: Int) -> Int {
            if round.isMultiple(of: 4) {
                switch self {
                case .quick: return 15
                case .classic: return 20
                case .long: return 25
                }
            }
            switch self {
            case .quick: return 5
            case .classic: return 10
            case .long: return 15
            }
        }
    }

    var plan = Plan.classic
    var round = 1
    var resting = false
    var deadline: Date?
    var pausedSeconds: TimeInterval?
    var creditedDay: Date?
    var creditedMinutes = 0

    var duration: TimeInterval { Double(resting ? plan.rest(round: round) : plan.minutes) * 60 }
    var ready: Bool { deadline == nil && pausedSeconds == nil }
    func remaining(at now: Date) -> TimeInterval {
        max(0, deadline?.timeIntervalSince(now) ?? pausedSeconds ?? duration)
    }
    func minutes(on date: Date) -> Int {
        guard let creditedDay, Calendar.current.isDate(creditedDay, inSameDayAs: date) else { return 0 }
        return creditedMinutes
    }

    mutating func toggle(at now: Date) {
        advance(to: now)
        if deadline != nil {
            pausedSeconds = remaining(at: now)
            deadline = nil
        } else {
            deadline = now.addingTimeInterval(pausedSeconds ?? duration)
            pausedSeconds = nil
        }
    }

    mutating func advance(to now: Date) {
        if !resting, let end = deadline, end <= now {
            creditedMinutes = minutes(on: end) + plan.minutes
            creditedDay = end
            resting = true
            deadline = end.addingTimeInterval(duration)
        }
        if resting, let end = deadline, end <= now {
            resting = false
            round += 1
            deadline = nil
        }
    }

    mutating func reset() {
        round = 1
        resting = false
        deadline = nil
        pausedSeconds = nil
    }
}
