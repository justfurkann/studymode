import Foundation

enum PDFInbox {
    struct CourseChoice: Codable, Identifiable, Equatable {
        let id: UUID
        let name: String
    }
    struct Catalog: Codable, Equatable {
        let user: UUID
        let courses: [CourseChoice]
    }
    struct Item: Codable, Identifiable, Equatable {
        let id: UUID
        let user: UUID
        let course: UUID?
        let title: String
        let date: Date
        var folder: URL? { PDFInbox.root?.appendingPathComponent(id.uuidString) }
        var file: URL? { folder?.appendingPathComponent("source.pdf") }
        func remove() throws { if let folder { try FileManager.default.removeItem(at: folder) } }
    }
    private static var root: URL? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "StudyShareGroup") as? String else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    }
    static func publish(_ catalog: Catalog?) throws {
        guard let url = root?.appendingPathComponent("courses.json") else { throw CocoaError(.fileNoSuchFile) }
        if let catalog { try JSONEncoder().encode(catalog).write(to: url, options: .atomic) }
        else if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
    static func catalog() -> Catalog? {
        guard let url = root?.appendingPathComponent("courses.json"), let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Catalog.self, from: data)
    }
    static func enqueue(_ source: URL, title: String, user: UUID, course: UUID?) throws {
        guard let root, catalog()?.user == user else { throw CocoaError(.userCancelled) }
        let item = Item(id: UUID(), user: user, course: course, title: title, date: .now)
        let temp = root.appendingPathComponent(".incoming-" + item.id.uuidString)
        let fm = FileManager.default
        try fm.createDirectory(at: temp, withIntermediateDirectories: false)
        defer { if fm.fileExists(atPath: temp.path) { try? fm.removeItem(at: temp) } }
        try fm.copyItem(at: source, to: temp.appendingPathComponent("source.pdf"))
        try JSONEncoder().encode(item).write(to: temp.appendingPathComponent("item.json"))
        try fm.moveItem(at: temp, to: root.appendingPathComponent(item.id.uuidString))
    }
    static func items(for user: UUID?) -> [Item] {
        guard let root, let user, let files = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil, options: .skipsHiddenFiles) else { return [] }
        return files.compactMap { folder -> Item? in
            guard UUID(uuidString: folder.lastPathComponent) != nil,
                  let data = try? Data(contentsOf: folder.appendingPathComponent("item.json")),
                  let item = try? JSONDecoder().decode(Item.self, from: data),
                  item.id.uuidString == folder.lastPathComponent, item.user == user else { return nil }
            return item
        }.sorted { $0.date < $1.date }
    }
}
