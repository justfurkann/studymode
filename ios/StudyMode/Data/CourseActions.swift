import Foundation
import Supabase

/// Course edit, delete and share, ported from the site's store.updateCourse / deleteCourse and
/// src/lib/share.ts. A share is a content-only snapshot (no progress, answers or scores) behind an
/// unguessable link: https://studymode.fun/paylas/<token>.
enum CourseColors {
    /// COURSE_COLORS on the site.
    static let all = ["#0f9b8e", "#e5484d", "#f08c00", "#d6409f", "#2f9e44", "#3b6fe0", "#8e4ec6", "#1b2250"]
}

struct CourseShare: Decodable, Identifiable {
    let id: UUID
    let token: String
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, token
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var url: URL { Config.siteURL.appending(path: "paylas/\(token)") }
}

struct ShareFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct CoursePatch: Encodable { let name: String; let color: String; let updated_at: String }

private struct ShareNoteRow: Decodable {
    let id: UUID
    let title: String
    let content: String
    let summary: AnyJSON?
    let questions: AnyJSON?
    let practice: AnyJSON?
    let generator: String?
    let created_at: String
}

private struct NewShare: Encodable {
    let token: String
    let course_id: UUID
    let title: String
    let owner_name: String?
    let snapshot: AnyJSON
}

private struct SharePatch: Encodable { let title: String; let snapshot: AnyJSON; let updated_at: String }

extension StudyStore {
    func editCourse(_ course: Course, name: String, color: String) async throws {
        try await supabase.from("courses").update(CoursePatch(name: name, color: color, updated_at: ISO.string(.now))).eq("id", value: course.id).execute()
        await load()
    }

    /// The database cascades to the course's notes, cards, tests, exams and shares.
    func deleteCourse(_ course: Course) async throws {
        try await supabase.from("courses").delete().eq("id", value: course.id).execute()
        SmartSearchIndex.shared.courseDeleted(course.id)
        await load()
    }

    // MARK: Sharing

    static let maxShareBytes = 2_500_000

    private func shareError(_ error: Error, _ fallback: String) -> ShareFailure {
        if let e = error as? PostgrestError, ["PGRST205", "42P01", "PGRST202", "42883"].contains(e.code ?? "") {
            return ShareFailure(message: "Paylaşım özelliği için veritabanı güncellemesi bekleniyor. Biraz sonra yeniden dene.")
        }
        return ShareFailure(message: fallback)
    }

    func currentShare(of course: Course) async throws -> CourseShare? {
        do {
            let rows: [CourseShare] = try await supabase.from("course_shares").select("id,token,created_at,updated_at").eq("course_id", value: course.id).order("created_at", ascending: false).execute().value
            return rows.first
        } catch {
            throw shareError(error, "Paylaşımlar yüklenemedi.")
        }
    }

    /// buildSnapshot: notes oldest first, cards point at their note by index, upcoming exams only.
    func shareSnapshot(of course: Course, now: Date = .now) async throws -> (snapshot: AnyJSON, notes: Int, cards: Int, questions: Int, exams: Int) {
        let rows: [ShareNoteRow] = try await supabase.from("notes").select("id,title,content,summary,questions,practice,generator,created_at").eq("course_id", value: course.id).order("created_at").execute().value
        var index: [UUID: Int] = [:]
        for (i, row) in rows.enumerated() { index[row.id] = i }

        func list(_ value: AnyJSON?) -> [[String: AnyJSON]] {
            guard case let .array(items)? = value else { return [] }
            return items.compactMap { if case let .object(o) = $0 { o } else { nil } }
        }
        func pick(_ o: [String: AnyJSON], _ keys: [String]) -> AnyJSON {
            var out: [String: AnyJSON] = [:]
            for k in keys { out[k] = o[k] ?? .null }
            return .object(out)
        }

        var questionCount = 0
        let notes: [AnyJSON] = rows.map { row in
            var summary: AnyJSON = .null
            if case let .object(s)? = row.summary {
                var clean: [String: AnyJSON] = [
                    "overview": s["overview"] ?? .string(""),
                    "points": s["points"] ?? .array([]),
                    "keyTerms": s["keyTerms"] ?? .array([]),
                ]
                if case let .array(tags)? = s["tags"], !tags.isEmpty { clean["tags"] = .array(tags) }
                summary = .object(clean)
            }
            let questions = list(row.questions).map { pick($0, ["prompt", "options", "answerIndex", "explanation", "source"]) }
            questionCount += questions.count
            let practice = list(row.practice).map { pick($0, ["question", "answer", "hint"]) }
            return .object([
                "title": .string(row.title),
                "content": .string(row.content),
                "summary": summary,
                "questions": .array(questions),
                "practice": .array(practice),
                "generator": row.generator.map(AnyJSON.string) ?? .null,
            ])
        }

        let courseCards = cards.filter { $0.courseId == course.id }
        let cardJSON: [AnyJSON] = courseCards.map { c in
            .object([
                "front": .string(c.front),
                "back": .string(c.back),
                "source": c.source.map(AnyJSON.string) ?? .null,
                "note": c.noteId.flatMap { index[$0] }.map { .integer($0) } ?? .null,
            ])
        }

        let examJSON: [AnyJSON] = examsFor(course)
            .filter { !$0.isLegacy && (Exams.daysLeft($0, now: now) ?? -1) >= 0 }
            .map { e in
                let noteIndexes = e.noteIds.compactMap { UUID(uuidString: $0) }.compactMap { index[$0] }
                return .object([
                    "kind": .string(e.kind.rawValue),
                    "title": e.title.map(AnyJSON.string) ?? .null,
                    "date": .string(e.date),
                    "weight": e.weight.map { .double($0) } ?? .null,
                    "notes": .array(noteIndexes.map { .integer($0) }),
                ])
            }

        let snapshot: AnyJSON = .object([
            "v": .integer(1),
            "course": .object(["name": .string(course.name), "color": .string(course.color)]),
            "notes": .array(notes),
            "cards": .array(cardJSON),
            "exams": .array(examJSON),
        ])
        if let data = try? JSONEncoder().encode(snapshot), data.count > Self.maxShareBytes {
            throw ShareFailure(message: "Bu ders paylaşmak için çok büyük. Çok uzun notlardan birkaçını çıkarıp yeniden dene.")
        }
        return (snapshot, rows.count, courseCards.count, questionCount, examJSON.count)
    }

    /// 22 characters from 62 symbols (about 131 bits), like newToken.
    static func newShareToken(length: Int = 22) -> String {
        let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        var out = ""
        var rng = SystemRandomNumberGenerator()
        while out.count < length {
            let byte = UInt8.random(in: 0...255, using: &rng)
            if byte < 248 { out.append(alphabet[Int(byte) % 62]) }
        }
        return out
    }

    func createShare(of course: Course, snapshot: AnyJSON, ownerName: String?) async throws -> CourseShare {
        do {
            return try await supabase.from("course_shares")
                .insert(NewShare(token: Self.newShareToken(), course_id: course.id, title: course.name, owner_name: ownerName.map { String($0.prefix(80)) }, snapshot: snapshot))
                .select("id,token,created_at,updated_at").single().execute().value
        } catch {
            throw shareError(error, "Bağlantı oluşturulamadı. İnternet bağlantını kontrol edip yeniden dene.")
        }
    }

    func updateShare(_ share: CourseShare, course: Course, snapshot: AnyJSON) async throws -> CourseShare {
        do {
            return try await supabase.from("course_shares")
                .update(SharePatch(title: course.name, snapshot: snapshot, updated_at: ISO.string(.now)))
                .eq("id", value: share.id)
                .select("id,token,created_at,updated_at").single().execute().value
        } catch {
            throw shareError(error, "Bağlantı güncellenemedi.")
        }
    }

    func deleteShare(_ share: CourseShare) async throws {
        do {
            try await supabase.from("course_shares").delete().eq("id", value: share.id).execute()
        } catch {
            throw shareError(error, "Paylaşım kapatılamadı.")
        }
    }
}
