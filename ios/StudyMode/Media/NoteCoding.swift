import Foundation
import UIKit

// MARK: - Memory Coding Models (mirrors src/lib/ai/tasks.ts MemoryToolsSchema)

enum CodingKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case akrostis
    case hikaye
    case tekerleme
    case ipucu

    var id: String { rawValue }

    var label: String {
        switch self {
        case .akrostis: "Harf şifresi"
        case .hikaye: "Komik sahne"
        case .tekerleme: "Tekerleme"
        case .ipucu: "Kısa kanca"
        }
    }

    var icon: String {
        switch self {
        case .akrostis: "textformat.abc"
        case .hikaye: "theatermasks.fill"
        case .tekerleme: "music.note"
        case .ipucu: "bolt.fill"
        }
    }

    var nextStyle: CodingKind {
        let all = CodingKind.allCases
        let idx = all.firstIndex(of: self) ?? 0
        return all[(idx + 1) % all.count]
    }
}

struct CodingItem: Identifiable, Codable, Hashable {
    struct Breakdown: Identifiable, Codable, Hashable {
        var id: String { "\(key)-\(meaning.prefix(24))" }
        let key: String
        let meaning: String
    }

    let id: String
    let kind: CodingKind
    let title: String
    let code: String
    let breakdown: [Breakdown]
    let tip: String
    var imageFileName: String?
    let createdAt: String
}

// MARK: - AI Coding Client (uses live `/api/generate` task: "memory")

enum CodingAI {
    private struct MemoryInput: Encodable {
        let title: String
        let text: String
        let mode: String
        let mnemonicKind: String?
        let focusTopic: String?
    }

    private struct MemoryOutput: Decodable {
        struct RawItem: Decodable {
            struct RawPart: Decodable { let key: String?; let meaning: String? }
            let kind: String?
            let title: String?
            let code: String?
            let breakdown: [RawPart]?
            let tip: String?
        }
        let mnemonics: [RawItem]?
    }

    static func generate(
        title: String,
        text: String,
        kind: CodingKind,
        focusTopic: String? = nil
    ) async throws -> [CodingItem] {
        let trimmedFocus = focusTopic?.trimmingCharacters(in: .whitespacesAndNewlines)
        let input = MemoryInput(
            title: title,
            text: String(text.prefix(14_000)),
            mode: "mnemonic",
            mnemonicKind: kind.rawValue,
            focusTopic: (trimmedFocus?.isEmpty == false) ? trimmedFocus : nil
        )
        let output = try await AIClient.run("memory", input, as: MemoryOutput.self)
        let stamp = ISO.string(.now)
        let items: [CodingItem] = (output.mnemonics ?? []).compactMap { raw in
            let code = (raw.code ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let itemTitle = (raw.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty else { return nil }
            let resolvedKind = raw.kind.flatMap(CodingKind.init(rawValue:)) ?? kind
            let parts: [CodingItem.Breakdown] = (raw.breakdown ?? []).compactMap { p in
                let k = (p.key ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let m = (p.meaning ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                guard !k.isEmpty || !m.isEmpty else { return nil }
                return .init(key: k.isEmpty ? "•" : k, meaning: m)
            }
            return CodingItem(
                id: UUID().uuidString.lowercased(),
                kind: resolvedKind,
                title: itemTitle.isEmpty ? title : itemTitle,
                code: code,
                breakdown: parts,
                tip: (raw.tip ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                imageFileName: nil,
                createdAt: stamp
            )
        }
        guard !items.isEmpty else {
            throw AIClient.Failure(message: "Bu konu için şifre üretilemedi. Başka bir tarz veya kavram dene.", code: "empty")
        }
        return items
    }
}

// MARK: - On-Device Storage (Application Support/StudyMode/<userId>/codings/<noteId>/)

enum CodingStorage {
    static let maxPerNote = 12

    static func directory(user: UUID?, note: UUID) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let userDir = user?.uuidString.lowercased() ?? "guest"
        let dir = base.appending(path: "StudyMode", directoryHint: .isDirectory)
            .appending(path: userDir, directoryHint: .isDirectory)
            .appending(path: "codings", directoryHint: .isDirectory)
            .appending(path: note.uuidString.lowercased(), directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func load(user: UUID?, note: UUID) -> [CodingItem] {
        let url = directory(user: user, note: note).appending(path: "codings.json")
        guard let data = try? Data(contentsOf: url),
              let items = try? JSONDecoder().decode([CodingItem].self, from: data) else {
            return []
        }
        return items
    }

    @discardableResult
    static func save(_ items: [CodingItem], user: UUID?, note: UUID) -> [CodingItem] {
        let clipped = Array(items.prefix(maxPerNote))
        let dir = directory(user: user, note: note)
        if let data = try? JSONEncoder().encode(clipped) {
            try? data.write(to: dir.appending(path: "codings.json"), options: .atomic)
        }
        return clipped
    }

    static func attachImage(_ jpegData: Data, to itemId: String, user: UUID?, note: UUID) -> [CodingItem] {
        let dir = directory(user: user, note: note)
        let fileName = "scene-\(itemId).jpg"
        try? jpegData.write(to: dir.appending(path: fileName), options: .atomic)
        var list = load(user: user, note: note)
        if let idx = list.firstIndex(where: { $0.id == itemId }) {
            list[idx].imageFileName = fileName
        }
        return save(list, user: user, note: note)
    }

    static func image(for item: CodingItem, user: UUID?, note: UUID) -> UIImage? {
        guard let fileName = item.imageFileName else { return nil }
        let url = directory(user: user, note: note).appending(path: fileName)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    static func delete(_ item: CodingItem, user: UUID?, note: UUID) -> [CodingItem] {
        let dir = directory(user: user, note: note)
        if let fileName = item.imageFileName {
            try? FileManager.default.removeItem(at: dir.appending(path: fileName))
        }
        let next = load(user: user, note: note).filter { $0.id != item.id }
        return save(next, user: user, note: note)
    }
}

// MARK: - Custom Mnemonic Hints for Flashcards (ReviewSession "İpucu göster")

enum CardHintStore {
    private static let key = "studymode.cardMnemonicHints.v1"

    static func hint(for cardId: UUID) -> String? {
        let dict = UserDefaults.standard.dictionary(forKey: key) as? [String: String]
        let val = dict?[cardId.uuidString.lowercased()]?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (val?.isEmpty == false) ? val : nil
    }

    static func save(_ hint: String, for cardId: UUID) {
        var dict = (UserDefaults.standard.dictionary(forKey: key) as? [String: String]) ?? [:]
        dict[cardId.uuidString.lowercased()] = String(hint.trimmingCharacters(in: .whitespacesAndNewlines).prefix(240))
        UserDefaults.standard.set(dict, forKey: key)
    }
}
