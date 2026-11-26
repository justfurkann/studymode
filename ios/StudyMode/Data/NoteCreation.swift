import Foundation
import Supabase

/// New courses and notes, and a prepared study set written onto a note — the same rows the site's
/// store writes (addNote, applyGenerated, makeCards with newCardState).
enum NoteLimits {
    /// notes.content check in the schema.
    static let maxContent = 400_000
    static let maxTitle = 200
}

private struct NewCourseRow: Encodable {
    let id: UUID
    let name: String
    let color: String
    let exam_date: String?
    let created_at: String
    let updated_at: String
}

private struct NewNoteRow: Encodable {
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

private struct PreparedNoteUpdate: Encodable {
    let summary: Summary
    let questions: [StudySet.QuestionOut]
    let practice: [StudySet.PracticeOut]
    let generator: String
    let updated_at: String

    struct Summary: Encodable {
        let overview: String
        let points: [String]
        let keyTerms: [StudySet.Term]
        let sourceChanged: Bool
    }
}

private struct CardRow: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID
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

private struct ContentRow: Decodable { let content: String }

extension StudyStore {
    /// The site's course palette (COURSE_COLORS), taken in turn.
    static let courseColors = ["#0f9b8e", "#e5484d", "#f08c00", "#d6409f", "#2f9e44", "#3b6fe0", "#8e4ec6", "#1b2250"]

    func createCourse(name: String) async throws -> Course {
        let now = ISO.string(.now)
        let row = NewCourseRow(id: UUID(), name: String(name.trimmingCharacters(in: .whitespaces).prefix(120)), color: Self.courseColors[courses.count % Self.courseColors.count], exam_date: nil, created_at: now, updated_at: now)
        try await supabase.from("courses").insert(row).execute()
        await load()
        guard let course = courses.first(where: { $0.id == row.id }) else { throw AIClient.Failure(message: "Ders kaydedilemedi.", code: nil) }
        return course
    }

    /// Saves the note unprepared first, so the text is never lost if preparing fails.
    func createNote(course: Course, title: String, content: String) async throws -> UUID {
        let now = ISO.string(.now)
        let id = UUID()
        let row = NewNoteRow(id: id, course_id: course.id, title: String(title.trimmingCharacters(in: .whitespacesAndNewlines).prefix(NoteLimits.maxTitle)), content: content, summary: .null, questions: [], practice: [], generator: nil, created_at: now, updated_at: now)
        try await supabase.from("notes").insert(row).execute()
        return id
    }

    func noteContent(_ noteId: UUID) async throws -> String {
        let row: ContentRow = try await supabase.from("notes").select("content").eq("id", value: noteId).single().execute().value
        return row.content
    }

    /// Writes a prepared set onto a note: summary, questions, practice, generator "ai", and its cards.
    /// Cards nobody has studied yet are replaced; studied cards keep their progress (applyGenerated).
    func applyStudySet(_ set: StudySet, noteId: UUID, courseId: UUID) async throws {
        let now = Date.now
        let stamp = ISO.string(now)
        let update = PreparedNoteUpdate(
            summary: .init(overview: set.overview, points: set.points, keyTerms: set.keyTerms, sourceChanged: false),
            questions: set.questions, practice: set.practice, generator: "ai", updated_at: stamp
        )
        try await supabase.from("notes").update(update).eq("id", value: noteId).execute()

        let existing = cards.filter { $0.noteId == noteId }
        let stale = existing.filter { $0.reps == 0 && $0.lapses == 0 }
        let keptFronts = Set(existing.filter { !($0.reps == 0 && $0.lapses == 0) }.map(\.front))
        if !stale.isEmpty {
            try await supabase.from("cards").delete().in("id", values: stale.map(\.id)).execute()
        }
        let rows = set.cards.filter { !keptFronts.contains($0.front) }.map { c in
            CardRow(id: UUID(), course_id: courseId, note_id: noteId, front: c.front, back: c.back, source: c.source, due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0, created_at: stamp, updated_at: stamp)
        }
        for chunk in stride(from: 0, to: rows.count, by: 500).map({ Array(rows[$0..<min($0 + 500, rows.count)]) }) {
            try await supabase.from("cards").insert(chunk).execute()
        }
        await load()
    }
}
