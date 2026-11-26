import Foundation
import Supabase

/// The parts of notes.summary the app shows. Decoding is lenient (missing lists are empty) and the
/// app never writes this object back, so fields the site adds (mnemonics, comparisons…) stay intact.
struct NoteSummary: Decodable {
    struct KeyTerm: Decodable, Hashable {
        let term: String
        let definition: String
    }

    struct Detailed: Decodable {
        struct Section: Decodable, Hashable {
            let heading: String
            let paragraphs: [String]
            let bullets: [String]
            let example: String

            init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: CodingKeys.self)
                heading = (try? c.decode(String.self, forKey: .heading)) ?? ""
                paragraphs = (try? c.decode([String].self, forKey: .paragraphs)) ?? []
                bullets = (try? c.decode([String].self, forKey: .bullets)) ?? []
                example = (try? c.decode(String.self, forKey: .example)) ?? ""
            }
            enum CodingKeys: String, CodingKey { case heading, paragraphs, bullets, example }
        }

        let intro: String
        let sections: [Section]
        let takeaways: [String]

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            intro = (try? c.decode(String.self, forKey: .intro)) ?? ""
            sections = (try? c.decode([Section].self, forKey: .sections)) ?? []
            takeaways = (try? c.decode([String].self, forKey: .takeaways)) ?? []
        }
        enum CodingKeys: String, CodingKey { case intro, sections, takeaways }

        var isEmpty: Bool { intro.isEmpty && sections.isEmpty && takeaways.isEmpty }
    }

    let overview: String
    let points: [String]
    let keyTerms: [KeyTerm]
    let tags: [String]
    let completedSteps: [String]
    let checkedTerms: [String]
    let detailed: Detailed?
    /// The note's text changed after the study set was made (the site's "Kaynak metin değişti").
    let sourceChanged: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        overview = (try? c.decode(String.self, forKey: .overview)) ?? ""
        points = (try? c.decode([String].self, forKey: .points)) ?? []
        keyTerms = (try? c.decode([KeyTerm].self, forKey: .keyTerms)) ?? []
        tags = (try? c.decode([String].self, forKey: .tags)) ?? []
        completedSteps = (try? c.decode([String].self, forKey: .completedSteps)) ?? []
        checkedTerms = (try? c.decode([String].self, forKey: .checkedTerms)) ?? []
        detailed = (try? c.decode(Detailed.self, forKey: .detailed)).flatMap { $0.isEmpty ? nil : $0 }
        sourceChanged = (try? c.decode(Bool.self, forKey: .sourceChanged)) ?? false
    }

    enum CodingKeys: String, CodingKey { case overview, points, keyTerms, tags, completedSteps, checkedTerms, detailed, sourceChanged }
}

private struct SummaryRow: Decodable {
    let summary: NoteSummary?
}

extension StudyStore {
    /// One note's summary; nil when the note has not been prepared.
    func summary(for note: NoteItem) async throws -> NoteSummary? {
        let row: SummaryRow = try await supabase.from("notes").select("summary").eq("id", value: note.id).single().execute().value
        return row.summary
    }
}
