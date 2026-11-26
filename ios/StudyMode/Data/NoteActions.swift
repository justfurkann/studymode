import Foundation
import Supabase

/// Note actions from the site's NoteDetail menu and summary tab: edit, delete, "Bu konuyu anlamadım"
/// (task `explain`) and "Tam özet" (task `detail`). Every write touches only the columns it changes;
/// the summary JSON is read fresh and written back whole with one field changed.
enum NoteAI {
    enum ExplainMode: String, CaseIterable, Identifiable {
        case simple, example, step_by_step
        var id: String { rawValue }
        var label: String {
            switch self {
            case .simple: "Daha basit anlat"
            case .example: "Günlük hayattan örnek ver"
            case .step_by_step: "Bana adım adım öğret"
            }
        }
    }

    private struct ExplainInput: Encodable { let title, topic, context, mode: String }
    private struct ExplainOutput: Decodable { let explanation: String? }

    static func explain(title: String, topic: String, content: String, mode: ExplainMode) async throws -> String {
        let input = ExplainInput(title: title, topic: topic, context: contextAround(content, topic: topic), mode: mode.rawValue)
        let output: ExplainOutput
        do {
            output = try await AIClient.run("explain", input, as: ExplainOutput.self)
        } catch {
            // The site tries once more before giving up.
            output = try await AIClient.run("explain", input, as: ExplainOutput.self)
        }
        let text = (output.explanation ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw AIClient.Failure(message: "Açıklama hazırlanamadı. Tekrar dener misin?", code: "empty") }
        return text
    }

    /// The part of a long note around where `topic` is discussed (contextAround in tasks.ts).
    static func contextAround(_ text: String, topic: String, budget: Int = 8_000) -> String {
        guard text.count > budget else { return text }
        let tr = Locale(identifier: "tr_TR")
        let lower = text.lowercased(with: tr)
        let words = topic.lowercased(with: tr)
            .components(separatedBy: CharacterSet.letters.union(.decimalDigits).inverted)
            .filter { $0.count >= 4 }
            .sorted { $0.count > $1.count }
        let phrase = String(topic.lowercased(with: tr).trimmingCharacters(in: .whitespaces).prefix(60))
        var found = phrase.isEmpty ? nil : lower.range(of: phrase)
        for word in words where found == nil { found = lower.range(of: word) }
        guard let found else { return trimmed(text, budget: budget) }
        let at = lower.distance(from: lower.startIndex, to: found.lowerBound)
        let start = max(0, min(at - budget / 3, text.count - budget))
        let from = text.index(text.startIndex, offsetBy: start)
        let to = text.index(from, offsetBy: budget, limitedBy: text.endIndex) ?? text.endIndex
        let body = text[from..<to].trimmingCharacters(in: .whitespacesAndNewlines)
        return (start > 0 ? "[…] " : "") + body + (to < text.endIndex ? " […]" : "")
    }

    /// Beginning, middle and end of a long text (trimNoteText).
    private static func trimmed(_ text: String, budget: Int) -> String {
        let third = budget / 3
        let chars = Array(text)
        let mid = (chars.count - third) / 2
        func part(_ a: Int, _ b: Int) -> String { String(chars[a..<min(b, chars.count)]).trimmingCharacters(in: .whitespacesAndNewlines) }
        return "\(part(0, third))\n\n[…]\n\n\(part(mid, mid + third))\n\n[…]\n\n\(part(chars.count - third, chars.count))"
    }

    // MARK: Tam özet

    private struct DetailInput: Encodable { let title: String; let text: String; let part: String? }
    private struct DetailOutput: Decodable {
        struct Section: Decodable { let heading: String?; let paragraphs: [String]?; let bullets: [String]?; let example: String? }
        let intro: String?
        let sections: [Section]?
        let takeaways: [String]?
    }

    /// Writes the detailed summary part by part (12.000 characters each, one after another, like
    /// generateDetailedSummary) and returns it as the JSON the site stores in summary.detailed.
    static func detailedSummary(title: String, content: String, progress: @escaping @MainActor (Int, Int) -> Void) async throws -> AnyJSON {
        let chunks = StudySetMaker.split(content, max: 12_000)
        var parts: [DetailOutput] = []
        var failed = 0
        var lastError: Error?
        for (i, chunk) in chunks.enumerated() {
            await progress(i, chunks.count)
            let input = DetailInput(title: title, text: chunk, part: chunks.count > 1 ? "Bölüm \(i + 1)/\(chunks.count)" : nil)
            do {
                do { parts.append(try await AIClient.run("detail", input, as: DetailOutput.self)) }
                catch { parts.append(try await AIClient.run("detail", input, as: DetailOutput.self)) }
            } catch {
                failed += 1
                lastError = error
            }
        }
        await progress(chunks.count, chunks.count)
        guard !parts.isEmpty else { throw lastError ?? AIClient.Failure(message: "Ayrıntılı özet hazırlanamadı.", code: "empty") }

        func clean(_ list: [String]?) -> [String] { (list ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty } }
        var seen = Set<String>()
        let takeaways = parts.flatMap { clean($0.takeaways) }.filter { seen.insert($0).inserted }.prefix(8)
        let sections: [AnyJSON] = parts.flatMap { $0.sections ?? [] }.compactMap { s in
            let heading = (s.heading ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let paragraphs = clean(s.paragraphs)
            let bullets = clean(s.bullets)
            guard !heading.isEmpty, !(paragraphs.isEmpty && bullets.isEmpty) else { return nil }
            return .object([
                "heading": .string(heading),
                "paragraphs": .array(paragraphs.map(AnyJSON.string)),
                "bullets": .array(bullets.map(AnyJSON.string)),
                "example": .string((s.example ?? "").trimmingCharacters(in: .whitespacesAndNewlines)),
            ])
        }
        var detailed: [String: AnyJSON] = [
            "intro": .string((parts[0].intro ?? "").trimmingCharacters(in: .whitespacesAndNewlines)),
            "sections": .array(sections),
            "takeaways": .array(takeaways.map(AnyJSON.string)),
            "createdAt": .string(ISO.string(.now)),
        ]
        if failed > 0 { detailed["failedParts"] = .integer(failed) }
        return .object(detailed)
    }
}

private struct RawSummary: Decodable { let summary: AnyJSON? }
private struct SummaryPatch: Encodable { let summary: AnyJSON; let updated_at: String }
private struct NoteEdit: Encodable {
    let title: String
    let content: String?
    let course_id: UUID
    let updated_at: String
}
private struct CourseMove: Encodable { let course_id: UUID; let updated_at: String }
private struct AttemptMove: Encodable { let course_id: UUID }
private struct ExamNotes: Encodable { let note_ids: [String]; let updated_at: String }

extension StudyStore {
    /// A written answer, an explanation or a detailed summary counts toward today's streak (recordActivity).
    func recordActivity() {
        let day = SRS.dayKey()
        enqueueWrite { [weak self] in
            try? await StudyDays.bump(day: day, actions: 1, into: self)
        }
    }

    /// Sets one field of the note's summary JSON, keeping everything else the site stores there.
    func setSummaryField(_ note: NoteItem, key: String, value: AnyJSON) async throws {
        let row: RawSummary = try await supabase.from("notes").select("summary").eq("id", value: note.id).single().execute().value
        guard case var .object(summary)? = row.summary else { return }
        summary[key] = value
        try await supabase.from("notes").update(SummaryPatch(summary: .object(summary), updated_at: ISO.string(.now))).eq("id", value: note.id).execute()
    }

    /// "Notu düzenle": title, text and course. A changed text marks the study set as out of date
    /// (summary.sourceChanged); moving to another course moves its cards and test results too.
    func editNote(_ note: NoteItem, title: String, content: String?, course: UUID) async throws {
        let stamp = ISO.string(.now)
        try await supabase.from("notes").update(NoteEdit(title: title, content: content, course_id: course, updated_at: stamp)).eq("id", value: note.id).execute()
        if content != nil, note.isPrepared {
            try await setSummaryField(note, key: "sourceChanged", value: .bool(true))
        }
        if course != note.courseId {
            try await supabase.from("cards").update(CourseMove(course_id: course, updated_at: stamp)).eq("note_id", value: note.id).execute()
            try await supabase.from("quiz_attempts").update(AttemptMove(course_id: course)).eq("note_id", value: note.id).execute()
        }
        await load()
    }

    /// "Notu sil": exams that listed this note keep their other notes (so they do not silently start
    /// covering the whole course); cards and test results go with the note (on delete cascade).
    func deleteNote(_ note: NoteItem) async throws {
        let id = note.id.uuidString.lowercased()
        let stamp = ISO.string(.now)
        for exam in exams where !exam.isLegacy && exam.noteIds.contains(where: { $0.lowercased() == id }) {
            let rest = exam.noteIds.filter { $0.lowercased() != id }
            try await supabase.from("course_exams").update(ExamNotes(note_ids: rest, updated_at: stamp)).eq("id", value: exam.id).execute()
        }
        try await supabase.from("notes").delete().eq("id", value: note.id).execute()
        await load()
    }
}
