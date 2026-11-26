import Foundation

/// A note's study set from the AI ("study" task), prepared the way the site does it
/// (src/lib/ai/index.ts generateStudySet, normalizeStudySet, mergeStudySets; tasks.ts splitNoteIntoChunks).
struct StudySet {
    struct Term: Encodable { let term: String; let definition: String }
    struct CardDraft { let front: String; let back: String; let source: String? }
    struct QuestionOut: Encodable { let id: String; let prompt: String; let options: [String]; let answerIndex: Int; let explanation: String; let source: String? }
    struct PracticeOut: Encodable { let id: String; let question: String; let answer: String?; let hint: String? }

    var overview: String
    var points: [String]
    var keyTerms: [Term]
    var cards: [CardDraft]
    var questions: [QuestionOut]
    var practice: [PracticeOut]
    /// Parts that could not be prepared, out of all parts.
    var failedParts = 0
    var totalParts = 1
}

enum StudySetMaker {
    /// Characters per request through the site's server (SERVER_STUDY_CHUNK_CHARS).
    static let chunkChars = 12_000
    /// Parts prepared at the same time (STUDY_PARALLEL_SERVER).
    static let lanes = 3
    /// Parts shorter than this are not split again when they run out of time.
    static let minSplitChars = 3_000

    // MARK: Raw answer (StudySetSchema, with its defaults)

    private struct Raw: Decodable {
        struct Summary: Decodable { let overview: String; let points: [String]; let keyTerms: [RawTerm]?
            struct RawTerm: Decodable { let term: String; let definition: String } }
        struct RawCard: Decodable { let front: String; let back: String; let source: String? }
        struct RawQuestion: Decodable { let prompt: String; let options: [String]; let answerIndex: Int; let explanation: String?; let source: String? }
        struct RawPractice: Decodable { let question: String; let answer: String?; let hint: String? }
        let summary: Summary
        let cards: [RawCard]?
        let questions: [RawQuestion]?
        let practice: [RawPractice]?
    }

    private struct Input: Encodable { let title: String; let text: String }

    // MARK: Splitting

    /// Paragraph-first split, like splitNoteIntoChunks.
    static func split(_ text: String, max: Int = chunkChars) -> [String] {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.isEmpty { return [] }
        if cleaned.count <= max { return [cleaned] }
        var chunks: [String] = []
        var current = ""
        func push(_ part: String) {
            let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if current.isEmpty { current = trimmed; return }
            if current.count + 2 + trimmed.count <= max { current += "\n\n" + trimmed } else { chunks.append(current); current = trimmed }
        }
        let paragraphs = cleaned.split(separator: /\n{2,}/).map(String.init)
        for para in paragraphs {
            if para.count <= max { push(para); continue }
            for line in para.components(separatedBy: "\n") {
                if line.count <= max { push(line); continue }
                var start = line.startIndex
                while start < line.endIndex {
                    let end = line.index(start, offsetBy: max, limitedBy: line.endIndex) ?? line.endIndex
                    push(String(line[start..<end]))
                    start = end
                }
            }
        }
        if !current.isEmpty { chunks.append(current) }
        return chunks
    }

    /// Halves of a part that ran out of time (splitTimedOutChunk).
    static func halves(_ text: String) -> [String] {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleaned.count >= minSplitChars else { return [] }
        let byParagraph = split(cleaned, max: Int((Double(cleaned.count) / 2).rounded(.up)) + 500)
        if byParagraph.count > 1 { return byParagraph }
        let chars = Array(cleaned)
        let half = chars.count / 2
        var cut = half
        if let nl = chars[half...].firstIndex(of: "\n"), nl - half < 600 { cut = nl }
        else if let sp = chars[half...].firstIndex(of: " "), sp - half < 300 { cut = sp }
        let left = String(chars[..<cut]).trimmingCharacters(in: .whitespacesAndNewlines)
        let right = String(chars[cut...]).trimmingCharacters(in: .whitespacesAndNewlines)
        return left.isEmpty || right.isEmpty ? [] : [left, right]
    }

    // MARK: Preparing

    /// Prepares the whole note, part by part, three at a time; parts that time out are split once.
    /// `progress(done, total)` is called on the main actor.
    static func make(title: String, text: String, progress: @escaping @MainActor (Int, Int) -> Void) async throws -> StudySet {
        let first = split(text)
        let many = first.count > 1
        let state = PartQueue(first.enumerated().map { i, chunk in
            Part(text: chunk, label: many ? "Bölüm \(i + 1)/\(first.count)" : "", order: [i], wasSplit: false)
        })
        await progress(0, first.count)

        try await withThrowingTaskGroup(of: Void.self) { group in
            for _ in 0..<min(lanes, first.count) {
                group.addTask {
                    while let part = await state.next() {
                        try Task.checkCancellation()
                        await work(part, title: title, state: state, progress: progress)
                    }
                }
            }
            try await group.waitForAll()
        }

        let (finished, failed, total, lastError) = await state.result()
        let sets = finished.sorted { lexLess($0.order, $1.order) }.map(\.set)
        guard !sets.isEmpty else {
            throw lastError ?? AIClient.Failure(message: "Bu nottan çalışma seti çıkarılamadı. Notun yeterince açıklayıcı metin içerdiğinden emin ol.", code: nil)
        }
        var merged = merge(sets)
        merged.failedParts = failed
        merged.totalParts = total
        return merged
    }

    private static func work(_ part: Part, title: String, state: PartQueue, progress: @escaping @MainActor (Int, Int) -> Void) async {
        let input = Input(title: part.label.isEmpty ? title : "\(title) (\(part.label))", text: part.text)
        var raw: Raw?
        let attempts = part.wasSplit ? 1 : 2
        for attempt in 0..<attempts where raw == nil {
            do {
                raw = try await AIClient.run("study", input, as: Raw.self)
            } catch let error as AIClient.Failure {
                await state.setError(error)
                if error.isTimeout {
                    if !part.wasSplit, part.text.count >= minSplitChars {
                        let pieces = halves(part.text)
                        if pieces.count > 1 {
                            let label = part.label.isEmpty ? "Bölüm 1" : part.label
                            let new = pieces.enumerated().map { k, h in Part(text: h, label: "\(label).\(k + 1)", order: part.order + [k], wasSplit: true) }
                            let (done, total) = await state.pushFront(new)
                            await progress(done, total)
                            return
                        }
                    }
                    break
                }
                // A filter refusal or a spent quota won't change on a retry.
                if error.code == "blocked" || error.code == "daily_limit" { break }
                if attempt == 0 && attempts > 1 { try? await Task.sleep(for: .milliseconds(1500)) }
            } catch {
                await state.setError(error)
                break
            }
        }
        // A part with only headings or figures yields nothing useful; it is not counted as failed (as on the site).
        let set = raw.flatMap(normalize)
        let (done, total) = await state.finish(order: part.order, set: set, failed: raw == nil)
        await progress(done, total)
    }

    private static func lexLess(_ a: [Int], _ b: [Int]) -> Bool {
        for i in 0..<max(a.count, b.count) {
            let d = (i < a.count ? a[i] : -1) - (i < b.count ? b[i] : -1)
            if d != 0 { return d < 0 }
        }
        return false
    }

    // MARK: Cleaning and merging

    private static func clean(_ s: String?) -> String {
        (s ?? "").replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }

    /// Drops malformed items so one bad question cannot break the test screen (normalizeStudySet).
    private static func normalize(_ raw: Raw) -> StudySet? {
        let questions: [StudySet.QuestionOut] = (raw.questions ?? []).compactMap { q in
            let prompt = clean(q.prompt)
            let options = q.options.map { clean($0) }
            guard !prompt.isEmpty, (2...6).contains(options.count), options.allSatisfy({ !$0.isEmpty }),
                  Set(options).count == options.count, options.indices.contains(q.answerIndex) else { return nil }
            let source = clean(q.source)
            return .init(id: UUID().uuidString.lowercased(), prompt: prompt, options: options, answerIndex: q.answerIndex, explanation: clean(q.explanation), source: source.isEmpty ? nil : source)
        }
        let set = StudySet(
            overview: clean(raw.summary.overview),
            points: raw.summary.points.map { clean($0) }.filter { !$0.isEmpty },
            keyTerms: (raw.summary.keyTerms ?? []).map { .init(term: clean($0.term), definition: clean($0.definition)) }.filter { !$0.term.isEmpty && !$0.definition.isEmpty },
            cards: (raw.cards ?? []).compactMap { c in
                let front = c.front.trimmingCharacters(in: .whitespacesAndNewlines), back = c.back.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !front.isEmpty, !back.isEmpty else { return nil }
                let source = clean(c.source)
                return .init(front: front, back: back, source: source.isEmpty ? nil : source)
            },
            questions: questions,
            practice: (raw.practice ?? []).compactMap { p in
                let q = clean(p.question)
                guard !q.isEmpty else { return nil }
                let answer = (p.answer ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let hint = clean(p.hint)
                return .init(id: UUID().uuidString.lowercased(), question: q, answer: answer.isEmpty ? nil : answer, hint: hint.isEmpty ? nil : hint)
            }
        )
        if set.points.isEmpty && set.cards.isEmpty && set.questions.isEmpty { return nil }
        return set
    }

    /// One set from the parts, without repeats (mergeStudySets).
    static func merge(_ sets: [StudySet]) -> StudySet {
        guard sets.count > 1 else { return sets[0] }
        let tr = Locale(identifier: "tr_TR")
        func unique<T>(_ items: [T], key: (T) -> String) -> [T] {
            var seen = Set<String>()
            return items.filter { seen.insert(key($0).lowercased(with: tr)).inserted }
        }
        return StudySet(
            overview: sets.map { $0.overview.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " "),
            points: unique(sets.flatMap(\.points)) { $0 },
            keyTerms: unique(sets.flatMap(\.keyTerms)) { $0.term },
            cards: unique(sets.flatMap(\.cards)) { $0.front },
            questions: unique(sets.flatMap(\.questions)) { $0.prompt },
            practice: unique(sets.flatMap(\.practice)) { $0.question }
        )
    }

    // MARK: Parts in flight

    fileprivate struct Part { let text: String; let label: String; let order: [Int]; let wasSplit: Bool }

    private actor PartQueue {
        private var queue: [Part]
        private var total: Int
        private var done = 0
        private var finished: [(order: [Int], set: StudySet)] = []
        private var failed = 0
        private var lastError: Error?

        init(_ parts: [Part]) { queue = parts; total = parts.count }

        func next() -> Part? { queue.isEmpty ? nil : queue.removeFirst() }

        func pushFront(_ parts: [Part]) -> (Int, Int) {
            queue.insert(contentsOf: parts, at: 0)
            total += parts.count - 1
            return (done, total)
        }

        func setError(_ error: Error) { lastError = error }

        func finish(order: [Int], set: StudySet?, failed didFail: Bool) -> (Int, Int) {
            done += 1
            if let set { finished.append((order, set)) }
            if didFail { failed += 1 }
            return (done, total)
        }

        func result() -> ([(order: [Int], set: StudySet)], Int, Int, Error?) { (finished, failed, total, lastError) }
    }
}
