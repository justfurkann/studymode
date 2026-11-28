import Foundation
import SwiftUI
import UIKit

// MARK: - Istanbul Day Index (matches src/lib/miniGames.ts)

enum MiniGames {
    static func istanbulDay(now: Date = .now) -> Int {
        let ms = now.timeIntervalSince1970 * 1000.0
        return Int(floor((ms + 3.0 * 3_600_000.0) / 86_400_000.0))
    }
}

// MARK: - 1. Günün Kavramı (matches src/lib/wordGame.ts)

struct DailyTerm: Hashable {
    let word: String
    let subject: String
    let clue: String
}

enum LetterMark: Int, Comparable {
    case miss = 0
    case near = 1
    case hit = 2

    static func < (lhs: LetterMark, rhs: LetterMark) -> Bool { lhs.rawValue < rhs.rawValue }
}

struct WordSave: Codable {
    var day: Int
    var guesses: [String]
    var streak: Int
    var lastWin: Int?
    var played: Int
    var wins: Int
}

enum WordGame {
    static let maxGuesses = 6
    static let clueAfter = 3
    private static let storageKey = "studymode.kavram.v1"

    static let terms: [DailyTerm] = [
        .init(word: "MİTOZ", subject: "Biyoloji", clue: "Bir hücrenin, kromozom sayısı aynı iki hücreye bölünmesi."),
        .init(word: "PROTON", subject: "Kimya", clue: "Atom çekirdeğindeki artı yüklü parçacık."),
        .init(word: "FERMAN", subject: "Tarih", clue: "Padişahın yazılı buyruğu."),
        .init(word: "TÜREV", subject: "Matematik", clue: "Bir fonksiyonun anlık değişim hızı."),
        .init(word: "DELTA", subject: "Coğrafya", clue: "Akarsuyun denize döküldüğü yerde biriktirdiği üçgenimsi düzlük."),
        .init(word: "KAFİYE", subject: "Edebiyat", clue: "Dize sonlarındaki ses benzerliği."),
        .init(word: "FOTON", subject: "Fizik", clue: "Işığın enerji paketi; ışık parçacığı."),
        .init(word: "ENZİM", subject: "Biyoloji", clue: "Tepkimeleri hızlandıran, çoğu protein yapılı biyolojik katalizör."),
        .init(word: "ANAYASA", subject: "Hukuk", clue: "Devletin temel düzenini ve temel hakları belirleyen en üst yasa."),
        .init(word: "MUSON", subject: "Coğrafya", clue: "Mevsime göre yön değiştiren, yağış getiren rüzgâr."),
        .init(word: "VEKTÖR", subject: "Matematik", clue: "Hem büyüklüğü hem yönü olan nicelik."),
        .init(word: "LONCA", subject: "Tarih", clue: "Aynı meslekten esnafın oluşturduğu örgüt."),
        .init(word: "NÖRON", subject: "Biyoloji", clue: "Sinir sistemini oluşturan hücre."),
        .init(word: "MOLEKÜL", subject: "Kimya", clue: "İki ya da daha çok atomun bağlanmasıyla oluşan yapı."),
        .init(word: "DESTAN", subject: "Edebiyat", clue: "Bir topluluğun kahramanlıklarını anlatan uzun, manzum anlatı."),
        .init(word: "KUVVET", subject: "Fizik", clue: "Bir cismin hareketini ya da şeklini değiştirebilen etki."),
        .init(word: "TALEP", subject: "Ekonomi", clue: "Belli bir fiyattan alınmak istenen mal miktarı."),
        .init(word: "MAYOZ", subject: "Biyoloji", clue: "Üreme hücrelerini oluşturan, kromozom sayısını yarıya indiren bölünme."),
        .init(word: "DİVAN", subject: "Tarih", clue: "Osmanlı'da devlet işlerinin görüşüldüğü kurul."),
        .init(word: "LİMİT", subject: "Matematik", clue: "Bir fonksiyonun, bir noktaya yaklaşırken yaklaştığı değer."),
        .init(word: "MAGMA", subject: "Coğrafya", clue: "Yerin derinliklerindeki erimiş kaya."),
        .init(word: "EMPATİ", subject: "Psikoloji", clue: "Kendini başkasının yerine koyup onun duygularını anlama."),
        .init(word: "NÖTRON", subject: "Kimya", clue: "Atom çekirdeğindeki yüksüz parçacık."),
        .init(word: "MERCEK", subject: "Fizik", clue: "Işığı kırarak toplayan ya da dağıtan saydam cisim."),
        .init(word: "HORMON", subject: "Biyoloji", clue: "Kanla taşınıp başka organları etkileyen kimyasal ileti."),
        .init(word: "BERAT", subject: "Tarih", clue: "Padişahın bir göreve atama ya da ayrıcalık için verdiği belge."),
        .init(word: "MATRİS", subject: "Matematik", clue: "Satır ve sütunlara dizilmiş sayı tablosu."),
        .init(word: "KANYON", subject: "Coğrafya", clue: "Akarsuyun aşındırarak oluşturduğu derin, dik yamaçlı vadi."),
        .init(word: "ROMAN", subject: "Edebiyat", clue: "Uzun, kurgusal düzyazı anlatı."),
        .init(word: "GENOM", subject: "Biyoloji", clue: "Bir canlının bütün genetik bilgisi."),
        .init(word: "KATOT", subject: "Kimya", clue: "Pilde ya da elektrolizde indirgenmenin olduğu elektrot."),
        .init(word: "ENERJİ", subject: "Fizik", clue: "İş yapabilme yeteneği."),
        .init(word: "TIMAR", subject: "Tarih", clue: "Hizmet karşılığında geliri sipahiye bırakılan toprak."),
        .init(word: "İKLİM", subject: "Coğrafya", clue: "Bir yerde uzun yıllar boyunca görülen ortalama hava koşulları."),
        .init(word: "OSMOZ", subject: "Biyoloji", clue: "Suyun yarı geçirgen bir zardan, çözünen maddenin daha yoğun olduğu tarafa geçmesi."),
        .init(word: "EKONOMİ", subject: "Ekonomi", clue: "Kıt kaynakların sınırsız ihtiyaçlar için nasıl kullanıldığını inceleyen bilim."),
        .init(word: "DALGA", subject: "Fizik", clue: "Enerjiyi, maddeyi taşımadan ileten titreşim."),
        .init(word: "MECLİS", subject: "Vatandaşlık", clue: "Yasaları yapan, seçilmiş temsilcilerden oluşan kurul."),
        .init(word: "REFLEKS", subject: "Biyoloji", clue: "Bir uyarana karşı istem dışı, hızlı tepki."),
        .init(word: "METAFOR", subject: "Edebiyat", clue: "Bir şeyi benzetme edatı kullanmadan başka bir şeyle anlatma; eğretileme."),
        .init(word: "İNTEGRAL", subject: "Matematik", clue: "Eğri altındaki alanı da veren, türevin tersi olan işlem."),
        .init(word: "PLAZMA", subject: "Biyoloji", clue: "Kanın sıvı kısmı."),
        .init(word: "ELEKTRON", subject: "Kimya", clue: "Çekirdeğin çevresinde bulunan eksi yüklü parçacık.")
    ]

    static func dailyTerm(now: Date = .now) -> DailyTerm {
        let day = MiniGames.istanbulDay(now: now)
        let idx = ((day * 17 + 5) % terms.count + terms.count) % terms.count
        return terms[idx]
    }

    /// Validates that a guess is a real Turkish word (either one of our study terms or accepted by iOS's built-in `tr_TR` dictionary).
    @MainActor
    static func isValidTurkishWord(_ guess: String) -> Bool {
        if terms.contains(where: { $0.word == guess }) { return true }
        // Reject obvious gibberish (all same char, no Turkish vowels)
        let vowels = Set("AEIİOÖUÜ")
        if Set(guess).count <= 1 || !guess.contains(where: { vowels.contains($0) }) { return false }
        let lower = guess.lowercased(with: Locale(identifier: "tr_TR"))
        let checker = UITextChecker()
        let langs = UITextChecker.availableLanguages
        let lang = langs.first(where: { $0 == "tr_TR" || $0.hasPrefix("tr") })
        guard let lang else { return true }
        let nsRange = NSRange(location: 0, length: (lower as NSString).length)
        let miss = checker.rangeOfMisspelledWord(in: lower, range: nsRange, startingAt: 0, wrap: false, language: lang)
        if miss.location == NSNotFound { return true }
        // Also check capitalized form (proper nouns / academic terms)
        let cap = lower.prefix(1).uppercased(with: Locale(identifier: "tr_TR")) + lower.dropFirst()
        let capRange = NSRange(location: 0, length: (cap as NSString).length)
        let capMiss = checker.rangeOfMisspelledWord(in: cap, range: capRange, startingAt: 0, wrap: false, language: lang)
        return capMiss.location == NSNotFound
    }

    static func markGuess(_ guess: String, answer: String) -> [LetterMark] {
        let g = Array(guess)
        let a = Array(answer)
        var marks = Array(repeating: LetterMark.miss, count: g.count)
        var left: [Character: Int] = [:]

        for (i, ch) in a.enumerated() {
            if i < g.count && g[i] == ch {
                marks[i] = .hit
            } else {
                left[ch, default: 0] += 1
            }
        }
        for (i, ch) in g.enumerated() where marks[i] != .hit {
            if let count = left[ch], count > 0 {
                marks[i] = .near
                left[ch] = count - 1
            }
        }
        return marks
    }

    static func letterMarks(guesses: [String], answer: String) -> [Character: LetterMark] {
        var out: [Character: LetterMark] = [:]
        for g in guesses {
            let chars = Array(g)
            let marks = markGuess(g, answer: answer)
            for (i, m) in marks.enumerated() where i < chars.count {
                let c = chars[i]
                if let old = out[c] {
                    if m > old { out[c] = m }
                } else {
                    out[c] = m
                }
            }
        }
        return out
    }

    static func shareText(day: Int, guesses: [String], answer: String, won: Bool, clueOpened: Bool) -> String {
        let date = Date(timeIntervalSince1970: Double(day) * 86_400.0)
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(secondsFromGMT: 0) ?? .gmt
        let d = cal.component(.day, from: date)
        let m = cal.component(.month, from: date)
        let label = String(format: "%02d.%02d", d, m)
        let rows = guesses.map { g in
            markGuess(g, answer: answer).map { mark -> String in
                switch mark {
                case .hit: "🟩"
                case .near: "🟨"
                case .miss: "⬜️"
                }
            }.joined()
        }
        let score = "\(won ? "\(guesses.count)" : "X")/\(maxGuesses)\(clueOpened ? " (ipucuyla)" : "")"
        return (["StudyMode · Günün Kavramı \(label)", score] + rows + ["studymode.fun"]).joined(separator: "\n")
    }

    static func loadSave(today: Int = MiniGames.istanbulDay()) -> WordSave {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let saved = try? JSONDecoder().decode(WordSave.self, from: data) else {
            return WordSave(day: today, guesses: [], streak: 0, lastWin: nil, played: 0, wins: 0)
        }
        var base = WordSave(
            day: today,
            guesses: saved.day == today ? saved.guesses : [],
            streak: saved.streak,
            lastWin: saved.lastWin,
            played: saved.played,
            wins: saved.wins
        )
        if let lw = base.lastWin, today - lw > 1 { base.streak = 0 }
        return base
    }

    static func save(_ state: WordSave) {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    static func addGuess(_ state: WordSave, guess: String, answer: String) -> WordSave {
        var next = state
        next.guesses.append(guess)
        let won = guess == answer
        let over = won || next.guesses.count >= maxGuesses
        if over {
            next.played += 1
            if won {
                next.wins += 1
                next.streak = (state.lastWin == state.day - 1) ? state.streak + 1 : 1
                next.lastWin = state.day
            } else {
                next.streak = 0
            }
        }
        save(next)
        return next
    }
}

// MARK: - 2. Çekmece (Academic Merge Puzzle — matches src/lib/miniGames.ts)

struct DrawerItemSpec {
    let level: Int
    let name: String
    let short: String
    let icon: String
    let color: Color
}

struct DrawerChapter: Identifiable {
    let id: Int
    let target: Int
    let seconds: Int
    let base: Int
}

enum DrawerLogic {
    static let size = 4
    static let maxLevel = 11
    private static let starsKey = "studymode.cekmece.stars.v1"

    static let items: [DrawerItemSpec] = [
        .init(level: 1, name: "Kurşun kalem", short: "Kalem", icon: "pencil", color: Color(light: 0x64748B, dark: 0x94A3B8)),
        .init(level: 2, name: "Tükenmez kalem", short: "Tükenmez", icon: "pencil.tip", color: Color(light: 0x2563EB, dark: 0x60A5FA)),
        .init(level: 3, name: "Fosforlu kalem", short: "Fosforlu", icon: "highlighter", color: Color(light: 0xCA8A04, dark: 0xFACC15)),
        .init(level: 4, name: "Defter", short: "Defter", icon: "book.closed.fill", color: Color(light: 0x059669, dark: 0x34D399)),
        .init(level: 5, name: "Kitap", short: "Kitap", icon: "books.vertical.fill", color: Color(light: 0x0D9488, dark: 0x2DD4BF)),
        .init(level: 6, name: "Ders notu", short: "Not", icon: "doc.text.fill", color: Color(light: 0xEA580C, dark: 0xFB923C)),
        .init(level: 7, name: "Mezuniyet kepi", short: "Kep", icon: "graduationcap.fill", color: Color(light: 0x7C3AED, dark: 0xA78BFA)),
        .init(level: 8, name: "Diploma", short: "Diploma", icon: "scroll.fill", color: Color(light: 0xDB2777, dark: 0xF472B6)),
        .init(level: 9, name: "Yüksek lisans", short: "Y. Lisans", icon: "medal.fill", color: Color(light: 0x9333EA, dark: 0xC084FC)),
        .init(level: 10, name: "Doktora", short: "Doktora", icon: "star.circle.fill", color: Color(light: 0xD97706, dark: 0xFBBF24)),
        .init(level: 11, name: "Profesörlük", short: "Prof.", icon: "crown.fill", color: Color(light: 0xB91C1C, dark: 0xF87171))
    ]

    static func spec(for level: Int) -> DrawerItemSpec {
        items[max(0, min(items.count - 1, level - 1))]
    }

    static let chapters: [DrawerChapter] = [
        .init(id: 0, target: 2, seconds: 20, base: 1),
        .init(id: 1, target: 3, seconds: 30, base: 1),
        .init(id: 2, target: 4, seconds: 40, base: 1),
        .init(id: 3, target: 5, seconds: 60, base: 1),
        .init(id: 4, target: 6, seconds: 100, base: 1),
        .init(id: 5, target: 7, seconds: 200, base: 1),
        .init(id: 6, target: 8, seconds: 190, base: 2),
        .init(id: 7, target: 9, seconds: 180, base: 3),
        .init(id: 8, target: 10, seconds: 170, base: 4),
        .init(id: 9, target: 11, seconds: 160, base: 5)
    ]

    static func newGrid(base: Int) -> [Int?] {
        var grid = Array<Int?>(repeating: nil, count: size * size)
        for _ in 0..<4 { grid = spawnItem(grid, base: base) }
        return grid
    }

    static func spawnItem(_ grid: [Int?], base: Int) -> [Int?] {
        let free = grid.indices.filter { grid[$0] == nil }
        guard let pick = free.randomElement() else { return grid }
        var next = grid
        next[pick] = Double.random(in: 0..<1) < 0.12 ? min(maxLevel, base + 1) : base
        return next
    }

    static func canMerge(_ grid: [Int?], from: Int, to: Int) -> Bool {
        guard from != to, grid.indices.contains(from), grid.indices.contains(to),
              let a = grid[from], let b = grid[to] else { return false }
        return a == b && a < maxLevel
    }

    static func merge(_ grid: [Int?], from: Int, to: Int) -> (grid: [Int?], points: Int, level: Int)? {
        guard canMerge(grid, from: from, to: to), let cur = grid[to] else { return nil }
        let level = cur + 1
        var next = grid
        next[from] = nil
        next[to] = level
        return (next, 1 << level, level)
    }

    static func findPair(_ grid: [Int?]) -> (Int, Int)? {
        var first: [Int: Int] = [:]
        for (i, val) in grid.enumerated() {
            guard let v = val, v < maxLevel else { continue }
            if let j = first[v] { return (j, i) }
            first[v] = i
        }
        return nil
    }

    static func isStuck(_ grid: [Int?]) -> Bool {
        if grid.contains(where: { $0 == nil }) { return false }
        return findPair(grid) == nil
    }

    static func stars(leftSec: Int, totalSec: Int) -> Int {
        let share = totalSec > 0 ? Double(leftSec) / Double(totalSec) : 0
        return share >= 0.4 ? 3 : (share >= 0.2 ? 2 : 1)
    }

    static func loadStars() -> [Int] {
        let saved = (UserDefaults.standard.array(forKey: starsKey) as? [Int]) ?? []
        return chapters.indices.map { i in i < saved.count ? max(0, min(3, saved[i])) : 0 }
    }

    @discardableResult
    static func saveStar(chapter: Int, stars: Int) -> [Int] {
        var all = loadStars()
        if all.indices.contains(chapter) {
            all[chapter] = max(all[chapter], stars)
        }
        UserDefaults.standard.set(all, forKey: starsKey)
        return all
    }

    static func isChapterOpen(_ stars: [Int], index: Int) -> Bool {
        index == 0 || (index - 1 < stars.count && stars[index - 1] > 0)
    }
}

// MARK: - 3. Kâğıt top (Best Streak)

enum PaperTossStore {
    private static let bestKey = "studymode.paperToss.best.v1"

    static var bestStreak: Int {
        get { UserDefaults.standard.integer(forKey: bestKey) }
        set { UserDefaults.standard.set(max(bestStreak, newValue), forKey: bestKey) }
    }
}
