import Foundation
import Supabase

private struct RawSummaryRow: Decodable {
    let summary: AnyJSON?
}

private struct SummaryUpdate: Encodable {
    let summary: AnyJSON
    let updated_at: String
}

extension StudyStore {
    /// Marks a learning step done (e.g. "pekistir" after a full card round), like the site's
    /// toggleCompletedStep. The summary is read fresh and written back whole as raw JSON, with only
    /// completedSteps changed, so every field the site keeps there (full summary, mnemonics…) stays.
    func markStepDone(_ note: NoteItem, step: String) {
        guard !(noteSteps(note).contains(step)) else { return }
        setSteps(note.id, noteSteps(note) + [step])
        enqueueWrite { [weak self] in
            do {
                let row: RawSummaryRow = try await supabase.from("notes").select("summary").eq("id", value: note.id).single().execute().value
                guard case var .object(summary)? = row.summary else { return }
                var steps: [AnyJSON] = []
                if case let .array(existing)? = summary["completedSteps"] { steps = existing }
                if steps.contains(.string(step)) { return }
                steps.append(.string(step))
                summary["completedSteps"] = .array(steps)
                try await supabase.from("notes").update(SummaryUpdate(summary: .object(summary), updated_at: ISO.string(.now))).eq("id", value: note.id).execute()
            } catch {
                await MainActor.run { self?.saveError = "İlerlemen kaydedilemedi. İnternet bağlantını kontrol et." }
            }
        }
    }
}
