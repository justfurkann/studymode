import Foundation

struct ReadingPlace: Codable, Equatable {
    let noteID: UUID
    let section: NoteDetailView.Section
    let index: Int

    var label: String {
        switch section {
        case .terms: "Kavramlardan devam et"
        case .points: "\(index + 1). ana noktadan devam et"
        case .full: "Tam özet · \(index + 1). bölümden devam et"
        }
    }

    static func latest(for user: UUID?) -> ReadingPlace? {
        guard let user, let data = UserDefaults.standard.data(forKey: "reader.\(user)") else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }
    static func saved(note: UUID, user: UUID?) -> ReadingPlace? {
        guard let user, let data = UserDefaults.standard.data(forKey: "reader.\(user).\(note)") else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }
    func save(for user: UUID?) {
        guard let user, let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: "reader.\(user).\(noteID)")
        UserDefaults.standard.set(data, forKey: "reader.\(user)")
    }
}
