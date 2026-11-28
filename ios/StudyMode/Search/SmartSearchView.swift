import SwiftUI

/// Opens the search over every note (pushed on the Çalışma masam stack).
struct SmartSearchRoute: Hashable {}

/// "Akıllı arama" on the site's Premium page (Premium.tsx SmartSearch + rankNotesByMeaning): search
/// every note at once. Word search works for everyone; on Premium the notes are prepared once and a
/// note is found by meaning even when the word is not in it.
struct SmartSearchView: View {
    @Environment(StudyStore.self) private var store
    @Environment(PremiumStore.self) private var premium
    @State private var query = ""
    @State private var docs: [SearchNote]?
    @State private var loadFailed = false
    @State private var queryVector: QueryVector?
    @State private var searching = false
    @State private var error: String?
    private var index = SmartSearchIndex.shared

    private struct QueryVector { let q: String; let v: [Double] }

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Every note: with its text once fetched, otherwise what the list knows (no network).
    private var notes: [SearchNote] {
        let byId = Dictionary((docs ?? []).map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        return store.notes.map { byId[$0.id] ?? SearchNote(item: $0) }
    }

    private var courseName: [UUID: String] { Dictionary(store.courses.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a }) }

    var body: some View {
        let all = notes
        let vectors = premium.isPremium ? index.vectors(for: all) : [:]
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    intro(all: all, vectors: vectors)
                    if let error {
                        Message(text: error, kind: .warning)
                    }
                    if SemanticSearch.jsLength(trimmed) >= 2 {
                        results(all: all, vectors: vectors)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Akıllı arama")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Kelimesi geçmese de olur: enerji üreten organel")
        .task {
            #if DEBUG && targetEnvironment(simulator)
            // Simulator test only: `-searchQuery "…"` fills the box (the simulator cannot type Turkish).
            if query.isEmpty, let i = ProcessInfo.processInfo.arguments.firstIndex(of: "-searchQuery"),
               i + 1 < ProcessInfo.processInfo.arguments.count {
                query = ProcessInfo.processInfo.arguments[i + 1]
            }
            #endif
            await loadDocs()
        }
        // Runs again once the notes' text has arrived (until then no vector matches its fingerprint).
        .task(id: "\(query)|\(vectors.count)") { await fetchQueryVector(hasVectors: !vectors.isEmpty) }
    }

    private func loadDocs() async {
        guard docs == nil else { return }
        do {
            docs = try await SmartSearchIndex.fetchNotes()
            loadFailed = false
        } catch is CancellationError {
        } catch {
            loadFailed = true
        }
    }

    /// Site: 450 ms after typing stops, from 3 letters, once per text (cached).
    private func fetchQueryVector(hasVectors: Bool) async {
        error = nil
        let text = trimmed
        guard SemanticSearch.jsLength(text) >= 3, premium.isPremium, hasVectors else {
            queryVector = nil
            return
        }
        do {
            try await Task.sleep(for: .milliseconds(450))
            searching = true
            defer { searching = false }
            let v = try await index.queryVector(text)
            if trimmed == text { queryVector = QueryVector(q: text, v: v) }
        } catch is CancellationError {
        } catch {
            self.error = SmartSearchIndex.message(error)
        }
    }

    private func prepare() {
        error = nil
        Task {
            do {
                if docs == nil { docs = try await SmartSearchIndex.fetchNotes() }
                try await index.prepare(notes)
                OnboardingHaptics.success()
                await fetchQueryVector(hasVectors: true)
            } catch {
                self.error = SmartSearchIndex.message(error)
            }
        }
    }

    @ViewBuilder
    private func intro(all: [SearchNote], vectors: [String: [Double]]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "sparkle.magnifyingglass")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Theme.prem1)
                Text("Bütün notlarında ara")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
            }
            if all.isEmpty {
                Text("Henüz notun yok. Bir not ekleyince burada arayabilirsin.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
            } else if premium.isPremium {
                let missing = docs == nil ? all.count : all.count - vectors.count
                if missing == 0 {
                    Label("\(all.count) notun akıllı aramaya hazır.", systemImage: "checkmark.circle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.success)
                } else {
                    Text(vectors.isEmpty
                         ? "Akıllı arama için \(all.count) notunu bir kez hazırlaman gerekiyor. Birkaç saniye sürer, hakkından düşmez."
                         : "\(missing) yeni ya da değişen not henüz aramada yok.")
                        .font(.footnote)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        OnboardingHaptics.light()
                        prepare()
                    } label: {
                        HStack(spacing: 6) {
                            if let p = index.progress {
                                ProgressView().controlSize(.small).tint(.white)
                                Text("Hazırlanıyor \(p.done)/\(p.total)")
                            } else {
                                Image(systemName: "sparkles")
                                Text("Notlarımı hazırla")
                            }
                        }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(LinearGradient(colors: [Theme.prem1, Theme.prem2], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(TactileCardButtonStyle(scale: 0.985))
                    .disabled(index.progress != nil)
                }
            } else {
                Text("Kelimeyle arama herkese açık. Kelimesi geçmeyen notu anlamından bulmak Premium'da.")
                    .font(.footnote)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
                NavigationLink {
                    PremiumView()
                } label: {
                    Label("Premium'a bak", systemImage: "crown.fill")
                        .font(.footnote.weight(.bold))
                        .foregroundStyle(Theme.premText)
                }
            }
            if loadFailed {
                Text("Notlarının metni yüklenemedi; şimdilik başlıklarda ve özetlerde arıyorum.")
                    .font(.caption)
                    .foregroundStyle(Theme.text3)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }

    @ViewBuilder
    private func results(all: [SearchNote], vectors: [String: [Double]]) -> some View {
        let qv = queryVector.flatMap { $0.q == trimmed ? $0.v : nil }
        let hits = SemanticSearch.rank(all, vectors: vectors, query: trimmed, queryVector: qv)
        let items = Dictionary(store.notes.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        if searching && hits.isEmpty {
            HStack(spacing: 8) {
                ProgressView()
                Text("Aranıyor…").font(.subheadline).foregroundStyle(Theme.text2)
            }
        } else if hits.isEmpty {
            Text("Bu aramaya yakın bir not bulamadım.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
        } else {
            LazyVStack(spacing: 10) {
                ForEach(hits) { hit in
                    if let item = items[hit.note.id] {
                        NavigationLink(value: item) { HitRow(hit: hit, course: courseName[hit.note.courseId]) }
                            .buttonStyle(TactileCardButtonStyle())
                    }
                }
            }
        }
    }
}

private struct HitRow: View {
    let hit: SemanticSearch.Hit
    let course: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let course {
                Text(course)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text3)
            }
            Text(hit.note.title)
                .font(.headline)
                .foregroundStyle(Theme.text)
                .multilineTextAlignment(.leading)
            if let snippet = hit.snippet {
                Text(snippet)
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
            }
            Text(hit.exact ? "Kelimesi geçiyor" : "Anlamca yakın")
                .font(.caption2.weight(.bold))
                .foregroundStyle(hit.exact ? Theme.text : Theme.premText)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(hit.exact ? Theme.surface2 : Theme.premSoft, in: Capsule())
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}
