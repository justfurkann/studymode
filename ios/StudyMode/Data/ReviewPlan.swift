import Foundation

/// The new Tekrar (docs/IOS_SYNC.md, "Ortak kural: yeni Tekrar"): one daily session with a goal,
/// a cap on new cards, and only cards the student has met. The schedule itself (SRS) is unchanged.
enum ReviewRules {
    /// Default cards in the daily session (~5 minutes), DEFAULT_DAILY_GOAL on the site. The student
    /// can change it in Ayarlar (StudyStore.dailyGoal), kept on this device like the site's setting.
    static let defaultDailyGoal = 15
    static let goalKey = "studymode.dailyGoal"

    /// clampDailyGoal: 1...500.
    static func clampGoal(_ value: Int) -> Int { min(500, max(1, value)) }

    static var dailyGoal: Int {
        let saved = UserDefaults.standard.integer(forKey: goalKey)
        return saved > 0 ? clampGoal(saved) : defaultDailyGoal
    }
    /// New cards that may start per day. Also a guess.
    static let newPerDay = 5
    /// "Biraz daha" adds this many.
    static let moreSize = 10
}

extension Card {
    /// Never answered: the state newCardState() gives (srs.ts).
    var isNew: Bool { reps == 0 && lapses == 0 && ease == 2.5 }

    /// Answered "Bilemedim" last time: a lapse, or a new card that was missed (ease dropped, no reps).
    var failedBefore: Bool { lapses > 0 || (reps == 0 && ease < 2.5) }
}

extension StudyStore {
    // MARK: Today

    var today: String { SRS.dayKey() }

    /// Cards answered today on any device (study_days.reviews), which is what the goal counts.
    var reviewsToday: Int { days.filter { $0.day == today }.reduce(0) { $0 + $1.reviews } }

    /// New cards started today: from the database when study_days.new_cards exists, otherwise
    /// counted on this phone.
    var newToday: Int { serverNewToday ?? LocalNewCount.get(day: today) }

    var newLeftToday: Int { max(0, ReviewRules.newPerDay - newToday) }

    var goalLeft: Int { max(0, dailyGoal - reviewsToday) }

    /// Days in a row with any study, ending today or yesterday (the site's streak idea).
    var streak: Int {
        let studied = Set(days.filter(\.studied).map(\.day))
        var day = Date.now
        if !studied.contains(SRS.dayKey(day)) { day = Calendar.current.date(byAdding: .day, value: -1, to: day) ?? day }
        var count = 0
        while studied.contains(SRS.dayKey(day)) {
            count += 1
            day = Calendar.current.date(byAdding: .day, value: -1, to: day) ?? day
        }
        return count
    }

    /// After an answer, before the next load: keeps the goal and the new-card count right on screen.
    func countLocally(review card: Card) {
        if let index = days.firstIndex(where: { $0.day == today }) {
            days[index].reviews += 1
        } else {
            days.insert(StudyDayCount(day: today, reviews: 1, quizzes: 0, actions: 0, newCards: 0), at: 0)
        }
        if card.isNew {
            if serverNewToday != nil { serverNewToday! += 1 } else { LocalNewCount.add(day: today) }
        }
    }

    /// Reverts `countLocally` when the student taps "Son cevabı geri al".
    func uncountLocally(wasNew: Bool) {
        if let index = days.firstIndex(where: { $0.day == today }), days[index].reviews > 0 {
            days[index].reviews -= 1
        }
        if wasNew, let current = serverNewToday, current > 0 {
            serverNewToday = current - 1
        }
    }

    /// Cards the student previously struggled with (`lapses > 0` or answered "Bilemedim" on a new card).
    func struggledCards(limit: Int = 25) -> [Card] {
        cards
            .filter(\.failedBefore)
            .sorted { a, b in
                if a.lapses != b.lapses { return a.lapses > b.lapses }
                return a.dueDate < b.dueDate
            }
            .prefix(limit)
            .map { $0 }
    }

    // MARK: Who may enter

    /// A note whose summary was read (Tanış or Anla done) or whose test was solved.
    func isStarted(_ note: NoteItem) -> Bool {
        let steps = noteSteps(note)
        return steps.contains("tanis") || steps.contains("anla") || attempts.contains { $0.noteId == note.id }
    }

    /// Cards without a note (added by hand) always enter. A card already answered at least once
    /// keeps its schedule (otherwise it would be forgotten). A NEW card only enters from a note whose
    /// summary was read or whose test was solved.
    func isEligible(_ card: Card) -> Bool {
        guard let noteId = card.noteId else { return true }
        if !card.isNew { return true }
        guard let note = notes.first(where: { $0.id == noteId }) else { return false }
        return isStarted(note)
    }

    /// Days to the nearest exam covering the card's note; nil without one.
    func examDays(for card: Card, now: Date = .now) -> Int? {
        guard let course = courses.first(where: { $0.id == card.courseId }) else { return nil }
        return examsFor(course)
            .filter { $0.covers(card.noteId) }
            .compactMap { Exams.daysLeft($0, now: now) }
            .min()
    }

    // MARK: The queue

    /// Up to `size` cards: nearest-exam course first, then cards missed before, then the most
    /// overdue; new cards last and at most `newAllowed` of them.
    func reviewQueue(size: Int, newAllowed: Int, now: Date = .now) -> [Card] {
        guard size > 0 else { return [] }
        let eligible = cards.filter { isEligible($0) }
        let examKey = { (card: Card) in self.examDays(for: card, now: now) ?? Int.max }

        let reviews = eligible
            .filter { !$0.isNew && $0.isDue(now) }
            .sorted { a, b in
                let (ea, eb) = (examKey(a), examKey(b))
                if ea != eb { return ea < eb }
                if a.failedBefore != b.failedBefore { return a.failedBefore }
                return a.dueDate < b.dueDate
            }
        let fresh = eligible
            .filter(\.isNew)
            .sorted { examKey($0) < examKey($1) }

        var queue = Array(reviews.prefix(size))
        if queue.count < size {
            queue += fresh.prefix(min(newAllowed, size - queue.count))
        }
        return queue
    }

    /// Today's session: what is left of the goal.
    var todayQueue: [Card] { reviewQueue(size: goalLeft, newAllowed: newLeftToday) }

    /// Is anything waiting at all (for "Biraz daha" and the empty state)?
    func hasMore(now: Date = .now) -> Bool { !reviewQueue(size: 1, newAllowed: newLeftToday, now: now).isEmpty }

    /// Rough count for "Yarın yaklaşık N kart": eligible reviews due by the end of tomorrow plus
    /// tomorrow's new cards, never more than the goal.
    var tomorrowEstimate: Int {
        let end = Calendar.current.date(byAdding: .day, value: 2, to: Calendar.current.startOfDay(for: .now)) ?? .now
        let eligible = cards.filter { isEligible($0) }
        let due = eligible.filter { !$0.isNew && $0.dueDate < end }.count
        let fresh = min(ReviewRules.newPerDay, eligible.filter(\.isNew).count)
        return min(dailyGoal, due + fresh)
    }

    /// Courses with notes, nearest exam first, for "Derslere göre hazırlık".
    var readinessRows: [(course: Course, readiness: Int?)] {
        sortedCourses.filter { !notes(in: $0).isEmpty }.map { ($0, readiness(of: $0)) }
    }
}

/// New cards started today on this phone, until study_days.new_cards exists.
enum LocalNewCount {
    private static func key(_ day: String) -> String { "studymode.newCards.\(day)" }
    static func get(day: String) -> Int { UserDefaults.standard.integer(forKey: key(day)) }
    static func add(day: String) { UserDefaults.standard.set(get(day: day) + 1, forKey: key(day)) }
}
