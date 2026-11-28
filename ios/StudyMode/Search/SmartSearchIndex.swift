import CryptoKit
import Foundation
import Supabase

/// Meaning search ("Akıllı arama", Premium): each note is turned into 768 numbers once with the site's
/// `embed` task (gemini-embedding-001 on the server) and kept on this device, like the site keeps them
/// in the browser (studymode.embeddings.v2.<courseId>). Nothing is written to Supabase.
///
/// Files: Application Support/SmartSearch/v2/<userId>/<courseId>.json, one per course. Each vector carries
/// a fingerprint of the text it was made from, so a note edited here or on the site counts as "not
/// ready" again instead of being searched with an old vector (the site does not do this yet).
/// Signing out or deleting the account removes the whole SmartSearch folder.
@MainActor
@Observable
final class SmartSearchIndex {
    static let shared = SmartSearchIndex()

    struct Progress: Equatable { var done: Int; var total: Int }

    private struct Entry: Codable { var v: [Double]; var h: String }
    private struct CourseFile: Codable { var notes: [String: Entry] = [:] }

    /// `kind` (site PR #138): "document" for notes, "query" for the search box, so the server asks Gemini
    /// for RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY vectors. A server without the field ignores it.
    private enum Kind: String, Encodable { case document, query }
    private struct EmbedInput: Encodable { let texts: [String]; let kind: Kind }
    private struct EmbedOutput: Decodable { let embeddings: [[Double]] }

    private(set) var userId: UUID?
    /// Set from PremiumStore; the server decides in the end (403 premium_only).
    var isPremium = false
    /// The note being prepared, shown as "Hazırlanıyor 3/10".
    private(set) var progress: Progress?
    private var files: [UUID: CourseFile] = [:]
    private var queryCache: [String: [Double]] = [:]

    private init() {}

    func configure(user: UUID?) {
        guard user != userId else { return }
        userId = user
        files = [:]
        queryCache = [:]
        progress = nil
        Self.dropOldVersions()
    }

    // MARK: Files

    private static var root: URL {
        let base = (try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? FileManager.default.temporaryDirectory
        return base.appending(path: "SmartSearch", directoryHint: .isDirectory)
    }

    /// Vectors of this format (site: studymode.embeddings.v2.*). v1 vectors were all made as documents,
    /// so they would not compare well with v2 query vectors; they are dropped, never mixed.
    private static let version = "v2"

    private static var versionRoot: URL {
        root.appending(path: version, directoryHint: .isDirectory)
    }

    /// Removes anything under SmartSearch that is not the current version (older layouts).
    private static func dropOldVersions() {
        let fm = FileManager.default
        guard let items = try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) else { return }
        for item in items where item.lastPathComponent != version { try? fm.removeItem(at: item) }
    }

    private func url(_ course: UUID) -> URL? {
        guard let userId else { return nil }
        return Self.versionRoot
            .appending(path: userId.uuidString.lowercased(), directoryHint: .isDirectory)
            .appending(path: "\(course.uuidString.lowercased()).json")
    }

    private func file(_ course: UUID) -> CourseFile {
        if let cached = files[course] { return cached }
        var loaded = CourseFile()
        if let url = url(course), let data = try? Data(contentsOf: url), let decoded = try? JSONDecoder().decode(CourseFile.self, from: data) {
            loaded = decoded
        }
        files[course] = loaded
        return loaded
    }

    private func save(_ course: UUID, _ value: CourseFile) {
        files[course] = value
        guard let url = url(course) else { return }
        do {
            if value.notes.isEmpty {
                try? FileManager.default.removeItem(at: url)
                return
            }
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            var attributes = URLResourceValues()
            attributes.isExcludedFromBackup = true
            try JSONEncoder().encode(value).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var target = url
            try? target.setResourceValues(attributes)
        } catch {
            // Disk full: search still works for this session from memory.
        }
    }

    /// Sign-out and account deletion: every account's vectors on this device go.
    static func clearAll() {
        try? FileManager.default.removeItem(at: root)
        shared.files = [:]
        shared.queryCache = [:]
        shared.progress = nil
        shared.userId = nil
    }

    // MARK: Reading

    static func fingerprint(_ note: SearchNote) -> String {
        let digest = SHA256.hash(data: Data(SemanticSearch.embeddingText(note).utf8))
        return digest.prefix(8).map { String(format: "%02x", $0) }.joined()
    }

    /// noteId → vector for these courses, only vectors made from the note's current text.
    func vectors(for notes: [SearchNote]) -> [String: [Double]] {
        var out: [String: [Double]] = [:]
        for note in notes {
            if let entry = file(note.courseId).notes[note.key], entry.v.count == SemanticSearch.dims, entry.h == Self.fingerprint(note) {
                out[note.key] = entry.v
            }
        }
        return out
    }

    /// Notes with no vector yet, or whose text changed since.
    func missing(_ notes: [SearchNote]) -> [SearchNote] {
        let have = vectors(for: notes)
        return notes.filter { have[$0.key] == nil }
    }

    /// Has any vector for the course (site: Object.keys(embeddings).length > 0).
    func hasVectors(course: UUID) -> Bool { !file(course).notes.isEmpty }

    // MARK: Notes' text

    /// The notes with their text, as the site keeps them in memory. 1000 rows a page (PostgREST limit).
    static func fetchNotes(course: UUID? = nil, ids: [UUID]? = nil) async throws -> [SearchNote] {
        var all: [SearchNote] = []
        var from = 0
        let page = 1000
        while true {
            var query = supabase.from("notes").select(SearchNote.columns)
            if let course { query = query.eq("course_id", value: course) }
            if let ids { query = query.in("id", values: ids) }
            let rows: [SearchNote] = try await query.order("created_at", ascending: false).range(from: from, to: from + page - 1).execute().value
            all += rows
            if rows.count < page { return all }
            from += page
        }
    }

    // MARK: Embedding

    /// embedTexts on the site: 25 texts a request (the server takes 25), each vector shortened to 768.
    private static func embed(_ texts: [String], kind: Kind = .document) async throws -> [[Double]] {
        var out: [[Double]] = []
        for start in stride(from: 0, to: texts.count, by: 25) {
            let batch = Array(texts[start..<min(start + 25, texts.count)])
            let answer = try await AIClient.run("embed", EmbedInput(texts: batch, kind: kind), as: EmbedOutput.self)
            out += answer.embeddings.map(SemanticSearch.compact)
        }
        return out
    }

    /// "Akıllı aramayı aç" / "Notlarımı hazırla": vectors for the notes that have none (or an old one).
    func prepare(_ notes: [SearchNote]) async throws {
        let todo = missing(notes)
        guard !todo.isEmpty, progress == nil else { return }
        progress = Progress(done: 0, total: todo.count)
        defer { progress = nil }
        for start in stride(from: 0, to: todo.count, by: 25) {
            let batch = Array(todo[start..<min(start + 25, todo.count)])
            let out = try await Self.embed(batch.map(SemanticSearch.embeddingText))
            store(batch, out)
            progress = Progress(done: min(todo.count, start + batch.count), total: todo.count)
        }
    }

    private func store(_ notes: [SearchNote], _ vectors: [[Double]]) {
        var changed: [UUID: CourseFile] = [:]
        for (index, note) in notes.enumerated() where index < vectors.count && !vectors[index].isEmpty {
            var f = changed[note.courseId] ?? file(note.courseId)
            f.notes[note.key] = Entry(v: vectors[index], h: Self.fingerprint(note))
            changed[note.courseId] = f
        }
        for (course, f) in changed { save(course, f) }
    }

    /// The query's vector; the same text is asked once per session.
    func queryVector(_ text: String) async throws -> [Double] {
        if let hit = queryCache[text] { return hit }
        guard let v = try await Self.embed([text], kind: .query).first, !v.isEmpty else { throw AIClient.Failure(message: AIClient.formatError, code: "bad_output") }
        queryCache[text] = v
        return v
    }

    // MARK: Notes that changed

    /// A note was edited or prepared again (here). Its old vector is dropped; if the course already uses
    /// meaning search (and the account is Premium), a fresh vector is made right away. A moved note's
    /// vector moves to the new course.
    func noteChanged(_ id: UUID, from oldCourse: UUID, to newCourse: UUID) async {
        guard userId != nil else { return }
        let key = id.uuidString.lowercased()
        var old = file(oldCourse)
        let had = old.notes.removeValue(forKey: key) != nil
        if had { save(oldCourse, old) }
        guard isPremium, had || hasVectors(course: newCourse) else { return }
        do {
            guard let note = try await Self.fetchNotes(ids: [id]).first else { return }
            let out = try await Self.embed([SemanticSearch.embeddingText(note)])
            store([note], out)
        } catch {
            // Offline or limit: the note shows as "not ready" and is prepared with the next batch.
        }
    }

    func noteDeleted(_ id: UUID, course: UUID) {
        var f = file(course)
        if f.notes.removeValue(forKey: id.uuidString.lowercased()) != nil { save(course, f) }
    }

    func courseDeleted(_ course: UUID) {
        save(course, CourseFile())
    }

    // MARK: Messages

    /// Plain Turkish for what went wrong; word search keeps working in every case.
    static func message(_ error: Error) -> String {
        guard let failure = error as? AIClient.Failure else { return "Akıllı arama şu an çalışmadı. Kelimeyle arama yine çalışıyor." }
        switch failure.code {
        case "premium_only":
            return "Akıllı arama Premium'a özel. Kelimeyle arama yine çalışıyor."
        case "network", "timeout":
            return "İnternete bağlanılamadı; şimdilik yalnızca kelimeyle arıyorum."
        case "unauthorized":
            return failure.message
        case "daily_limit", "quota", "busy":
            return failure.message + " Kelimeyle arama yine çalışıyor."
        default:
            return "Akıllı arama şu an çalışmadı. Kelimeyle arama yine çalışıyor."
        }
    }
}
