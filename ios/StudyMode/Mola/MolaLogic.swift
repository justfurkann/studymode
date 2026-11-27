import Foundation

/// "Mola": short games built from the student's own cards, plus a focus timer (src/lib/mola.ts).
/// Games never touch the spaced-repetition schedule or the daily card goal; they only keep the
/// streak alive. Records and focus minutes live on this device, like on the site.
enum Mola {
    static let matchPairs = 6
    static let matchMinPairs = 3
    static let matchPenalty: TimeInterval = 2
    static let quickSeconds: TimeInterval = 60
    static let quickMinCards = 4
    /// Wrong answers allowed in a quick round; the third one ends it.
    static let quickLives = 3
    static let tileMax = 80

    private static func normalize(_ text: String) -> String {
        text.lowercased(with: Dates.turkish).split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    static func clip(_ text: String, max: Int = tileMax) -> String {
        let clean = text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard clean.count > max else { return clean }
        let cut = String(clean.prefix(max - 1))
        if let space = cut.lastIndex(of: " "), cut.distance(from: cut.startIndex, to: space) > Int(Double(max) * 0.6) {
            return String(cut[..<space]).trimmingCharacters(in: .whitespaces) + "…"
        }
        return cut.trimmingCharacters(in: .whitespaces) + "…"
    }

    /// Cards that can be told apart: the same front or back twice would make a pair ambiguous.
    static func distinct(_ cards: [Card]) -> [Card] {
        var fronts = Set<String>(), backs = Set<String>(), out: [Card] = []
        for card in cards {
            let f = normalize(card.front), b = normalize(card.back)
            if f.isEmpty || b.isEmpty || f == b || fronts.contains(f) || backs.contains(b) { continue }
            fronts.insert(f); backs.insert(b); out.append(card)
        }
        return out
    }

    static func cards(_ all: [Card], course: UUID?) -> [Card] {
        distinct(course.map { id in all.filter { $0.courseId == id } } ?? all)
    }

    /// "“Öğrenme” ne anlama gelir?" becomes "Öğrenme" on a tile (tileFront).
    static func tileFront(_ front: String) -> String {
        let clean = front.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        let pattern = #"^(?:[“"‘'](.+?)[”"’']|(.+?))\s+(?:ne anlama gelir|nedir|ne demektir|neyi ifade eder)\s*\??$"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let m = regex.firstMatch(in: clean, range: NSRange(clean.startIndex..., in: clean)) else { return clean }
        for i in [1, 2] {
            if let r = Range(m.range(at: i), in: clean) {
                let term = clean[r].trimmingCharacters(in: .whitespaces)
                if !term.isEmpty && term.count <= 60 { return term }
            }
        }
        return clean
    }

    struct Tile: Identifiable, Hashable {
        let id: String
        let cardId: UUID
        let isFront: Bool
        let text: String
    }

    /// Up to six cards (short answers first, they fit a tile): terms on the left, answers on the right.
    static func matchColumns(_ cards: [Card]) -> (fronts: [Tile], backs: [Tile])? {
        let pool = distinct(cards).shuffled()
        let short = pool.filter { $0.back.trimmingCharacters(in: .whitespaces).count <= tileMax && $0.front.trimmingCharacters(in: .whitespaces).count <= Int(Double(tileMax) * 1.5) }
        let long = pool.filter { c in !short.contains { $0.id == c.id } }
        let picked = Array((short + long).prefix(matchPairs))
        guard picked.count >= matchMinPairs else { return nil }
        let fronts = picked.map { Tile(id: "\($0.id):f", cardId: $0.id, isFront: true, text: clip(tileFront($0.front), max: Int(Double(tileMax) * 1.5))) }
        let backs = picked.map { Tile(id: "\($0.id):b", cardId: $0.id, isFront: false, text: clip($0.back)) }
        return (fronts.shuffled(), backs.shuffled())
    }

    /// "38,4 sn" or "1 dk 05 sn".
    static func formatSeconds(_ seconds: TimeInterval) -> String {
        let total = max(0, seconds)
        if total < 60 { return String(format: "%.1f sn", total).replacingOccurrences(of: ".", with: ",") }
        return "\(Int(total) / 60) dk \(String(format: "%02d", Int(total) % 60)) sn"
    }

    struct QuickItem: Equatable {
        let cardId: UUID
        let prompt: String
        let shown: String
        let answer: String
        /// Whether `shown` is this card's real answer.
        let correct: Bool
    }

    /// One "Doğru mu?" statement: about half of the time the answer belongs to another card.
    static func nextQuick(_ cards: [Card], previous: UUID?) -> QuickItem? {
        let pool = distinct(cards)
        guard pool.count >= 2 else { return nil }
        let candidates = pool.count > 2 && previous != nil ? pool.filter { $0.id != previous } : pool
        guard let card = candidates.randomElement() else { return nil }
        let others = pool.filter { $0.id != card.id }
        let correct = Bool.random()
        let shown = correct ? card.back : (others.randomElement()?.back ?? card.back)
        return QuickItem(cardId: card.id, prompt: card.front, shown: clip(shown, max: 160), answer: clip(card.back, max: 160), correct: correct)
    }

    /// 1 point, or 2 once three in a row were right.
    static func quickPoints(streakBefore: Int) -> Int { streakBefore >= 2 ? 2 : 1 }
}

/// Records and focus minutes on this device, the same shape as the site's "studymode.mola.v1".
struct MolaRecords: Codable {
    var match: [String: Double] = [:]
    var quick: [String: Int] = [:]
    var focus: [String: Int] = [:]
    var rounds: [String: Int] = [:]

    private static let key = "studymode.mola.v1"

    static func read() -> MolaRecords {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode(MolaRecords.self, from: data) else { return MolaRecords() }
        return decoded
    }

    func write() {
        if let data = try? JSONEncoder().encode(self) { UserDefaults.standard.set(data, forKey: Self.key) }
    }

    static func scope(_ course: UUID?) -> String { course?.uuidString.lowercased() ?? "all" }

    /// Saves a match time in seconds; returns whether it beat the previous best.
    static func saveMatch(_ seconds: Double, course: UUID?) -> Bool {
        var r = read()
        let key = scope(course)
        let isBest = r.match[key].map { seconds < $0 } ?? true
        if isBest { r.match[key] = seconds; r.write() }
        return isBest
    }

    static func saveQuick(_ score: Int, course: UUID?) -> Bool {
        var r = read()
        let key = scope(course)
        let isBest = score > (r.quick[key] ?? 0)
        if isBest { r.quick[key] = score; r.write() }
        return isBest
    }

    static func addFocus(minutes: Int, rounds: Int = 1, on date: Date = .now) {
        var r = read()
        let day = SRS.dayKey(date)
        r.focus[day, default: 0] += minutes
        r.rounds[day, default: 0] += rounds
        r.write()
    }

    var roundsToday: Int { rounds[SRS.dayKey()] ?? 0 }

    /// Focus minutes of the last seven days, today included.
    var focusLastWeek: Int {
        (0..<7).reduce(0) { sum, i in
            let day = SRS.dayKey(Calendar.current.date(byAdding: .day, value: -i, to: .now) ?? .now)
            return sum + (focus[day] ?? 0)
        }
    }
}

/// The Pomodoro clock, the same model as the Apple Watch app's FocusClock: deadlines survive
/// leaving the screen and relaunching; a new focus round always needs a tap.
struct PhoneFocusClock: Codable, Equatable {
    enum Plan: String, Codable, CaseIterable {
        case classic, long
        var minutes: Int { self == .classic ? 25 : 50 }
        var label: String { self == .classic ? "25 + 5" : "50 + 10" }
        func rest(round: Int) -> Int {
            if round.isMultiple(of: 4) { return self == .classic ? 15 : 20 }
            return self == .classic ? 5 : 10
        }
    }

    var plan = Plan.classic
    var round = 1
    var resting = false
    var deadline: Date?
    var pausedSeconds: TimeInterval?

    var duration: TimeInterval { Double(resting ? plan.rest(round: round) : plan.minutes) * 60 }
    var ready: Bool { deadline == nil && pausedSeconds == nil }
    var running: Bool { deadline != nil }
    func remaining(at now: Date) -> TimeInterval { max(0, deadline?.timeIntervalSince(now) ?? pausedSeconds ?? duration) }

    mutating func toggle(at now: Date) {
        _ = advance(to: now)
        if deadline != nil {
            pausedSeconds = remaining(at: now)
            deadline = nil
        } else {
            deadline = now.addingTimeInterval(pausedSeconds ?? duration)
            pausedSeconds = nil
        }
    }

    /// Moves past finished phases; returns the focus minutes just completed (to credit them).
    mutating func advance(to now: Date) -> Int {
        var credited = 0
        if !resting, let end = deadline, end <= now {
            credited = plan.minutes
            resting = true
            deadline = end.addingTimeInterval(duration)
        }
        if resting, let end = deadline, end <= now {
            resting = false
            round += 1
            deadline = nil
        }
        return credited
    }

    mutating func reset() {
        round = 1
        resting = false
        deadline = nil
        pausedSeconds = nil
    }

    private static let key = "studymode.phoneFocus.v1"
    static func load() -> PhoneFocusClock {
        guard let data = UserDefaults.standard.data(forKey: key), let c = try? JSONDecoder().decode(PhoneFocusClock.self, from: data) else { return PhoneFocusClock() }
        return c
    }
    func save() { if let data = try? JSONEncoder().encode(self) { UserDefaults.standard.set(data, forKey: Self.key) } }
}
