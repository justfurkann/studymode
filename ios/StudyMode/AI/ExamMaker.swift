import Foundation

// MARK: - Exam Plan & Question Models (mirrors src/lib/examPlan.ts, src/lib/exam.ts, src/lib/ai/tasks.ts)

enum MockExamDifficulty: String, Codable, CaseIterable, Identifiable {
    case easy, medium, hard
    var id: String { rawValue }

    var label: String {
        switch self {
        case .easy: "Kolay"
        case .medium: "Orta"
        case .hard: "Zor"
        }
    }
}

struct MockExamPlan: Codable, Equatable {
    var mcqCount: Int = 10
    var openCount: Int = 0
    var blankCount: Int = 0
    var distractorCount: Int = 3
    var minutes: Int = 30
    var difficulty: MockExamDifficulty = .medium
    var info: String = ""
    var pastQuestions: String = ""

    static let mcqOptions = [0, 5, 10, 15, 20, 25, 30]
    static let openOptions = [0, 1, 2, 3, 4, 5, 6, 8, 10]
    static let blankOptions = [0, 4, 5, 6, 8, 10, 12]
    static let distractorOptions = [0, 2, 3, 4, 5, 6]
    static let minuteOptions = [0, 15, 30, 45, 60, 75, 90, 120]
    static let infoMax = 2000

    var totalQuestions: Int {
        mcqCount + openCount + blankCount
    }

    var format: String {
        if openCount == 0 && blankCount == 0 { return "test" }
        if mcqCount == 0 && blankCount == 0 { return "classic" }
        return "mixed"
    }

    private static let storeKey = "studymode.examPlan.v1"

    static func load(courseId: UUID, examId: String?) -> MockExamPlan {
        guard let rawData = UserDefaults.standard.string(forKey: storeKey)?.data(using: .utf8),
              let dict = try? JSONDecoder().decode([String: MockExamPlan].self, from: rawData) else {
            return MockExamPlan()
        }
        let specificKey = "\(courseId.uuidString.lowercased()):\(examId ?? "-")"
        let courseKey = "\(courseId.uuidString.lowercased()):-"
        var plan = dict[specificKey] ?? dict[courseKey] ?? MockExamPlan()
        if plan.totalQuestions == 0 { plan.mcqCount = 10 }
        return plan
    }

    static func save(_ plan: MockExamPlan, courseId: UUID, examId: String?) {
        var dict: [String: MockExamPlan] = [:]
        if let rawData = UserDefaults.standard.string(forKey: storeKey)?.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String: MockExamPlan].self, from: rawData) {
            dict = decoded
        }
        dict["\(courseId.uuidString.lowercased()):\(examId ?? "-")"] = plan
        dict["\(courseId.uuidString.lowercased()):-"] = plan
        if let encoded = try? JSONEncoder().encode(dict), let str = String(data: encoded, encoding: .utf8) {
            UserDefaults.standard.set(str, forKey: storeKey)
        }
    }
}

enum MockQuestionType: String, Codable, Hashable {
    case mcq, open, blank

    var badge: String {
        switch self {
        case .mcq: "TEST"
        case .blank: "BOŞLUK DOLDURMA"
        case .open: "KLASİK YAZILI"
        }
    }
}

struct MockExamQuestion: Identifiable, Codable, Hashable {
    let id: String
    let type: MockQuestionType
    let prompt: String
    let options: [String]
    let answerIndex: Int
    let explanation: String
    let modelAnswer: String
    let source: String?
    var noteTitle: String?
    var noteId: String?

    /// Splits a `blank` prompt around `"_____"`.
    var blankParts: (before: String, after: String) {
        guard let range = prompt.range(of: "_____") else { return (prompt, "") }
        return (String(prompt[..<range.lowerBound]), String(prompt[range.upperBound...]))
    }
}

/// Encodes directly as JSON `null`, `Int` (for mcq/blank index), or `String` (for open answer),
/// matching `src/lib/examSession.ts` `ExamAnswer` (`number | string | null`) 1:1!
enum MockExamAnswer: Codable, Equatable, Hashable {
    case none
    case choice(Int)
    case text(String)

    var isAnswered: Bool {
        switch self {
        case .none: false
        case .choice: true
        case let .text(s): !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .none
        } else if let idx = try? c.decode(Int.self) {
            self = .choice(idx)
        } else if let str = try? c.decode(String.self) {
            self = .text(str)
        } else {
            self = .none
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .none:
            try c.encodeNil()
        case let .choice(idx):
            try c.encode(idx)
        case let .text(str):
            try c.encode(str)
        }
    }
}

struct MockExamEvaluation {
    let scores: [Double]
    let feedback: [String]
    let total: Double
}

// MARK: - AI / Local Exam Generator & Grader

enum ExamMaker {
    private struct NotePayload: Encodable {
        let title: String
        let text: String
    }

    private struct ExamAPIInput: Encodable {
        let courseName: String
        let notes: [NotePayload]
        let format: String
        let count: Int
        let difficulty: String
        let pastQuestions: String
        let mcqCount: Int
        let openCount: Int
        let examInfo: String
        let blankCount: Int
        let distractorCount: Int
    }

    private struct RawExamResponse: Decodable {
        struct RawQuestion: Decodable {
            let type: String?
            let prompt: String?
            let options: [String]?
            let answerIndex: Int?
            let explanation: String?
            let modelAnswer: String?
            let source: String?
        }
        let questions: [RawQuestion]?
        let distractors: [String]?
    }

    private struct GradeAPIInput: Encodable {
        struct Item: Encodable {
            let question: String
            let modelAnswer: String
            let criteria: String
            let answer: String
        }
        let items: [Item]
    }

    private struct GradeAPIResponse: Decodable {
        struct Result: Decodable {
            let score: Double?
            let feedback: String?
        }
        let results: [Result]?
    }

    /// Calls `/api/generate` with `task = "exam"` and normalizes questions + word bank identically to `src/lib/exam.ts`.
    static func generateAI(
        courseName: String,
        notes: [(item: NoteItem, content: String)],
        plan: MockExamPlan
    ) async throws -> [MockExamQuestion] {
        let count = max(1, plan.totalQuestions)
        let input = ExamAPIInput(
            courseName: courseName,
            notes: notes.map { NotePayload(title: $0.item.title, text: String($0.content.prefix(90_000))) },
            format: plan.format,
            count: count,
            difficulty: plan.difficulty.rawValue,
            pastQuestions: String(plan.pastQuestions.prefix(4000)),
            mcqCount: plan.mcqCount,
            openCount: plan.openCount,
            examInfo: String(plan.info.prefix(MockExamPlan.infoMax)),
            blankCount: plan.blankCount,
            distractorCount: plan.blankCount > 0 ? plan.distractorCount : 0
        )

        let raw = try await AIClient.run("exam", input, as: RawExamResponse.self)
        let normalized = normalize(
            rawQuestions: raw.questions ?? [],
            distractors: raw.distractors ?? [],
            plan: plan,
            notes: notes
        )
        guard !normalized.isEmpty else {
            throw AIClient.Failure(message: AIClient.formatError, code: "bad_output")
        }
        return normalized
    }

    /// Builds an instant multiple-choice practice exam from existing note questions (no AI quota spent).
    static func generateLocal(
        notesWithQuestions: [(note: NoteItem, questions: [Question])],
        count: Int
    ) -> [MockExamQuestion] {
        var pool: [MockExamQuestion] = notesWithQuestions.flatMap { pair in
            pair.questions.map { q in
                MockExamQuestion(
                    id: UUID().uuidString,
                    type: .mcq,
                    prompt: q.prompt,
                    options: q.options,
                    answerIndex: q.answerIndex,
                    explanation: q.explanation,
                    modelAnswer: "",
                    source: q.source,
                    noteTitle: pair.note.title,
                    noteId: pair.note.id.uuidString
                )
            }
        }
        pool.shuffle()
        return Array(pool.prefix(max(1, count)))
    }

    /// Grades written (`open`) answers via `/api/generate` (`task = "grade"`) and scores `mcq`/`blank` locally.
    static func evaluate(
        questions: [MockExamQuestion],
        answers: [MockExamAnswer]
    ) async throws -> MockExamEvaluation {
        var openIndices: [Int] = []
        var itemsToGrade: [GradeAPIInput.Item] = []

        for (idx, q) in questions.enumerated() where q.type == .open {
            if idx < answers.count, case let .text(written) = answers[idx] {
                let trimmed = written.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty {
                    openIndices.append(idx)
                    itemsToGrade.append(
                        GradeAPIInput.Item(
                            question: q.prompt,
                            modelAnswer: q.modelAnswer,
                            criteria: q.explanation,
                            answer: String(trimmed.prefix(4000))
                        )
                    )
                }
            }
        }

        var openGraded: [Int: (score: Double, feedback: String)] = [:]
        if !itemsToGrade.isEmpty {
            let response = try await AIClient.run("grade", GradeAPIInput(items: itemsToGrade), as: GradeAPIResponse.self)
            let results = response.results ?? []
            for (offset, questionIndex) in openIndices.enumerated() where offset < results.count {
                let rawScore = results[offset].score ?? 0
                let clampedScore = min(max(rawScore, 0), 1)
                let fb = (results[offset].feedback ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                openGraded[questionIndex] = (clampedScore, fb)
            }
        }

        var scores: [Double] = []
        var feedback: [String] = []
        for (idx, q) in questions.enumerated() {
            let ans = idx < answers.count ? answers[idx] : .none
            switch q.type {
            case .mcq, .blank:
                if case let .choice(chosen) = ans, chosen == q.answerIndex {
                    scores.append(1.0)
                } else {
                    scores.append(0.0)
                }
                feedback.append("")
            case .open:
                if let graded = openGraded[idx] {
                    scores.append(graded.score)
                    feedback.append(graded.feedback)
                } else {
                    scores.append(0.0)
                    feedback.append("Cevap verilmedi.")
                }
            }
        }

        let total = scores.reduce(0, +)
        return MockExamEvaluation(scores: scores, feedback: feedback, total: total)
    }

    // MARK: - Normalization (ported from src/lib/exam.ts)

    private static func clean(_ s: String?) -> String {
        guard let s else { return "" }
        return s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalize(
        rawQuestions: [RawExamResponse.RawQuestion],
        distractors: [String],
        plan: MockExamPlan,
        notes: [(item: NoteItem, content: String)]
    ) -> [MockExamQuestion] {
        var leftMcq = plan.mcqCount
        var leftBlank = plan.blankCount
        var leftOpen = plan.openCount
        var seenBlankKeys = Set<String>()
        let turkish = Locale(identifier: "tr_TR")

        struct Candidate {
            let type: MockQuestionType
            let prompt: String
            let options: [String]
            let answerIndex: Int
            let explanation: String
            let modelAnswer: String
            let source: String?
        }

        var kept: [Candidate] = []
        for raw in rawQuestions {
            guard let type = MockQuestionType(rawValue: raw.type ?? "") else { continue }
            let prompt = (raw.prompt ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !prompt.isEmpty else { continue }
            let opts = (raw.options ?? []).map { clean($0) }
            let ansIdx = raw.answerIndex ?? -1
            let expl = (raw.explanation ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let model = (raw.modelAnswer ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let src = clean(raw.source)

            switch type {
            case .mcq:
                guard leftMcq > 0,
                      opts.count >= 2, opts.count <= 6,
                      opts.allSatisfy({ !$0.isEmpty }),
                      Set(opts).count == opts.count,
                      opts.indices.contains(ansIdx) else { continue }
                leftMcq -= 1
                kept.append(Candidate(type: .mcq, prompt: prompt, options: opts, answerIndex: ansIdx, explanation: expl, modelAnswer: "", source: src.isEmpty ? nil : src))

            case .blank:
                let answer = clean(model)
                let key = answer.lowercased(with: turkish)
                let matches = prompt.ranges(of: /_{3,}/)
                guard leftBlank > 0,
                      matches.count == 1,
                      !answer.isEmpty,
                      answer.count <= 40,
                      !seenBlankKeys.contains(key) else { continue }
                seenBlankKeys.insert(key)
                leftBlank -= 1
                let normalizedPrompt = prompt.replacingOccurrences(of: #"_{3,}"#, with: "_____", options: .regularExpression)
                kept.append(Candidate(type: .blank, prompt: normalizedPrompt, options: [], answerIndex: -1, explanation: expl, modelAnswer: answer, source: src.isEmpty ? nil : src))

            case .open:
                guard leftOpen > 0, !model.isEmpty else { continue }
                leftOpen -= 1
                kept.append(Candidate(type: .open, prompt: prompt, options: [], answerIndex: -1, explanation: expl, modelAnswer: model, source: src.isEmpty ? nil : src))
            }
        }

        // Order like a real Turkish exam paper: Test -> Boşluk Doldurma -> Klasik
        let orderRank: (MockQuestionType) -> Int = { t in
            switch t {
            case .mcq: 0
            case .blank: 1
            case .open: 2
            }
        }
        let ordered = kept.sorted { orderRank($0.type) < orderRank($1.type) }

        // Build shared word bank for fill-in-the-blank questions
        let blankAnswers = ordered.filter { $0.type == .blank }.map(\.modelAnswer)
        var takenKeys = Set(blankAnswers.map { $0.lowercased(with: turkish) })
        var extraWords: [String] = []
        for d in distractors.map({ clean($0) }) {
            if extraWords.count >= plan.distractorCount { break }
            let k = d.lowercased(with: turkish)
            if d.isEmpty || d.count > 40 || takenKeys.contains(k) { continue }
            takenKeys.insert(k)
            extraWords.append(d)
        }
        let wordBank = blankAnswers.isEmpty ? [] : (blankAnswers + extraWords).shuffled()

        return ordered.map { q in
            let matchedNote = matchSourceNote(source: q.source, notes: notes)
            let isBlank = q.type == .blank
            return MockExamQuestion(
                id: UUID().uuidString,
                type: q.type,
                prompt: q.prompt,
                options: q.type == .mcq ? q.options : (isBlank ? wordBank : []),
                answerIndex: q.type == .mcq ? q.answerIndex : (isBlank ? (wordBank.firstIndex(of: q.modelAnswer) ?? 0) : -1),
                explanation: q.explanation,
                modelAnswer: q.modelAnswer,
                source: q.source,
                noteTitle: matchedNote?.title,
                noteId: matchedNote?.id.uuidString
            )
        }
    }

    private static func matchSourceNote(
        source: String?,
        notes: [(item: NoteItem, content: String)]
    ) -> NoteItem? {
        guard let src = source?.trimmingCharacters(in: .whitespacesAndNewlines), src.count >= 12 else {
            return notes.count == 1 ? notes.first?.item : nil
        }
        let needle = String(src.prefix(48)).lowercased()
        return notes.first { $0.content.lowercased().contains(needle) }?.item
    }
}
