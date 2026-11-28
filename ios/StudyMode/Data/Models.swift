import Foundation

// Read-only shapes of the site's tables (supabase/schema.sql). Only the columns the app shows are
// selected, so a note's long text and the summary's extra fields are never downloaded here and can
// never be written back by mistake.

struct Course: Identifiable, Decodable, Hashable {
    let id: UUID
    var name: String
    var color: String
    var examDate: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, color
        case examDate = "exam_date"
        case createdAt = "created_at"
    }
}

enum ExamKind: String, Codable, CaseIterable, Identifiable {
    case vize, final, butunleme, quiz, diger
    var id: String { rawValue }
}

struct CourseExam: Identifiable, Decodable, Hashable {
    let id: String
    let courseId: UUID
    var kind: ExamKind
    var title: String?
    /// YYYY-MM-DD, local calendar day.
    var date: String
    var time: String?
    var weight: Double?
    var grade: Double?
    /// Notes the exam covers; empty means the whole course.
    var noteIds: [String]

    var isLegacy: Bool { id.hasPrefix("legacy-") }

    init(
        id: String,
        courseId: UUID,
        kind: ExamKind,
        title: String?,
        date: String,
        time: String?,
        weight: Double?,
        grade: Double?,
        noteIds: [String]
    ) {
        self.id = id
        self.courseId = courseId
        self.kind = kind
        self.title = title
        self.date = date
        self.time = time
        self.weight = weight
        self.grade = grade
        self.noteIds = noteIds
    }

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
    var updatedAt: String?
    /// summary->>overview; nil when the note has not been prepared yet.
    let overview: String?
    /// summary->completedSteps
    var completedSteps: [String]?
    /// summary->checkedTerms and the key terms' names: the site's "Tanış" step counts as done when
    /// every term is checked (computeNoteProgress).
    let checkedTerms: [String]?
    let keyTerms: [TermName]?
    /// summary->tags (the course page's tag filter).
    let tagList: LenientStrings?
    var tags: [String]? { tagList?.values }

    struct TermName: Decodable, Hashable { let term: String }

    var isPrepared: Bool { !(overview ?? "").isEmpty }

    enum CodingKeys: String, CodingKey {
        case id, title, generator, overview
        case courseId = "course_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case completedSteps = "steps"
        case checkedTerms = "checked"
        case keyTerms = "terms"
        case tagList = "tags"
    }

    static let columns = "id,course_id,title,generator,created_at,updated_at,overview:summary->>overview,steps:summary->completedSteps,checked:summary->checkedTerms,terms:summary->keyTerms,tags:summary->tags"
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
    /// Ids of the questions answered wrong, and the option chosen for each question (older rows have none).
    var wrongIds: [String]?
    var answers: [Int]?

    enum CodingKeys: String, CodingKey {
        case score, total, answers
        case noteId = "note_id"
        case createdAt = "created_at"
        case wrongIds = "wrong_ids"
    }

    static let columns = "note_id,score,total,created_at,wrong_ids,answers"
}

/// Summary row of a finished mock exam (`public.exam_results`).
struct ExamResultSummary: Identifiable, Decodable, Hashable {
    let id: UUID
    let courseId: UUID
    let format: String
    let difficulty: String?
    let source: String
    let score: Double
    let total: Int
    let durationSeconds: Int?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, format, difficulty, source, score, total
        case courseId = "course_id"
        case durationSeconds = "duration_seconds"
        case createdAt = "created_at"
    }

    static let columns = "id,course_id,format,difficulty,source,score,total,duration_seconds,created_at"

    var percent: Int {
        Int(((score / Double(max(1, total))) * 100.0).rounded())
    }
}

/// One multiple-choice question of a note (notes.questions, the site's Question type).
struct Question: Decodable, Hashable, Identifiable {
    let id: String
    let prompt: String
    let options: [String]
    let answerIndex: Int
    let explanation: String
    let source: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        prompt = (try? c.decode(String.self, forKey: .prompt)) ?? ""
        options = (try? c.decode([String].self, forKey: .options)) ?? []
        answerIndex = (try? c.decode(Int.self, forKey: .answerIndex)) ?? 0
        explanation = (try? c.decode(String.self, forKey: .explanation)) ?? ""
        source = try? c.decodeIfPresent(String.self, forKey: .source)
    }

    enum CodingKeys: String, CodingKey { case id, prompt, options, answerIndex, explanation, source }
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
    var updatedAt: String? = nil

    enum CodingKeys: String, CodingKey {
        case id, front, back, source, due, interval, ease, reps, lapses
        case courseId = "course_id"
        case noteId = "note_id"
        case updatedAt = "updated_at"
    }

    static let columns = "id,course_id,note_id,front,back,source,due,interval,ease,reps,lapses,updated_at"

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
        if let date = withFraction.date(from: text) ?? plain.date(from: text) { return date }
        // Postgres json gives microseconds (".123456"); the formatter takes at most milliseconds.
        guard let dot = text.firstIndex(of: "."), let end = text[dot...].firstIndex(where: { !$0.isNumber && $0 != "." }) else { return nil }
        let digits = text[text.index(after: dot)..<end]
        guard digits.count > 3 else { return nil }
        return withFraction.date(from: String(text[..<dot]) + "." + digits.prefix(3) + text[end...])
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
