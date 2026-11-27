import Foundation
import Supabase
import SwiftUI

/// The study assistant "Fosfor", ported from src/lib/assistant.ts and the site's Assistant.tsx: a quick
/// question about the open note or course, answered by the `chat` task from the course's notes. The
/// conversation is kept per course on this device for a week.

/// Which course and note the student is looking at, so Fosfor starts there (placeFromPath on the site).
@MainActor
@Observable
final class AssistantPlace {
    var courseId: UUID?
    var noteId: UUID?
    var open = false
    /// A question from somewhere in the app ("Anlamadım" under a point, a long-pressed paragraph,
    /// selected text). The open sheet picks it up and answers it right away.
    var pending: FosforAsk?
    /// How tall the sheet is. Questions from inside a note open half height, so the note stays in view.
    var detent: PresentationDetent = .large

    /// Course and note screens currently on screen, in the order they appeared. The floating Fosfor
    /// shows while one is open; the last one is what Fosfor talks about.
    private var screens: [(key: String, course: UUID, note: UUID?)] = []

    func enter(_ key: String, course: UUID, note: UUID?) {
        screens.removeAll { $0.key == key }
        screens.append((key, course, note))
        courseId = course
        noteId = note
    }

    func leave(_ key: String) {
        screens.removeAll { $0.key == key }
        courseId = screens.last?.course
        noteId = screens.last?.note
    }

    func show(course: UUID?, note: UUID?) {
        courseId = course
        noteId = note
        detent = .large
        open = true
    }

    /// Ask about a piece of a note: Fosfor opens half height over the note and answers at once.
    func ask(_ request: FosforAsk, course: UUID?, note: UUID?) {
        courseId = course
        noteId = note
        pending = request
        if !open { detent = .medium }
        open = true
    }
}

/// "I didn't get this": the exact text the student pointed at, where it sits in the note, and how to
/// explain it. `prompt` replaces the default question (e.g. "Neden bu cevap?" on a test question).
struct FosforAsk: Equatable, Identifiable {
    let id = UUID()
    var quote: String
    var source: String?
    var mode: NoteAI.ExplainMode = .simple
    var prompt: String? = nil

    var question: String { prompt ?? mode.question }
}

extension NoteAI.ExplainMode {
    /// What the student "says" when picking this way of explaining.
    var question: String {
        switch self {
        case .simple: "Bunu anlamadım, daha basit anlatır mısın?"
        case .example: "Günlük hayattan bir örnekle anlatır mısın?"
        case .step_by_step: "Bana bunu adım adım öğretir misin?"
        }
    }
    var shortLabel: String {
        switch self {
        case .simple: "Daha basit"
        case .example: "Örnekle"
        case .step_by_step: "Adım adım"
        }
    }
    var icon: String {
        switch self {
        case .simple: "text.bubble"
        case .example: "lightbulb"
        case .step_by_step: "list.number"
        }
    }
}

struct ChatMessage: Codable, Identifiable, Hashable {
    enum Role: String, Codable { case user, assistant }
    var id = UUID()
    let role: Role
    let text: String
    /// The answer was saved as a study card.
    var carded = false
    /// The part of the note the question is about, shown above the question.
    var quote: String? = nil
    /// Where the quote is from ("Ana nokta 3", "Tam özet", "Test sorusu").
    var source: String? = nil

    /// The text sent to the AI as this turn: the quote first, so follow-ups know what "bu" is.
    var turnText: String {
        guard let quote, !quote.isEmpty else { return text }
        return "“\(quote.prefix(700))”\n\(text)"
    }
}

enum Assistant {
    static let contextBudget = 16_000
    private static let currentNoteChars = 9_000
    private static let otherNoteChars = 2_500

    private struct NoteRow: Decodable {
        let id: UUID
        let title: String
        let content: String
        let updated_at: String?
        let summary: Summary?
        struct Summary: Decodable {
            let overview: String?
            let points: [String]?
            let keyTerms: [NoteSummary.KeyTerm]?
        }
    }

    /// The notes sent with a question: the open note first (more of it), then the course's other
    /// notes, newest first, until the budget is used (buildAssistantContext).
    static func context(course: UUID?, currentNote: UUID?) async throws -> String {
        guard let course else { return "" }
        let rows: [NoteRow] = try await supabase.from("notes").select("id,title,content,updated_at,summary").eq("course_id", value: course).execute().value
        let current = rows.first { $0.id == currentNote }
        let others = rows.filter { $0.id != current?.id }.sorted { ($0.updated_at ?? "") > ($1.updated_at ?? "") }
        var blocks: [String] = []
        var used = 0
        for note in (current.map { [$0] } ?? []) + others {
            let left = contextBudget - used
            if left < 300 { break }
            let isCurrent = note.id == current?.id
            let size = min(left - 60, isCurrent ? currentNoteChars : otherNoteChars)
            let text = digest(note, max: size)
            if text.isEmpty { continue }
            let block = "### \(note.title)\(isCurrent ? " (şu an açık)" : "")\n\(text)"
            blocks.append(block)
            used += block.count + 2
        }
        return blocks.joined(separator: "\n\n")
    }

    /// A note in a few lines: the summary when there is one, then the note's own words (noteDigest).
    private static func digest(_ note: NoteRow, max: Int) -> String {
        var parts: [String] = []
        if let o = note.summary?.overview?.trimmingCharacters(in: .whitespacesAndNewlines), !o.isEmpty { parts.append(o) }
        if let p = note.summary?.points, !p.isEmpty { parts.append(p.map { "- \($0)" }.joined(separator: "\n")) }
        if let k = note.summary?.keyTerms, !k.isEmpty { parts.append(k.map { "- \($0.term): \($0.definition)" }.joined(separator: "\n")) }
        var text = parts.joined(separator: "\n")
        let content = note.content.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.count < max, !content.isEmpty {
            let room = max - text.count - 2
            if room > 200 { text = [text, String(content.prefix(room))].filter { !$0.isEmpty }.joined(separator: "\n\n") }
        }
        return String(text.prefix(max))
    }

    private struct Turn: Encodable { let role: String; let text: String }
    private struct ChatInput: Encodable { let course: String; let context: String; let history: [Turn]; let question: String }
    private struct ChatOutput: Decodable { let reply: String? }

    static func ask(course: String, context: String, history: [ChatMessage], question: String) async throws -> String {
        let input = ChatInput(
            course: course,
            context: String(context.prefix(18_000)),
            history: history.suffix(10).map { Turn(role: $0.role.rawValue, text: String($0.turnText.prefix(1_500))) },
            question: String(question.prefix(2_000))
        )
        let output = try await AIClient.run("chat", input, as: ChatOutput.self)
        let reply = (output.reply ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !reply.isEmpty else { throw AIClient.Failure(message: "Fosfor şu an cevap veremedi. Biraz sonra tekrar dene.", code: "empty") }
        return reply
    }

    /// Starter questions for where the student is (suggestionsFor).
    static func suggestions(note: Bool, course: Bool) -> [(label: String, icon: String)] {
        if note {
            return [("Bu notu 3 maddede özetle", "list.bullet"), ("Bu nottan bana soru sor", "questionmark.circle"),
                    ("En zor kısmı basitçe anlat", "lightbulb"), ("Sınavda ne çıkabilir?", "target")]
        }
        if course {
            return [("Bu dersin ana konuları ne?", "map"), ("Bana bir soru sor", "questionmark.circle"),
                    ("Sınavda ne çıkabilir?", "target"), ("Nereden başlamalıyım?", "lightbulb")]
        }
        return [("Nasıl daha verimli çalışırım?", "lightbulb"), ("Sınava 3 gün kaldı, plan yap", "clock"), ("Aralıklı tekrar nedir?", "list.bullet"),
                ("Odaklanamıyorum, ne yapayım?", "scope")]
    }

    /// A reply as plain text for a card: no ** marks (plainReply).
    static func plain(_ text: String) -> String {
        text.replacingOccurrences(of: #"\*\*([^*\n]+)\*\*"#, with: "$1", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// A reply with **bold** shown bold; everything else plain.
    static func styled(_ text: String) -> AttributedString {
        var out = AttributedString()
        var rest = Substring(text)
        while let open = rest.range(of: "**"), let close = rest[open.upperBound...].range(of: "**"),
              !rest[open.upperBound..<close.lowerBound].contains("\n") {
            out += AttributedString(String(rest[..<open.lowerBound]))
            var bold = AttributedString(String(rest[open.upperBound..<close.lowerBound]))
            bold.inlinePresentationIntent = .stronglyEmphasized
            out += bold
            rest = rest[close.upperBound...]
        }
        out += AttributedString(String(rest))
        return out
    }

    // MARK: Conversation kept on this device

    private static let key = "studymode.assistant.v2"
    private static let ttl: TimeInterval = 7 * 24 * 60 * 60
    private struct Entry: Codable { let at: Date; let messages: [ChatMessage] }

    private static func all() -> [String: Entry] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([String: Entry].self, from: data) else { return [:] }
        return decoded.filter { Date.now.timeIntervalSince($0.value.at) < ttl }
    }

    /// "" is the general conversation (no course picked).
    static func load(course: UUID?) -> [ChatMessage] { all()[course?.uuidString ?? ""]?.messages ?? [] }

    static func save(_ messages: [ChatMessage], course: UUID?) {
        var store = all()
        let id = course?.uuidString ?? ""
        if messages.isEmpty { store[id] = nil } else { store[id] = Entry(at: .now, messages: Array(messages.suffix(40))) }
        if let data = try? JSONEncoder().encode(store) { UserDefaults.standard.set(data, forKey: key) }
    }

    /// Signing out forgets every conversation on this device.
    static func clearAll() { UserDefaults.standard.removeObject(forKey: key) }
}

private struct NewAssistantCard: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID?
    let front: String
    let back: String
    let source: String
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let created_at: String
    let updated_at: String
}

extension StudyStore {
    /// "Karta çevir": the question on the front, Fosfor's answer on the back (cardFromAnswer).
    func addAssistantCard(course: UUID, note: UUID?, question: String, answer: String) async throws {
        var front = question.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        if front.count > 200 { front = String(front.prefix(197)) + "…" }
        let back = String(Assistant.plain(answer).prefix(1_200))
        let stamp = ISO.string(.now)
        let row = NewAssistantCard(id: UUID(), course_id: course, note_id: note, front: front, back: back, source: "Fosfor",
                                   due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0, created_at: stamp, updated_at: stamp)
        try await supabase.from("cards").insert(row).execute()
        addCardsLocally([Card(id: row.id, courseId: course, noteId: note, front: front, back: back, source: "Fosfor", due: stamp, interval: 0, ease: 2.5, reps: 0, lapses: 0)])
    }
}
