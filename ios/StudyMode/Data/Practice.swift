import Foundation
import Supabase

/// Step 5, "Anlat": a note's open questions (notes.practice), the student's own written answers and
/// their AI grading, ported from the site's PracticeTab.tsx and practice.ts.
struct PracticeItem: Decodable, Identifiable, Hashable {
    struct Evaluation: Decodable, Hashable {
        let score: Double
        let feedback: String
        let gradedAt: String?
    }

    let id: String
    let question: String
    /// Model answer; notes prepared in the site's simple mode have none.
    let answer: String?
    let hint: String?
    var draft: String?
    var evaluation: Evaluation?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        question = (try? c.decode(String.self, forKey: .question)) ?? ""
        answer = try? c.decodeIfPresent(String.self, forKey: .answer)
        hint = try? c.decodeIfPresent(String.self, forKey: .hint)
        draft = try? c.decodeIfPresent(String.self, forKey: .draft)
        evaluation = try? c.decodeIfPresent(Evaluation.self, forKey: .evaluation)
    }

    enum CodingKeys: String, CodingKey { case id, question, answer, hint, draft, evaluation }
}

enum Practice {
    /// A written answer counts once it says something: a few words, not "bilmiyorum" (isMeaningfulAnswer).
    static func isMeaningful(_ text: String?) -> Bool {
        let trimmed = (text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.filter({ !$0.isWhitespace }).count >= 20 else { return false }
        let words = trimmed.split(whereSeparator: \.isWhitespace).filter { $0.contains(where: \.isLetter) }
        return words.count >= 4
    }

    /// The step can be finished after at least one real answer or grading (canCompletePractice).
    static func canComplete(_ items: [PracticeItem]) -> Bool {
        items.contains { isMeaningful($0.draft) || $0.evaluation != nil }
    }

    private struct GradeInput: Encodable {
        struct Item: Encodable { let question, modelAnswer, criteria, answer: String }
        let items: [Item]
    }

    private struct GradeOutput: Decodable {
        struct Result: Decodable { let score: Double?; let feedback: String? }
        let results: [Result]?
    }

    /// AI grading of one answer (the site's gradeAnswers, task "grade"); score 0...1.
    static func grade(_ item: PracticeItem, answer: String) async throws -> PracticeItem.Evaluation {
        let input = GradeInput(items: [.init(question: item.question, modelAnswer: item.answer ?? "", criteria: item.hint ?? "", answer: String(answer.prefix(10000)))])
        let output = try await AIClient.run("grade", input, as: GradeOutput.self)
        guard let result = output.results?.first else {
            throw AIClient.Failure(message: "Cevabın değerlendirilemedi. Tekrar deneyebilirsin.", code: "empty")
        }
        return .init(score: min(max(result.score ?? 0, 0), 1), feedback: (result.feedback ?? "").trimmingCharacters(in: .whitespacesAndNewlines), gradedAt: ISO.string(.now))
    }
}

private struct PracticeRow: Decodable { let practice: [PracticeItem]? }
private struct RawPracticeRow: Decodable { let practice: AnyJSON? }
private struct PracticeUpdate: Encodable {
    let practice: AnyJSON
    let updated_at: String
}

extension StudyStore {
    func practice(for note: NoteItem) async throws -> [PracticeItem] {
        let row: PracticeRow = try await supabase.from("notes").select("practice").eq("id", value: note.id).single().execute().value
        return (row.practice ?? []).filter { !$0.question.isEmpty }
    }

    /// Saves a written answer (and its grading) into the note's practice list. The list is read fresh
    /// and written back as raw JSON with only this item's `draft` / `evaluation` changed. The first real
    /// answer to a question also counts as today's study (study_days.actions), like the site.
    func savePractice(note: NoteItem, itemId: String, draft: String, evaluation: PracticeItem.Evaluation?, countsAsActivity: Bool) {
        let day = SRS.dayKey()
        if countsAsActivity {
            if let index = days.firstIndex(where: { $0.day == day }) {
                let d = days[index]
                days[index] = StudyDayCount(day: d.day, reviews: d.reviews, quizzes: d.quizzes, actions: (d.actions ?? 0) + 1, newCards: d.newCards)
            } else {
                days.insert(StudyDayCount(day: day, reviews: 0, quizzes: 0, actions: 1, newCards: 0), at: 0)
            }
        }
        let evaluationJSON: AnyJSON? = evaluation.map {
            .object([
                "score": .double($0.score),
                "feedback": .string($0.feedback),
                "gradedAt": .string($0.gradedAt ?? ISO.string(.now)),
            ])
        }
        enqueueWrite { [weak self] in
            do {
                let row: RawPracticeRow = try await supabase.from("notes").select("practice").eq("id", value: note.id).single().execute().value
                guard case var .array(items)? = row.practice else { return }
                guard let index = items.firstIndex(where: { item in
                    if case let .object(fields) = item, case let .string(id)? = fields["id"] { return id == itemId }
                    return false
                }), case var .object(fields) = items[index] else { return }
                fields["draft"] = .string(draft)
                if let evaluationJSON { fields["evaluation"] = evaluationJSON }
                items[index] = .object(fields)
                try await supabase.from("notes").update(PracticeUpdate(practice: .array(items), updated_at: ISO.string(.now))).eq("id", value: note.id).execute()
                if countsAsActivity { try await StudyDays.bump(day: day, actions: 1) }
            } catch {
                await MainActor.run { self?.saveError = "Cevabın kaydedilemedi. İnternet bağlantını kontrol et." }
            }
        }
    }
}
