import Foundation

// Read-only shapes of the site's tables (supabase/schema.sql). Only the columns the app shows are
// selected, so a note's long text and the summary's extra fields are never downloaded here and can
// never be written back by mistake.

struct Course: Identifiable, Decodable, Hashable {
    let id: UUID
    let name: String
    let color: String
    let examDate: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, color
        case examDate = "exam_date"
        case createdAt = "created_at"
    }
}

enum ExamKind: String, Decodable {
    case vize, final, butunleme, quiz, diger
}

struct CourseExam: Identifiable, Decodable, Hashable {
    let id: String
    let courseId: UUID
    let kind: ExamKind
    let title: String?
    /// YYYY-MM-DD, local calendar day.
    let date: String
    let time: String?
    let weight: Double?
    let grade: Double?
    /// Notes the exam covers; empty means the whole course.
    let noteIds: [String]

    enum CodingKeys: String, CodingKey {
        case id, kind, title, date, time, weight, grade
        case courseId = "course_id"
        case noteIds = "note_ids"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id).uuidString
        courseId = try c.decode(UUID.self, forKey: .courseId)
        kind = (try? c.decode(ExamKind.self, forKey: .kind)) ?? .diger
        title = try c.decodeIfPresent(String.self, forKey: .title)
        date = try c.decode(String.self, forKey: .date)
        time = try c.decodeIfPresent(String.self, forKey: .time)
        weight = try c.decodeIfPresent(Double.self, forKey: .weight)
        grade = try c.decodeIfPresent(Double.self, forKey: .grade)
        noteIds = (try? c.decode([String].self, forKey: .noteIds)) ?? []
    }

    func covers(_ noteId: UUID?) -> Bool {
        noteIds.isEmpty || (noteId.map { id in noteIds.contains { $0.lowercased() == id.uuidString.lowercased() } } ?? false)
    }

    /// Stands in for the single exam date of courses made before multiple exams existed (legacyExam on the site).
    init(legacyFor course: Course, date: String) {
        id = "legacy-\(course.id.uuidString)"
        courseId = course.id
        kind = .diger
        title = nil
        self.date = date
        time = nil
        weight = nil
        grade = nil
        noteIds = []
    }
}

/// A note in a list: no text, only whether it has been prepared and how far the student got.
struct NoteItem: Identifiable, Decodable, Hashable {
    let id: UUID
    let courseId: UUID
    let title: String
    let generator: String?
    let createdAt: String
    /// summary->>overview; nil when the note has not been prepared yet.
    let overview: String?
    /// summary->completedSteps
    var completedSteps: [String]?
    /// summary->checkedTerms and the key terms' names: the site's "Tanış" step counts as done when
    /// every term is checked (computeNoteProgress).
    let checkedTerms: [String]?
    let keyTerms: [TermName]?

    struct TermName: Decodable, Hashable { let term: String }

    var isPrepared: Bool { !(overview ?? "").isEmpty }

    enum CodingKeys: String, CodingKey {
        case id, title, generator, overview
        case courseId = "course_id"
        case createdAt = "created_at"
        case completedSteps = "steps"
        case checkedTerms = "checked"
        case keyTerms = "terms"
    }

    static let columns = "id,course_id,title,generator,created_at,overview:summary->>overview,steps:summary->completedSteps,checked:summary->checkedTerms,terms:summary->keyTerms"
}

/// One study_days row, only the counts the app needs.
struct StudyDayCount: Decodable, Hashable {
    let day: String
    var reviews: Int
    let quizzes: Int
    let actions: Int?
    var newCards: Int?

    enum CodingKeys: String, CodingKey {
        case day, reviews, quizzes, actions
        case newCards = "new_cards"
    }

    /// Any study counts for the streak (cards, tests, written answers).
    var studied: Bool { reviews + quizzes + (actions ?? 0) > 0 }
}

/// A finished test of a note (quiz_attempts), for readiness and for "the test was solved".
struct QuizAttempt: Decodable, Hashable {
    let noteId: UUID
    let score: Int
    let total: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case score, total
        case noteId = "note_id"
        case createdAt = "created_at"
    }

    static let columns = "note_id,score,total,created_at"
}

/// A flashcard with its review state (the cards table, without user_id and timestamps).
struct Card: Identifiable, Decodable, Hashable {
    let id: UUID
    let courseId: UUID
    let noteId: UUID?
    let front: String
    let back: String
    let source: String?
    var due: String
    var interval: Double
    var ease: Double
    var reps: Int
    var lapses: Int

    enum CodingKeys: String, CodingKey {
        case id, front, back, source, due, interval, ease, reps, lapses
        case courseId = "course_id"
        case noteId = "note_id"
    }

    static let columns = "id,course_id,note_id,front,back,source,due,interval,ease,reps,lapses"

    var dueDate: Date { Dates.parse(due) ?? .distantPast }
    func isDue(_ now: Date = .now) -> Bool { dueDate <= now }
}

enum Dates {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    /// Postgres timestamptz ("2026-11-26T09:00:00.123+00:00") or the site's toISOString().
    static func parse(_ text: String) -> Date? {
        withFraction.date(from: text) ?? plain.date(from: text)
    }

    /// A local calendar day "YYYY-MM-DD" at midnight.
    static func day(_ text: String) -> Date? {
        let parts = text.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static let turkish = Locale(identifier: "tr_TR")

    /// "28 Ekim" or "28 Ekim 2025" when not this year.
    static func short(_ date: Date, now: Date = .now) -> String {
        let sameYear = Calendar.current.component(.year, from: date) == Calendar.current.component(.year, from: now)
        let style = Date.FormatStyle(locale: turkish).day().month(.wide)
        return sameYear ? date.formatted(style) : date.formatted(style.year())
    }
}
