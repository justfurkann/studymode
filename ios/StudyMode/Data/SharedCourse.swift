import Foundation
import Supabase

/// A friend's shared course (the site's src/lib/share.ts and /paylas/:token): read through
/// get_course_share by its token, then copied into this account — notes, summaries, questions,
/// practice, cards (starting fresh) and upcoming exam dates. The owner's progress never travels.
struct SharedSnapshot: Decodable {
    struct CourseInfo: Decodable { let name: String; let color: String }
    struct Question: Decodable { let prompt: String; let options: [String]; let answerIndex: Int; let explanation: String; let source: String? }
    struct Practice: Decodable { let question: String; let answer: String?; let hint: String? }
    struct Note: Decodable {
        let title: String
        let content: String
        /// Kept as it came (overview, points, keyTerms, tags) and written back the same way.
        let summary: AnyJSON?
        let questions: [Question]
        let practice: [Practice]
        let generator: String?
    }
    struct CardItem: Decodable { let front: String; let back: String; let source: String?; let note: Int? }
    struct Exam: Decodable {
        let kind: String
        let title: String?
        let date: String
        let weight: Double?
        let notes: [Int]
    }

    let v: Int
    let course: CourseInfo
    let notes: [Note]
    let cards: [CardItem]
    let exams: [Exam]

    var questionCount: Int { notes.reduce(0) { $0 + $1.questions.count } }
    func cardCount(note index: Int) -> Int { cards.filter { $0.note == index }.count }

    /// parseSnapshot: the schema's limits, and every index points at a note that exists.
    var isValid: Bool {
        let ok: (Int?) -> Bool = { $0 == nil || ($0! >= 0 && $0! < notes.count) }
        let kinds: Set<String> = ["vize", "final", "butunleme", "quiz", "diger"]
        return v == 1
            && !course.name.isEmpty && course.name.count <= 120
            && notes.count <= 200 && cards.count <= 5000 && exams.count <= 20
            && notes.allSatisfy { $0.title.count <= 300 && $0.questions.allSatisfy { $0.answerIndex >= 0 } }
            && cards.allSatisfy { ok($0.note) }
            && exams.allSatisfy { e in kinds.contains(e.kind) && e.date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil && e.notes.allSatisfy { ok($0) } }
    }
}

struct FetchedShare {
    let ownerName: String?
    let snapshot: SharedSnapshot
}

enum SharedCourses {
    struct Failure: LocalizedError {
        let errorDescription: String?
        init(_ text: String) { errorDescription = text }
    }

    /// The token from a link (https://studymode.fun/paylas/<token>) or the bare token.
    static func token(from text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate: String
        if let range = trimmed.range(of: #"paylas/[A-Za-z0-9]+"#, options: .regularExpression) {
            candidate = String(trimmed[range].dropFirst("paylas/".count))
        } else {
            candidate = trimmed
        }
        return candidate.range(of: #"^[A-Za-z0-9]{16,64}$"#, options: .regularExpression) != nil ? candidate : nil
    }

    private struct Row: Decodable {
        let owner_name: String?
        let snapshot: SharedSnapshot?
    }

    /// nil when the link is closed or wrong (the site's "Bu bağlantı çalışmıyor").
    static func fetch(_ token: String) async throws -> FetchedShare? {
        guard self.token(from: token) == token else { return nil }
        let rows: [Row]
        do {
            rows = try await supabase.rpc("get_course_share", params: ["share_token": token]).execute().value
        } catch is DecodingError {
            throw Failure("Bu paylaşım okunamadı.")
        } catch {
            throw Failure("Paylaşılan ders yüklenemedi. İnternet bağlantını kontrol edip yeniden dene.")
        }
        guard let row = rows.first else { return nil }
        guard let snapshot = row.snapshot, snapshot.isValid else { throw Failure("Bu paylaşım okunamadı.") }
        return FetchedShare(ownerName: row.owner_name, snapshot: snapshot)
    }

    // MARK: Remembering what was added on this phone (the site keeps the same in localStorage)

    private static let importedKey = "studymode.importedShares.v1"

    static func importedCourse(_ token: String) -> UUID? {
        (UserDefaults.standard.dictionary(forKey: importedKey)?[token] as? String).flatMap(UUID.init)
    }

    static func rememberImport(_ token: String, course: UUID) {
        var map = UserDefaults.standard.dictionary(forKey: importedKey) ?? [:]
        map[token] = course.uuidString
        UserDefaults.standard.set(map, forKey: importedKey)
    }
}

// MARK: Copying into this account

private struct ImportCourseRow: Encodable {
    let id: UUID
    let name: String
    let color: String
    let exam_date: String?
    let created_at: String
    let updated_at: String
}

private struct ImportNoteRow: Encodable {
    let id: UUID
    let course_id: UUID
    let title: String
    let content: String
    let summary: AnyJSON
    let questions: [StudySet.QuestionOut]
    let practice: [StudySet.PracticeOut]
    let generator: String?
    let created_at: String
    let updated_at: String
}

private struct ImportCardRow: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID?
    let front: String
    let back: String
    let source: String?
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let created_at: String
    let updated_at: String
}

private struct ImportExamRow: Encodable {
    let id: UUID
    let course_id: UUID
    let kind: String
    let title: String?
    let date: String
    let weight: Double?
    let note_ids: [String]
    let created_at: String
    let updated_at: String
}

extension StudyStore {
    /// importCourse on the site: a new course with fresh ids; "(paylaşılan)" when the name is taken;
    /// cards start as new cards; exams keep only their dates and covered notes.
    func importSharedCourse(_ s: SharedSnapshot) async throws -> Course {
        let now = Date.now
        let stamp = ISO.string(now)
        let turkish = Locale(identifier: "tr_TR")
        let taken = Set(courses.map { $0.name.lowercased(with: turkish) })
        let name = taken.contains(s.course.name.lowercased(with: turkish))
            ? String("\(s.course.name) (paylaşılan)".prefix(120))
            : s.course.name
        let color = Self.courseColors.contains(s.course.color) ? s.course.color : Self.courseColors[courses.count % Self.courseColors.count]
        let courseId = UUID()
        let noteIds = s.notes.map { _ in UUID() }
        let today = SRS.dayKey(now)
        let nextExam = s.exams.map(\.date).filter { $0 >= today }.min()

        let courseRow = ImportCourseRow(id: courseId, name: name, color: color, exam_date: nextExam, created_at: stamp, updated_at: stamp)
        let noteRows = s.notes.enumerated().map { i, n in
            ImportNoteRow(
                id: noteIds[i], course_id: courseId, title: n.title, content: n.content,
                summary: n.summary ?? .null,
                questions: n.questions.map { .init(id: UUID().uuidString.lowercased(), prompt: $0.prompt, options: $0.options, answerIndex: $0.answerIndex, explanation: $0.explanation, source: $0.source) },
                practice: n.practice.map { .init(id: UUID().uuidString.lowercased(), question: $0.question, answer: $0.answer, hint: $0.hint) },
                generator: n.generator, created_at: stamp, updated_at: stamp
            )
        }
        let cardRows = s.cards.map { c in
            ImportCardRow(id: UUID(), course_id: courseId, note_id: c.note.map { noteIds[$0] }, front: c.front, back: c.back, source: c.source,
                          due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0, created_at: stamp, updated_at: stamp)
        }
        let examRows = s.exams.map { e in
            ImportExamRow(id: UUID(), course_id: courseId, kind: e.kind, title: e.title, date: e.date, weight: e.weight,
                          note_ids: e.notes.map { noteIds[$0].uuidString.lowercased() }, created_at: stamp, updated_at: stamp)
        }

        try await supabase.from("courses").insert(courseRow).execute()
        do {
            // Notes can be long: a few at a time keeps each request small.
            for chunk in stride(from: 0, to: noteRows.count, by: 10).map({ Array(noteRows[$0..<min($0 + 10, noteRows.count)]) }) {
                try await supabase.from("notes").insert(chunk).execute()
            }
            for chunk in stride(from: 0, to: cardRows.count, by: 500).map({ Array(cardRows[$0..<min($0 + 500, cardRows.count)]) }) {
                try await supabase.from("cards").insert(chunk).execute()
            }
            if !examRows.isEmpty {
                try await supabase.from("course_exams").insert(examRows).execute()
            }
        } catch {
            // Half a course is worse than none: take back what was written (notes and cards go with it).
            try? await supabase.from("courses").delete().eq("id", value: courseId).execute()
            throw SharedCourses.Failure("Ders eklenemedi. İnternet bağlantını kontrol edip yeniden dene.")
        }
        await load()
        guard let course = courses.first(where: { $0.id == courseId }) else {
            throw SharedCourses.Failure("Ders eklendi ama listelenemedi. Çalışma masanı yenile.")
        }
        return course
    }
}
