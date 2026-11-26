import Foundation
import Supabase
import SwiftUI

/// The signed-in account's courses, exams, notes and card counts, read from the same tables the site uses.
@MainActor
@Observable
final class StudyStore {
    enum Status: Equatable { case idle, loading, ready, failed(String) }

    private(set) var status: Status = .idle
    private(set) var courses: [Course] = []
    private(set) var exams: [CourseExam] = []
    private(set) var notes: [NoteItem] = []
    private(set) var cards: [Card] = []
    var attempts: [QuizAttempt] = []
    /// Study days (day → reviews), newest first: today's goal and the streak.
    var days: [StudyDayCount] = []
    /// New cards started today, from study_days.new_cards; nil while that column does not exist yet.
    var serverNewToday: Int?
    var audience: ExamAudience = .uni
    /// Shown as a banner when a save fails; the screen clears it.
    var saveError: String?
    private var writes: Task<Void, Never>?

    /// Saves run one after another, so two quick answers never race on the same study_days row.
    func enqueueWrite(_ work: @escaping @Sendable () async -> Void) {
        let previous = writes
        writes = Task {
            await previous?.value
            await work()
        }
    }

    func addCardsLocally(_ new: [Card]) { cards += new }

    func replace(_ card: Card) {
        if let index = cards.firstIndex(where: { $0.id == card.id }) { cards[index] = card }
    }

    /// Cards waiting now, the longest-waiting first.
    func dueCards(course: Course? = nil, now: Date = .now) -> [Card] {
        cards.filter { (course == nil || $0.courseId == course!.id) && $0.isDue(now) }.sorted { $0.dueDate < $1.dueDate }
    }

    func cards(of note: NoteItem) -> [Card] { cards.filter { $0.noteId == note.id } }

    /// Completed learning steps of a note as currently known (the list row reads this too).
    func noteSteps(_ note: NoteItem) -> [String] {
        notes.first { $0.id == note.id }?.completedSteps ?? note.completedSteps ?? []
    }

    func setSteps(_ noteId: UUID, _ steps: [String]) {
        if let index = notes.firstIndex(where: { $0.id == noteId }) { notes[index].completedSteps = steps }
    }

    func load() async {
        if status != .ready { status = .loading }
        do {
            async let courses: [Course] = supabase.from("courses").select("id,name,color,exam_date,created_at").order("created_at").execute().value
            async let notes: [NoteItem] = supabase.from("notes").select(NoteItem.columns).order("created_at", ascending: false).execute().value
            async let cards: [Card] = fetchCards()
            async let exams: [CourseExam] = fetchExams()
            async let attempts: [QuizAttempt] = supabase.from("quiz_attempts").select(QuizAttempt.columns).execute().value
            async let days = fetchDays()
            (self.courses, self.notes, self.cards, self.exams, self.attempts) = try await (courses, notes, cards, exams, attempts)
            (self.days, self.serverNewToday) = try await days
            status = .ready
        } catch is CancellationError {
            // Pull to refresh was let go; keep what is shown.
        } catch {
            if status != .ready { status = .failed(loadMessage(error)) }
        }
    }

    /// PostgREST returns at most 1000 rows per request; a busy account can have more cards.
    private func fetchCards() async throws -> [Card] {
        var all: [Card] = []
        let page = 1000
        var from = 0
        while true {
            let rows: [Card] = try await supabase.from("cards").select(Card.columns).order("created_at").range(from: from, to: from + page - 1).execute().value
            all += rows
            if rows.count < page { return all }
            from += page
        }
    }

    /// The last two months of study days (enough for the streak), and today's new-card count when
    /// study_days.new_cards exists (docs/IOS_SYNC.md item 6).
    private func fetchDays() async throws -> ([StudyDayCount], Int?) {
        let since = SRS.dayKey(Calendar.current.date(byAdding: .day, value: -62, to: .now) ?? .now)
        do {
            let rows: [StudyDayCount] = try await supabase.from("study_days").select("day,reviews,quizzes,actions,new_cards").gte("day", value: since).order("day", ascending: false).execute().value
            let today = rows.filter { $0.day == SRS.dayKey() }
            return (rows, today.isEmpty ? 0 : today.reduce(0) { $0 + ($1.newCards ?? 0) })
        } catch let error as PostgrestError where error.code == "PGRST204" || error.code == "42703" {
            let rows: [StudyDayCount] = try await supabase.from("study_days").select("day,reviews,quizzes,actions").gte("day", value: since).order("day", ascending: false).execute().value
            return (rows, nil)
        }
    }

    /// course_exams was added later; an account without the table still loads (like OPTIONAL_TABLES on the site).
    private func fetchExams() async throws -> [CourseExam] {
        do {
            return try await supabase.from("course_exams").select("id,course_id,kind,title,date,time,weight,grade,note_ids").execute().value
        } catch let error as PostgrestError where ["PGRST205", "42P01"].contains(error.code ?? "") {
            return []
        } catch let error as PostgrestError where error.code == "PGRST204" || error.code == "42703" {
            // The time / grade columns may not exist yet.
            return try await supabase.from("course_exams").select("id,course_id,kind,title,date,weight,note_ids").execute().value
        }
    }

    // MARK: - Derived

    func notes(in course: Course) -> [NoteItem] { notes.filter { $0.courseId == course.id } }

    func examsFor(_ course: Course) -> [CourseExam] {
        let own = exams.filter { $0.courseId == course.id }.sorted { $0.date < $1.date }
        if !own.isEmpty { return own }
        return course.examDate.map { [CourseExam(legacyFor: course, date: $0)] } ?? []
    }

    func nextExam(_ course: Course, now: Date = .now) -> CourseExam? {
        examsFor(course).first { Exams.daysLeft($0, now: now) != nil }
    }

    func cardCount(course: Course) -> Int { cards.filter { $0.courseId == course.id }.count }
    func cardCount(note: NoteItem) -> Int { cards.filter { $0.noteId == note.id }.count }

    func dueCount(course: Course? = nil, now: Date = .now) -> Int {
        cards.filter { card in (course == nil || card.courseId == course!.id) && card.isDue(now) }.count
    }

    /// Courses with the nearest upcoming exam first, then the rest by creation (the site's order on Sınavlar).
    var sortedCourses: [Course] {
        let now = Date.now
        return courses.enumerated().sorted { a, b in
            let da = nextExam(a.element, now: now).flatMap { Exams.daysLeft($0, now: now) }
            let db = nextExam(b.element, now: now).flatMap { Exams.daysLeft($0, now: now) }
            switch (da, db) {
            case let (x?, y?) where x != y: return x < y
            case (_?, nil): return true
            case (nil, _?): return false
            default: return a.offset < b.offset
            }
        }.map(\.element)
    }

    func reset() {
        courses = []; exams = []; notes = []; cards = []; attempts = []; days = []; serverNewToday = nil
        status = .idle
    }

    private func loadMessage(_ error: Error) -> String {
        let text = String(describing: error).lowercased()
        if text.contains("offline") || text.contains("network") || text.contains("internet") || text.contains("timed out") {
            return "İnternete bağlanılamadı. Bağlantını kontrol edip tekrar dene."
        }
        if text.contains("jwt") || text.contains("401") {
            return "Oturumun sona ermiş. Çıkış yapıp tekrar giriş yap."
        }
        return "Derslerin yüklenemedi. Biraz sonra tekrar dene."
    }
}

extension Course {
    /// Course colors are hex strings from the site's palette (COURSE_COLORS).
    var tint: Color { Color(hexString: color) ?? Theme.accent }
}

extension Color {
    init?(hexString: String) {
        var text = hexString.trimmingCharacters(in: .whitespaces)
        if text.hasPrefix("#") { text.removeFirst() }
        guard text.count == 6, let value = UInt32(text, radix: 16) else { return nil }
        self.init(uiColor: UIColor(hex: value))
    }
}
