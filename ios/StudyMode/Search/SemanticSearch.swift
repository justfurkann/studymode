import Foundation
import Supabase

/// A note with the text search needs (title, content and the summary parts the site searches).
/// Read only; nothing here is ever written back.
struct SearchNote: Identifiable, Decodable, Hashable {
    let id: UUID
    let courseId: UUID
    let title: String
    let content: String
    let createdAt: String
    /// summary->>overview; nil when the note has no summary (summary is null on the site).
    let overview: String?
    let keyTerms: [Term]
    let points: [String]
    let tags: [String]

    struct Term: Decodable, Hashable {
        let term: String
        let definition: String

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            term = (try? c.decode(String.self, forKey: .term)) ?? ""
            definition = (try? c.decode(String.self, forKey: .definition)) ?? ""
        }

        enum CodingKeys: String, CodingKey { case term, definition }
    }

    /// The site's `note.summary`: present once the note is prepared.
    var hasSummary: Bool { overview != nil || !keyTerms.isEmpty || !points.isEmpty }

    enum CodingKeys: String, CodingKey {
        case id, title, content, overview, terms, points, tags
        case courseId = "course_id"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        courseId = try c.decode(UUID.self, forKey: .courseId)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        content = (try? c.decode(String.self, forKey: .content)) ?? ""
        createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
        overview = try? c.decodeIfPresent(String.self, forKey: .overview)
        keyTerms = ((try? c.decodeIfPresent([Term].self, forKey: .terms)) ?? nil) ?? []
        points = ((try? c.decodeIfPresent(LenientStrings.self, forKey: .points)) ?? nil)?.values ?? []
        tags = ((try? c.decodeIfPresent(LenientStrings.self, forKey: .tags)) ?? nil)?.values ?? []
    }

    /// Stands in when the full text cannot be fetched (no network): search runs on what the list knows.
    init(item: NoteItem) {
        id = item.id
        courseId = item.courseId
        title = item.title
        content = ""
        createdAt = item.createdAt
        overview = item.overview
        keyTerms = []
        points = []
        tags = item.tags ?? []
    }

    static let columns = "id,course_id,title,content,created_at,overview:summary->>overview,terms:summary->keyTerms,points:summary->points,tags:summary->tags"

    /// Lowercase id, as the site keys its vectors.
    var key: String { id.uuidString.lowercased() }
}

/// A JSON array of strings where a non-string entry is skipped instead of failing the whole row.
struct LenientStrings: Decodable, Hashable {
    let values: [String]

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        var out: [String] = []
        while !c.isAtEnd {
            if let s = try? c.decode(String.self) { out.append(s) } else { _ = try? c.decode(AnyJSON.self) }
        }
        values = out
    }
}

/// The site's src/lib/semanticSearch.ts, ported line by line: Turkish stems, concept clusters, best
/// snippet, vector score (cosine ≥ 0.74) and the two rankings (course page and "all notes").
enum SemanticSearch {
    struct Match: Identifiable {
        enum Kind { case all, exact, semantic }
        let note: SearchNote
        let score: Double
        let kind: Kind
        let matchedTerm: String?
        let snippet: String?
        var id: UUID { note.id }
    }

    struct Hit: Identifiable {
        let note: SearchNote
        let exact: Bool
        let sim: Double
        let snippet: String?
        var id: UUID { note.id }
    }

    // MARK: Constants (semanticSearch.ts)

    static let conceptClusters: [[String]] = [
        ["mitokondri", "enerji", "atp", "solunum", "hücresel solunum", "oksijenli", "santral"],
        ["ribozom", "protein", "amino asit", "sentez", "rna", "translasyon", "peptit"],
        ["çekirdek", "nükleus", "kalıtsal", "genetik", "dna", "kromozom", "kalıtım", "yönetim"],
        ["lizozom", "sindirim", "enzim", "parçalanma", "atık", "otofaji", "fagositoz"],
        ["hücre zarı", "seçici geçirgen", "madde alışverişi", "fosfolipit", "zar", "difüzyon", "ozmoz"],
        ["kloroplast", "fotosentez", "klorofil", "ışık", "besin üretimi", "glikoz", "bitki"],
        ["endoplazmik retikulum", "taşıma", "kanal", "granüllü", "granülsüz", "lipit"],
        ["golgi", "paketleme", "salgı", "kesecik", "modifikasyon"],
        ["çalışma belleği", "kısa süreli bellek", "anlık", "kapasite", "tutma", "işleme", "bilişsel yük"],
        ["uzun süreli bellek", "kalıcı", "depolama", "şema", "kodlama", "hatırlama", "konsolidasyon"],
        ["aktif hatırlama", "kendini sınama", "geri çağırma", "test etkisi", "pratik", "soru çözme"],
        ["aralıklı tekrar", "unutma eğrisi", "zamana yayma", "tekrar planı", "ebbinghaus", "pekiştirme"],
        ["hukuk", "yaptırım", "norm", "anayasa", "kanun", "mevzuat", "borçlar", "kusursuz sorumluluk"],
        ["ekonomi", "enflasyon", "arz", "talep", "faiz", "denge fiyat", "maliyet", "gayrisafi"],
    ]

    static let stopWords: Set<String> = [
        "ve", "ile", "için", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "mı", "mu", "mü", "gibi", "kadar",
        "daha", "en", "çok", "az", "olan", "olarak", "nedir", "nasıl", "hangi", "neye", "nerede", "ne", "ise",
        "veya", "ya", "ama", "fakat", "çünkü", "üreten", "yapan", "sağlayan", "görev", "alan",
    ]

    static let suffixes: [String] = [
        "lerinden", "larından", "lerinde", "larında", "lerinin", "larının", "leriyle", "larıyla", "lerden",
        "lardan", "lerde", "larda", "lerin", "ların", "masıyla", "mesiyle", "ğından", "ğinden", "ğında",
        "ğinde", "den", "dan", "ten", "tan", "nde", "nda", "nin", "nın", "nun", "nün", "ler", "lar", "lik",
        "lık", "luk", "lük", "siz", "sız", "suz", "süz", "sel", "sal", "de", "da", "te", "ta", "in", "ın",
        "un", "ün", "yi", "yı", "yu", "yü", "si", "sı", "su", "sü", "li", "lı", "lu", "lü", "le", "la", "i",
        "ı", "u", "ü", "e", "a",
    ]

    /// 768 numbers, 5 decimals (compactVector): about 6 KB a note.
    static let dims = 768
    /// Below this cosine a note is not a match (measured on gemini-embedding-001 with Turkish notes).
    static let vectorMatchAt = 0.74
    static let maxHits = 8
    static let nearBest = 0.06

    // MARK: Text helpers (JavaScript semantics)

    private static let turkish = Locale(identifier: "tr_TR")

    /// toLocaleLowerCase('tr-TR')
    static func lower(_ text: String) -> String { text.lowercased(with: turkish) }

    /// String.length in JavaScript (UTF-16 units).
    static func jsLength(_ text: String) -> Int { text.utf16.count }

    /// String.slice(0, n) in JavaScript (UTF-16 units), never splitting a surrogate pair.
    static func jsPrefix(_ text: String, _ n: Int) -> String {
        let units = text.utf16
        guard units.count > n else { return text }
        var end = n
        while end > 0 {
            if let s = String(units.prefix(end)) { return s }
            end -= 1
        }
        return ""
    }

    private static func isLetterOrNumber(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.properties.generalCategory {
        case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
             .decimalNumber, .letterNumber, .otherNumber:
            return true
        default:
            return false
        }
    }

    /// text.split(/[^\p{L}\p{N}]+/u) without the empty pieces (callers drop them anyway).
    static func splitWords(_ text: String) -> [String] {
        var out: [String] = []
        var current = String.UnicodeScalarView()
        for scalar in text.unicodeScalars {
            if isLetterOrNumber(scalar) {
                current.append(scalar)
            } else if !current.isEmpty {
                out.append(String(current))
                current = String.UnicodeScalarView()
            }
        }
        if !current.isEmpty { out.append(String(current)) }
        return out
    }

    /// .replace(/[^\p{L}\p{N}]+/gu, '')
    private static func lettersOnly(_ text: String) -> String {
        var view = String.UnicodeScalarView()
        for scalar in text.unicodeScalars where isLetterOrNumber(scalar) { view.append(scalar) }
        return String(view)
    }

    private static func trim(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    // MARK: Stems and clusters

    /// normalizeTurkishStem: strips one common Turkish suffix to get a stable root.
    static func stem(_ raw: String) -> String {
        var word = trim(lettersOnly(lower(raw)))
        if jsLength(word) <= 4 { return word }
        for suffix in suffixes where jsLength(word) - jsLength(suffix) >= 4 && word.hasSuffix(suffix) {
            word = String(word.unicodeScalars.dropLast(suffix.unicodeScalars.count))
            break
        }
        if word.hasSuffix("ğ") { word = String(word.unicodeScalars.dropLast()) + "k" }
        return word
    }

    /// tokenizeSemantic
    static func tokenize(_ text: String) -> [String] {
        splitWords(lower(text))
            .map(trim)
            .filter { jsLength($0) >= 3 && !stopWords.contains($0) }
            .map(stem)
            .filter { jsLength($0) >= 3 }
    }

    /// expandWithClusters
    static func expand(_ text: String) -> Set<String> {
        let lowered = lower(text)
        let stems = Set(tokenize(text))
        var expanded = stems
        for cluster in conceptClusters {
            let matched = cluster.contains { phrase in
                let p = lower(phrase)
                if lowered.contains(p) { return true }
                let pStems = tokenize(p)
                return !pStems.isEmpty && pStems.allSatisfy { stems.contains($0) }
            }
            if matched {
                for phrase in cluster { expanded.formUnion(tokenize(phrase)) }
            }
        }
        return expanded
    }

    // MARK: Vectors

    static func cosine(_ a: [Double], _ b: [Double]) -> Double {
        guard !a.isEmpty, a.count == b.count else { return 0 }
        var dot = 0.0, na = 0.0, nb = 0.0
        for i in 0..<a.count {
            dot += a[i] * b[i]
            na += a[i] * a[i]
            nb += b[i] * b[i]
        }
        guard na > 0, nb > 0 else { return 0 }
        return dot / (na.squareRoot() * nb.squareRoot())
    }

    /// compactVector: first 768 numbers, rounded to 5 decimals (Math.round(x * 1e5) / 1e5).
    static func compact(_ v: [Double]) -> [Double] {
        v.prefix(dims).map { ($0 * 1e5 + 0.5).rounded(.down) / 1e5 }
    }

    /// vectorMatchScore
    static func vectorScore(_ sim: Double) -> Double {
        sim < vectorMatchAt ? 0 : min(1, 0.45 + ((sim - vectorMatchAt) / 0.1) * 0.55)
    }

    /// buildNoteEmbeddingText: title, overview, key terms, points and the first 3,000 characters, at most 4,000.
    static func embeddingText(_ note: SearchNote) -> String {
        var parts: [String] = [note.title, note.overview ?? ""]
        parts += note.keyTerms.map { "\($0.term): \($0.definition)" }
        parts += note.points
        parts.append(jsPrefix(note.content, 3000))
        return jsPrefix(parts.filter { !$0.isEmpty }.joined(separator: "\n"), 4000)
    }

    // MARK: Snippets

    private struct Candidate { let text: String; let term: String? }

    /// splitSentences
    private static func candidates(_ note: SearchNote) -> [Candidate] {
        var out: [Candidate] = note.keyTerms.map { Candidate(text: "\($0.term): \($0.definition)", term: $0.term) }
        out += note.points.map { Candidate(text: $0, term: nil) }
        let lines = note.content
            .split(whereSeparator: { $0 == "\n" || $0 == "\r\n" })
            .map { trim(String($0)) }
            .filter { jsLength($0) >= 18 }
        for line in lines {
            var term: String?
            if let colon = line.utf16.firstIndex(of: 58) {
                let offset = line.utf16.distance(from: line.utf16.startIndex, to: colon)
                if offset > 1, offset < 35 { term = trim(jsPrefix(line, offset)) }
            }
            out.append(Candidate(text: line, term: term))
        }
        return out
    }

    /// findBestNoteSnippet
    static func bestSnippet(_ note: SearchNote, query: String) -> (snippet: String?, term: String?, score: Double) {
        let expandedQuery = expand(query)
        let rawStems = Set(tokenize(query))
        guard !expandedQuery.isEmpty else { return (nil, nil, 0) }

        var bestSnippet: String?
        var bestTerm: String?
        var bestScore = 0.0
        for cand in candidates(note) {
            let stems = tokenize(cand.text)
            guard !stems.isEmpty else { continue }
            var direct = 0.0
            var expandedHits = 0.0
            for s in stems {
                if rawStems.contains(s) { direct += 1 } else if expandedQuery.contains(s) { expandedHits += 1 }
            }
            for q in expandedQuery where jsLength(q) >= 5 && stems.contains(where: { $0.hasPrefix(q) || q.hasPrefix($0) }) {
                expandedHits += 0.6
            }
            let total = (direct * 1.4 + expandedHits * 0.9) / max(2, Double(stems.count).squareRoot())
            if total > bestScore {
                bestScore = total
                bestSnippet = jsLength(cand.text) > 160 ? trim(jsPrefix(cand.text, 157)) + "…" : cand.text
                bestTerm = cand.term
            }
        }
        if let snippet = bestSnippet, bestTerm == nil, !note.keyTerms.isEmpty {
            let lowered = lower(snippet)
            bestTerm = note.keyTerms.first { lowered.contains(lower($0.term)) }?.term
        }
        return (bestSnippet, bestTerm, min(1, bestScore / 2.2))
    }

    // MARK: Rankings

    /// searchNotesSemantic: the course page. Words in the note first, then notes close in meaning
    /// (local concept clusters, or the vector when Premium has prepared the notes).
    static func search(_ notes: [SearchNote], query: String, tag: String = "", vectors: [String: [Double]] = [:], queryVector: [Double]? = nil) -> [Match] {
        let cleanTag = trim(tag)
        let filtered = cleanTag.isEmpty ? notes : notes.filter { $0.tags.contains(cleanTag) }
        let search = lower(trim(query))
        if search.isEmpty {
            return filtered.map { Match(note: $0, score: 1, kind: .all, matchedTerm: nil, snippet: nil) }
        }
        var results: [Match] = []
        for note in filtered {
            var hay: [String] = [note.title, note.content, note.overview ?? ""]
            hay += note.points
            hay += note.keyTerms.map { "\($0.term) \($0.definition)" }
            hay += note.tags
            let isExact = lower(hay.joined(separator: " ")).contains(search)
            let best = bestSnippet(note, query: search)

            var vScore = 0.0
            if let nv = vectors[note.key], let qv = queryVector, nv.count == qv.count {
                vScore = vectorScore(cosine(nv, qv))
            }
            let combined = max(best.score, vScore)
            if isExact {
                results.append(Match(note: note, score: max(0.85, combined), kind: .exact, matchedTerm: best.term, snippet: best.snippet))
            } else if combined >= 0.22 {
                results.append(Match(note: note, score: combined, kind: .semantic, matchedTerm: best.term, snippet: best.snippet))
            }
        }
        // Array.sort in JavaScript is stable: equal scores keep the list order.
        return results.enumerated().sorted { a, b in
            let x = a.element, y = b.element
            if (x.kind == .exact) != (y.kind == .exact) { return x.kind == .exact }
            if x.score != y.score { return x.score > y.score }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// rankNotesByMeaning: "all notes". Notes with the words first; then only notes near the best match
    /// and above the related line, so an unrelated search shows nothing instead of everything.
    static func rank(_ notes: [SearchNote], vectors: [String: [Double]], query: String, queryVector: [Double]?) -> [Hit] {
        let q = lower(query)
        let scored: [(note: SearchNote, exact: Bool, sim: Double)] = notes.map { note in
            let text = lower([note.title, note.content, note.overview ?? ""].joined(separator: " "))
            var sim = 0.0
            if let qv = queryVector, let v = vectors[note.key], v.count == qv.count { sim = cosine(v, qv) }
            return (note, text.contains(q), sim)
        }
        let best = max(0, scored.map(\.sim).max() ?? 0)
        return scored.enumerated()
            .filter { $0.element.exact || ($0.element.sim >= vectorMatchAt && $0.element.sim >= best - nearBest) }
            .sorted { a, b in
                if a.element.exact != b.element.exact { return a.element.exact }
                if a.element.sim != b.element.sim { return a.element.sim > b.element.sim }
                return a.offset < b.offset
            }
            .prefix(maxHits)
            .map { Hit(note: $0.element.note, exact: $0.element.exact, sim: $0.element.sim, snippet: bestSnippet($0.element.note, query: query).snippet) }
    }
}
