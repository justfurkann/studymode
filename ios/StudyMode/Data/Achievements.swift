import Foundation
import Supabase

/// Achievements and levels, ported from src/lib/achievements.ts and src/lib/xp.ts. Unlocked ones
/// follow the account in user_metadata.achievements ({id: ISO date}), so the site and the app show the
/// same collection; ones an admin took back are listed in user_metadata.achievements_held and never
/// come back by themselves. XP is not stored: it is worked out from the study data, like on the site.
enum Rarity: String, CaseIterable {
    case yaygin, nadir, destansi, efsanevi
    var label: String {
        switch self {
        case .yaygin: "Yaygın"
        case .nadir: "Nadir"
        case .destansi: "Destansı"
        case .efsanevi: "Efsanevi"
        }
    }
    /// ACHIEVEMENT_XP
    var xp: Int {
        switch self {
        case .yaygin: 20
        case .nadir: 50
        case .destansi: 100
        case .efsanevi: 250
        }
    }
}

struct Achievement: Identifiable {
    let id: String
    let name: String
    let description: String
    let rarity: Rarity
    let icon: String
    var goal: Int? = nil
    /// Hidden ones show only this hint until found.
    var hint: String? = nil
    var isHidden: Bool { hint != nil }

    static let all: [Achievement] = [
        .init(id: "ilk-adim", name: "İlk Adım", description: "İlk kartını tekrar ettin.", rarity: .yaygin, icon: "shoeprints.fill", goal: 1),
        .init(id: "seri-3", name: "Isınma Turu", description: "3 gün üst üste çalıştın.", rarity: .yaygin, icon: "flame", goal: 3),
        .init(id: "seri-7", name: "Bir Haftalık Ateş", description: "7 gün üst üste çalıştın.", rarity: .nadir, icon: "flame.fill", goal: 7),
        .init(id: "yuz-tekrar", name: "Yüz Kart", description: "Toplam 100 kart tekrar ettin.", rarity: .destansi, icon: "square.stack.3d.up.fill", goal: 100),
        .init(id: "kusursuz", name: "Kusursuz", description: "Bir testi hiç yanlışsız bitirdin.", rarity: .nadir, icon: "target"),
        .init(id: "odak-ustasi", name: "Odak Ustası", description: "Bir günde 4 odak turu tamamladın.", rarity: .destansi, icon: "timer", goal: 4),
        .init(id: "kendini-tani", name: "Kendini Tanı", description: "\"Hangi öğrenci tipisin?\" testini çözdün.", rarity: .yaygin, icon: "sparkles"),
        .init(id: "fis", name: "Kasadan Geçti", description: "İlk çalışma fişini kestin.", rarity: .yaygin, icon: "receipt"),
        .init(id: "cok-yuzlu", name: "Çok Yüzlü", description: "Testte 3 farklı öğrenci tipi çıkardın.", rarity: .destansi, icon: "theatermasks", hint: "Bir kez çözmek yetmez; insan değişir."),
        .init(id: "gece-kusu", name: "Gece Kuşu", description: "Gece 03.00'te buradaydın. Uyu artık.", rarity: .destansi, icon: "moon.stars", hint: "Herkes uyurken, saat üçü gösterirken."),
        .init(id: "erkenci", name: "Erkenci Kuş", description: "Sabah 06.00 olmadan çalışmaya geldin.", rarity: .nadir, icon: "sunrise", hint: "Güneş doğmadan önce."),
        .init(id: "gece-yarisi", name: "Gün Dönümü", description: "Gün tam değişirken, 00.00’da buradaydın.", rarity: .efsanevi, icon: "clock", hint: "Takvim yaprağı koparken burada ol."),
        .init(id: "dedektif", name: "Dedektif", description: "Gizlilik politikasının sonundaki gizli düğmeyi buldun. Kimse oraya kadar okumaz.", rarity: .destansi, icon: "magnifyingglass", hint: "Kimsenin sonuna kadar okumadığı o sayfa."),
        .init(id: "glitch", name: "Glitch Hunter", description: "Sistemi bozan kombinasyonu buldun.", rarity: .efsanevi, icon: "bolt.fill", hint: "Bazı logolar dokunulmayı sever. Çok. Klavyesi olanlar eski bir şifreyi de dener."),
        .init(id: "kurcalamaci", name: "Kurcalamacı", description: "Yapımcının fotoğrafına beş kez dokundun.", rarity: .nadir, icon: "camera", hint: "Yapımcının fotoğrafı bir şey saklıyor."),
        .init(id: "kayip-sayfa", name: "Kayıp Sayfa", description: "Var olmayan bir adrese gittin.", rarity: .yaygin, icon: "map", hint: "Haritada olmayan bir yere git."),
        .init(id: "tema-dj", name: "Işık DJ’i", description: "Temayı arka arkaya 10 kez değiştirdin.", rarity: .nadir, icon: "circle.lefthalf.filled", hint: "Aç, kapa, aç, kapa…"),
        .init(id: "kalem-koleksiyonu", name: "Kalem Kutusu", description: "Bütün fosforlu kalem renklerini denedin.", rarity: .nadir, icon: "highlighter", hint: "Sarı tek renk değil."),
        .init(id: "ses-muhendisi", name: "Ses Mühendisi", description: "Yağmur, kafe, şömine ve odak seslerini aynı anda açtın.", rarity: .nadir, icon: "speaker.wave.3", hint: "Bütün sesler bir arada."),
        .init(id: "koleksiyoncu", name: "Koleksiyoncu", description: "10 başarım topladın.", rarity: .efsanevi, icon: "trophy.fill", goal: 10),
    ]

    static let byId = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
}

struct LevelInfo {
    let level: Int
    let title: String
    let into: Int
    let span: Int
    var toNext: Int { span - into }
    var progress: Double { span > 0 ? Double(into) / Double(span) : 0 }

    private static let titles: [(Int, String)] = [
        (1, "Çaylak"), (3, "Not Avcısı"), (5, "Kart Ustası"), (8, "Fosforlu Kalem"), (12, "Kütüphane Müdavimi"),
        (16, "Vize Savaşçısı"), (20, "Final Bükücü"), (25, "Bölüm Birincisi"), (30, "Profesör"), (40, "Efsane"),
    ]

    /// Total XP needed to reach `level` (level 1 at 0): 100, 300, 600, 1000, …
    static func xpFor(_ level: Int) -> Int { 50 * (level - 1) * level }

    static func title(_ level: Int) -> String { titles.last { level >= $0.0 }?.1 ?? "Çaylak" }

    static func of(_ total: Int) -> LevelInfo {
        let xp = max(0, total)
        var level = 1
        while xpFor(level + 1) <= xp { level += 1 }
        let start = xpFor(level)
        return LevelInfo(level: level, title: title(level), into: xp - start, span: xpFor(level + 1) - start)
    }

    static func nextTitle(after level: Int) -> (level: Int, title: String)? {
        titles.first { $0.0 > level }.map { ($0.0, $0.1) }
    }
}

struct XpPart: Identifiable {
    let id: String
    let label: String
    let count: Int
    let xp: Int
}

private struct DayTotalsRow: Decodable { let reviews: Int; let quizzes: Int; let actions: Int? }

extension StudyStore {
    /// Every study day of the account (one small row a day), for XP and the 100-card goal.
    func allStudyDays() async throws -> [StudyDayCount] {
        do {
            return try await supabase.from("study_days").select("day,reviews,quizzes,actions").execute().value
        } catch {
            return days
        }
    }

    /// computeXp: cards 2, tests and exams 15, perfect test +10, mock exam +25, prepared note 20,
    /// written answer 3, studied day 10, achievement 20-250.
    func xpParts(allDays: [StudyDayCount], unlocked: [String: String]) -> [XpPart] {
        let reviews = allDays.reduce(0) { $0 + $1.reviews }
        let quizzes = allDays.reduce(0) { $0 + $1.quizzes }
        let actions = allDays.reduce(0) { $0 + ($1.actions ?? 0) }
        let studied = allDays.filter(\.studied).count
        let perfect = attempts.filter { $0.total > 0 && $0.score == $0.total }.count
        let mocks = examResults.count
        let prepared = notes.filter { $0.generator != nil }.count
        let achievementXp = unlocked.keys.compactMap { Achievement.byId[$0]?.rarity.xp }.reduce(0, +)
        return [
            XpPart(id: "review", label: "Çevrilen kart", count: reviews, xp: reviews * 2),
            XpPart(id: "quiz", label: "Bitirilen test ve sınav", count: quizzes, xp: quizzes * 15),
            XpPart(id: "perfect", label: "Hatasız test bonusu", count: perfect, xp: perfect * 10),
            XpPart(id: "exam", label: "Sınav provası bonusu", count: mocks, xp: mocks * 25),
            XpPart(id: "note", label: "Hazırlanan not", count: prepared, xp: prepared * 20),
            XpPart(id: "action", label: "Yazılı cevap ve açıklama", count: actions, xp: actions * 3),
            XpPart(id: "day", label: "Çalışılan gün", count: studied, xp: studied * 10),
            XpPart(id: "achievement", label: "Başarım", count: unlocked.count, xp: achievementXp),
        ]
    }

    /// studyProgress: progress toward the visible goals.
    func achievementProgress(allDays: [StudyDayCount]) -> [String: (value: Int, goal: Int)] {
        let reviews = allDays.reduce(0) { $0 + $1.reviews }
        let perfect = attempts.contains { $0.total > 0 && $0.score == $0.total }
            || examResults.contains { $0.total > 0 && $0.score >= Double($0.total) }
        return [
            "ilk-adim": (min(1, reviews), 1),
            "seri-3": (min(3, streak), 3),
            "seri-7": (min(7, streak), 7),
            "yuz-tekrar": (min(100, reviews), 100),
            "kusursuz": (perfect ? 1 : 0, 1),
        ]
    }
}

/// The account's collection, read from and written to user_metadata like the site does.
enum AchievementSync {
    static func unlocked(in metadata: [String: AnyJSON]) -> [String: String] {
        guard case let .object(map)? = metadata["achievements"] else { return [:] }
        var out: [String: String] = [:]
        for (id, value) in map where Achievement.byId[id] != nil {
            if case let .string(date) = value { out[id] = date }
        }
        return out
    }

    static func held(in metadata: [String: AnyJSON]) -> (ids: [String], at: String) {
        guard case let .object(h)? = metadata["achievements_held"],
              case let .array(ids)? = h["ids"], case let .string(at)? = h["at"] else { return ([], "") }
        return (ids.compactMap { if case let .string(s) = $0 { s } else { nil } }, at)
    }

    /// Goals reached and clock discoveries, minus held ones; Koleksiyoncu at 10.
    static func newlyEarned(current: [String: String], held: [String], progress: [String: (value: Int, goal: Int)], now: Date = .now) -> [String] {
        var earned = progress.filter { $0.value.value >= $0.value.goal }.map(\.key)
        let c = Calendar.current.dateComponents([.hour, .minute], from: now)
        if c.hour == 3 { earned.append("gece-kusu") }
        if let h = c.hour, h >= 4, h < 6 { earned.append("erkenci") }
        if c.hour == 0, c.minute == 0 { earned.append("gece-yarisi") }
        var fresh = earned.filter { current[$0] == nil && !held.contains($0) }
        let total = current.count + fresh.count
        if total >= 10, current["koleksiyoncu"] == nil, !fresh.contains("koleksiyoncu"), !held.contains("koleksiyoncu") {
            fresh.append("koleksiyoncu")
        }
        return Array(Set(fresh))
    }
}

extension AuthModel {
    var unlockedAchievements: [String: String] { AchievementSync.unlocked(in: session?.user.userMetadata ?? [:]) }
    var heldAchievements: [String] { AchievementSync.held(in: session?.user.userMetadata ?? [:]).ids }

    /// Adds achievements to the account (the site merges the same map), keeping the held list as is.
    func addAchievements(_ ids: [String], at date: Date = .now) async throws {
        guard !ids.isEmpty else { return }
        var map: [String: AnyJSON] = [:]
        for (id, d) in unlockedAchievements { map[id] = .string(d) }
        let stamp = ISO.string(date)
        for id in ids where map[id] == nil { map[id] = .string(stamp) }
        let user = try await supabase.auth.update(user: UserAttributes(data: ["achievements": .object(map)]))
        updateSessionUser(user)
    }
}
