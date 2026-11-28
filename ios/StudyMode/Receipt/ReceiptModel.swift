import Foundation
import SwiftUI
import UIKit

// MARK: - Period & Themes (Compatible with src/lib/receipt.ts + iOS Studio Editions)

enum ReceiptPeriod: String, Codable, CaseIterable, Identifiable {
    case gun
    case hafta

    var id: String { rawValue }

    var segmentTitle: String {
        switch self {
        case .gun: "Bugün"
        case .hafta: "Bu hafta"
        }
    }

    var ledgerTitle: String {
        switch self {
        case .gun: "BUGÜN · GÜNLÜK MESAİ"
        case .hafta: "SON 7 GÜN · HAFTALIK ÖZET"
        }
    }

    var daysCount: Int {
        switch self {
        case .gun: 1
        case .hafta: 7
        }
    }
}

enum ReceiptThemeId: String, Codable, CaseIterable, Identifiable {
    case klasik
    case gece
    case espresso
    case pembe
    case kobalt

    var id: String { rawValue }

    var label: String {
        switch self {
        case .klasik: "Fosforlu"
        case .gece: "Gece"
        case .espresso: "Espresso"
        case .pembe: "Pembe"
        case .kobalt: "Kobalt"
        }
    }

    var subtitle: String {
        switch self {
        case .klasik: "Klasik fiş"
        case .gece: "Gece vardiyası"
        case .espresso: "Kafe masası"
        case .pembe: "Kampüs pembe"
        case .kobalt: "Buz mavisi"
        }
    }

    var palette: ReceiptPalette {
        switch self {
        case .klasik:
            ReceiptPalette(
                storyBgHex: 0xF6F5EE,
                paperHex: 0xFFFDF7,
                inkHex: 0x1B2250,
                inkSoftHex: 0x565C82,
                lineHex: 0xDDD9CB,
                hiHex: 0xFFE14D,
                onHiHex: 0x1B2250,
                stampHex: 0x253DA1,
                auraHex: 0xFFE14D,
                tapeHex: 0xFFE875,
                isDarkPaper: false
            )
        case .gece:
            ReceiptPalette(
                storyBgHex: 0x0B0E20,
                paperHex: 0x141832,
                inkHex: 0xF4F3EA,
                inkSoftHex: 0x9DA2C4,
                lineHex: 0x2A3058,
                hiHex: 0xFFE14D,
                onHiHex: 0x141832,
                stampHex: 0xFFE14D,
                auraHex: 0x4F5BD5,
                tapeHex: 0xFFE14D,
                isDarkPaper: true
            )
        case .espresso:
            ReceiptPalette(
                storyBgHex: 0xEFE7DC,
                paperHex: 0xFAF3E8,
                inkHex: 0x2D1E14,
                inkSoftHex: 0x765B48,
                lineHex: 0xDECFC0,
                hiHex: 0xF4B942,
                onHiHex: 0x2D1E14,
                stampHex: 0xA8432B,
                auraHex: 0xF4B942,
                tapeHex: 0xE6C79C,
                isDarkPaper: false
            )
        case .pembe:
            ReceiptPalette(
                storyBgHex: 0xFBEBF1,
                paperHex: 0xFFF5F8,
                inkHex: 0x3E1A2E,
                inkSoftHex: 0x86536E,
                lineHex: 0xECCAD9,
                hiHex: 0xFF8FB8,
                onHiHex: 0x3E1A2E,
                stampHex: 0xC8336B,
                auraHex: 0xFF8FB8,
                tapeHex: 0xFFB3CF,
                isDarkPaper: false
            )
        case .kobalt:
            ReceiptPalette(
                storyBgHex: 0xEAF1FB,
                paperHex: 0xF6FAFF,
                inkHex: 0x0F2547,
                inkSoftHex: 0x4E6891,
                lineHex: 0xCBD9EE,
                hiHex: 0x67E8F9,
                onHiHex: 0x0F2547,
                stampHex: 0x1D4ED8,
                auraHex: 0x38BDF8,
                tapeHex: 0x93C5FD,
                isDarkPaper: false
            )
        }
    }
}

/// Fixed RGB colors so thermal paper looks identical regardless of system Light/Dark mode.
struct ReceiptPalette: Equatable {
    let storyBgHex: UInt32
    let paperHex: UInt32
    let inkHex: UInt32
    let inkSoftHex: UInt32
    let lineHex: UInt32
    let hiHex: UInt32
    let onHiHex: UInt32
    let stampHex: UInt32
    let auraHex: UInt32
    let tapeHex: UInt32
    let isDarkPaper: Bool

    var storyBg: Color { Color(uiColor: UIColor(hex: storyBgHex)) }
    var paper: Color { Color(uiColor: UIColor(hex: paperHex)) }
    var ink: Color { Color(uiColor: UIColor(hex: inkHex)) }
    var inkSoft: Color { Color(uiColor: UIColor(hex: inkSoftHex)) }
    var line: Color { Color(uiColor: UIColor(hex: lineHex)) }
    var hi: Color { Color(uiColor: UIColor(hex: hiHex)) }
    var onHi: Color { Color(uiColor: UIColor(hex: onHiHex)) }
    var stamp: Color { Color(uiColor: UIColor(hex: stampHex)) }
    var aura: Color { Color(uiColor: UIColor(hex: auraHex)) }
    var tape: Color { Color(uiColor: UIColor(hex: tapeHex)) }
}

// MARK: - Saved Preferences (Compatible with studymode.receiptPrefs.v1)

struct ReceiptPrefs: Codable, Equatable {
    var studentName: String
    var studentTag: String
    var motto: String
    var theme: ReceiptThemeId
    var showIdentity: Bool

    private static let storageKey = "studymode.receiptPrefs.v1"

    static let moodPresets: [String] = [
        "Kütüphane kapanana kadar.",
        "Bir kahve daha, bir konu daha.",
        "Sessizce birikiyor.",
        "Panik yok, plan var.",
        "Yarına bırakmadım.",
        "Fosforlu kalem bitene kadar.",
    ]

    init(
        studentName: String = "",
        studentTag: String = "",
        motto: String = "",
        theme: ReceiptThemeId = .klasik,
        showIdentity: Bool = true
    ) {
        self.studentName = studentName
        self.studentTag = studentTag
        self.motto = motto
        self.theme = theme
        self.showIdentity = showIdentity
    }

    enum CodingKeys: String, CodingKey {
        case studentName, studentTag, motto, theme, showIdentity
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        studentName = (try? c.decode(String.self, forKey: .studentName)) ?? ""
        studentTag = (try? c.decode(String.self, forKey: .studentTag)) ?? ""
        motto = (try? c.decode(String.self, forKey: .motto)) ?? ""
        if let rawTheme = try? c.decode(String.self, forKey: .theme),
           let parsed = ReceiptThemeId(rawValue: rawTheme) {
            theme = parsed
        } else {
            theme = .klasik
        }
        showIdentity = (try? c.decode(Bool.self, forKey: .showIdentity)) ?? true
    }

    static func load(defaultName: String, defaultTag: String) -> ReceiptPrefs {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           var saved = try? JSONDecoder().decode(ReceiptPrefs.self, from: data) {
            if saved.studentName.trimmingCharacters(in: .whitespaces).isEmpty && !defaultName.isEmpty {
                saved.studentName = defaultName
            }
            if saved.studentTag.trimmingCharacters(in: .whitespaces).isEmpty && !defaultTag.isEmpty {
                saved.studentTag = defaultTag
            }
            return saved
        }
        return ReceiptPrefs(
            studentName: defaultName,
            studentTag: defaultTag,
            theme: .klasik,
            showIdentity: true
        )
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }
}

// MARK: - Computed Receipt Data

struct ReceiptCourseLine: Identifiable, Equatable {
    let courseId: UUID
    let name: String
    let colorHex: String
    var cards: Int
    var quizzes: Int
    var exams: Int
    var notesTouched: Int

    var id: UUID { courseId }

    var tint: Color { Color(hexString: colorHex) ?? Color(uiColor: UIColor(hex: 0x1B2250)) }

    var activitySummary: String {
        var parts: [String] = []
        if cards > 0 { parts.append("\(cards) KART") }
        if quizzes > 0 { parts.append("\(quizzes) TEST") }
        if exams > 0 { parts.append("\(exams) PROVA") }
        if parts.isEmpty && notesTouched > 0 { parts.append("\(notesTouched) NOT") }
        return parts.isEmpty ? "AKTİF" : parts.joined(separator: " · ")
    }

    var weightScore: Int {
        cards + quizzes * 8 + exams * 14 + notesTouched * 3
    }
}

struct ReceiptWeekDot: Identifiable, Equatable {
    let key: String
    let shortLabel: String
    let studied: Bool
    let isToday: Bool
    let level: Int // 0...3

    var id: String { key }
}

struct ReceiptRank: Equatable {
    let grade: String
    let label: String
}

struct ReceiptStats: Equatable {
    let period: ReceiptPeriod
    let generatedAt: Date
    let dateLabel: String
    let timeLabel: String
    let receiptNo: String
    let registerTag: String
    let focusMinutes: Int
    let focusRounds: Int
    let reviews: Int
    let quizzes: Int
    let mockExams: Int
    let actions: Int
    let avgQuizScore: Int?
    let streak: Int
    let activeDays: Int
    let byCourse: [ReceiptCourseLine]
    let weekDots: [ReceiptWeekDot]
    let effortPoints: Int
    let rank: ReceiptRank
    let verdict: String
    let barcodeSeed: UInt32
    let serialCode: String

    var focusFormatted: String {
        if focusMinutes <= 0 { return "—" }
        let h = focusMinutes / 60
        let m = focusMinutes % 60
        if h == 0 { return "\(m) dk" }
        if m == 0 { return "\(h) sa" }
        return "\(h) sa \(m) dk"
    }

    var focusSubtext: String {
        if focusRounds > 0 {
            return "\(focusRounds) odak turu"
        }
        return focusMinutes > 0 ? "Odak sayacı" : "Mola sayacından"
    }

    var reviewSubtext: String {
        var parts: [String] = []
        if quizzes > 0 { parts.append("\(quizzes) test") }
        if mockExams > 0 { parts.append("\(mockExams) prova") }
        if parts.isEmpty {
            return period == .gun ? "Bugünkü tekrar" : "7 günlük tekrar"
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Builder (1:1 Port + Enriched Signals from StudyStore & MolaRecords)

enum ReceiptBuilder {
    private static let registerTags = [
        "#KÜTÜPHANE",
        "#MASA-LAMBASI",
        "#SON-TEKRAR",
        "#FOSFORLU",
        "#ODAK-MODU",
        "#KAMPÜS-KASA",
    ]

    /// FNV-1a 32-bit deterministic hash (same algorithm as src/lib/receipt.ts).
    static func fnv1a(_ text: String) -> UInt32 {
        var h: UInt32 = 2_166_136_261
        for byte in text.utf8 {
            h ^= UInt32(byte)
            h = h &* 16_777_619
        }
        return h
    }

    @MainActor
    static func build(store: StudyStore, period: ReceiptPeriod, now: Date = .now) -> ReceiptStats {
        let cal = Calendar.current
        let dayKeys: [String] = (0..<period.daysCount).map { offset in
            let d = cal.date(byAdding: .day, value: -offset, to: now) ?? now
            return SRS.dayKey(d)
        }
        let keySet = Set(dayKeys)

        let mola = MolaRecords.read()
        var focusMinutes = 0
        var focusRounds = 0
        for k in dayKeys {
            focusMinutes += mola.focus[k] ?? 0
            focusRounds += mola.rounds[k] ?? 0
        }

        var reviews = 0
        var quizzes = 0
        var actions = 0
        var activeDays = 0

        let daysByKey = Dictionary(grouping: store.days, by: \.day)
        for k in dayKeys {
            let rows = daysByKey[k] ?? []
            let r = rows.reduce(0) { $0 + $1.reviews }
            let q = rows.reduce(0) { $0 + $1.quizzes }
            let a = rows.reduce(0) { $0 + ($1.actions ?? 0) }
            let f = mola.focus[k] ?? 0
            reviews += r
            quizzes += q
            actions += a
            if r + q + a + f > 0 {
                activeDays += 1
            }
        }
        // Include in-memory reviews done right now if server row hasn't echoed back yet
        if period == .gun {
            reviews = max(reviews, store.reviewsToday)
        }

        func inPeriod(_ iso: String?) -> Bool {
            guard let iso, let parsed = Dates.parse(iso) else { return false }
            return keySet.contains(SRS.dayKey(parsed))
        }

        let noteCourseMap = Dictionary(uniqueKeysWithValues: store.notes.map { ($0.id, $0.courseId) })
        let courseMap = Dictionary(uniqueKeysWithValues: store.courses.map { ($0.id, $0) })

        var courseLines: [UUID: ReceiptCourseLine] = [:]
        func touchCourse(_ courseId: UUID) -> Bool {
            if courseLines[courseId] != nil { return true }
            guard let c = courseMap[courseId] else { return false }
            courseLines[courseId] = ReceiptCourseLine(
                courseId: c.id,
                name: c.name,
                colorHex: c.color,
                cards: 0,
                quizzes: 0,
                exams: 0,
                notesTouched: 0
            )
            return true
        }

        for card in store.cards where card.reps > 0 && inPeriod(card.updatedAt) {
            if touchCourse(card.courseId) {
                courseLines[card.courseId]?.cards += 1
            }
        }

        var scorePercents: [Double] = []
        for attempt in store.attempts where attempt.total > 0 && inPeriod(attempt.createdAt) {
            scorePercents.append((Double(attempt.score) / Double(attempt.total)) * 100.0)
            if let cId = noteCourseMap[attempt.noteId], touchCourse(cId) {
                courseLines[cId]?.quizzes += 1
            }
        }

        var mockExams = 0
        for examResult in store.examResults where examResult.total > 0 && inPeriod(examResult.createdAt) {
            mockExams += 1
            scorePercents.append((examResult.score / Double(examResult.total)) * 100.0)
            if touchCourse(examResult.courseId) {
                courseLines[examResult.courseId]?.exams += 1
            }
        }

        for note in store.notes where inPeriod(note.updatedAt ?? note.createdAt) {
            if touchCourse(note.courseId) {
                courseLines[note.courseId]?.notesTouched += 1
            }
        }

        let avgQuizScore: Int? = scorePercents.isEmpty
            ? nil
            : Int((scorePercents.reduce(0, +) / Double(scorePercents.count)).rounded())

        let sortedCourses = courseLines.values.sorted { a, b in
            if a.weightScore != b.weightScore { return a.weightScore > b.weightScore }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }

        // 7-day thermal spark-matrix (oldest -> today)
        let weekdayStyle = Date.FormatStyle(locale: Dates.turkish).weekday(.abbreviated)
        let weekDots: [ReceiptWeekDot] = (0..<7).map { idx in
            let d = cal.date(byAdding: .day, value: idx - 6, to: now) ?? now
            let k = SRS.dayKey(d)
            let rows = daysByKey[k] ?? []
            let dayReviews = rows.reduce(0) { $0 + $1.reviews }
            let dayQuizzes = rows.reduce(0) { $0 + $1.quizzes }
            let dayActions = rows.reduce(0) { $0 + ($1.actions ?? 0) }
            let dayFocus = mola.focus[k] ?? 0
            let rawScore = dayReviews + dayQuizzes * 10 + dayActions * 3 + dayFocus * 2
            let level: Int = if rawScore >= 80 { 3 } else if rawScore >= 25 { 2 } else if rawScore > 0 { 1 } else { 0 }
            let rawLabel = d.formatted(weekdayStyle).uppercased(with: Dates.turkish)
            let twoChar = String(rawLabel.prefix(2))
            return ReceiptWeekDot(
                key: k,
                shortLabel: twoChar,
                studied: rawScore > 0,
                isToday: idx == 6,
                level: level
            )
        }

        let effort = reviews + quizzes * 12 + mockExams * 20 + focusMinutes * 2 + actions * 3
        let rank = computeRank(effort: effort, period: period)
        let verdictText = computeVerdict(
            effort: effort,
            reviews: reviews,
            focusMinutes: focusMinutes,
            quizzes: quizzes + mockExams,
            streak: store.streak,
            period: period
        )

        let month = cal.component(.month, from: now)
        let day = cal.component(.day, from: now)
        let hour = cal.component(.hour, from: now)
        let minute = cal.component(.minute, from: now)

        let pad2: (Int) -> String = { String(format: "%02d", $0) }
        let receiptNo = "#\(pad2(month))\(pad2(day))-\(pad2(hour))\(pad2(minute))"
        let timeLabel = "\(pad2(hour)):\(pad2(minute))"

        let dateStyle = Date.FormatStyle(locale: Dates.turkish).day(.twoDigits).month(.abbreviated).year()
        let dateLabel = now.formatted(dateStyle).uppercased(with: Dates.turkish)

        let registerTag: String = if hour >= 0 && hour < 5 {
            "#GECE-VARDİYASI"
        } else {
            registerTags[Int(fnv1a(SRS.dayKey(now) + period.rawValue) % UInt32(registerTags.count))]
        }

        let seedString = "\(SRS.dayKey(now))|\(period.rawValue)|\(reviews)|\(focusMinutes)|\(quizzes)|\(store.streak)"
        let barcodeSeed = fnv1a(seedString)
        let cleanNo = receiptNo.replacingOccurrences(of: "#", with: "")
        let hexTail = String(barcodeSeed, radix: 16).uppercased().padding(toLength: 6, withPad: "0", startingAt: 0).prefix(6)
        let rawSerial = "SM\(cleanNo)\(hexTail)"
        let serialCode = rawSerial.map(String.init).joined(separator: " ")

        return ReceiptStats(
            period: period,
            generatedAt: now,
            dateLabel: dateLabel,
            timeLabel: timeLabel,
            receiptNo: receiptNo,
            registerTag: registerTag,
            focusMinutes: focusMinutes,
            focusRounds: focusRounds,
            reviews: reviews,
            quizzes: quizzes,
            mockExams: mockExams,
            actions: actions,
            avgQuizScore: avgQuizScore,
            streak: store.streak,
            activeDays: activeDays,
            byCourse: sortedCourses,
            weekDots: weekDots,
            effortPoints: effort,
            rank: rank,
            verdict: verdictText,
            barcodeSeed: barcodeSeed,
            serialCode: serialCode
        )
    }

    private static func computeRank(effort: Int, period: ReceiptPeriod) -> ReceiptRank {
        let scale = period == .hafta ? 4 : 1
        if effort >= 160 * scale { return ReceiptRank(grade: "S+", label: "EFSANE MESAİ") }
        if effort >= 85 * scale { return ReceiptRank(grade: "A+", label: "SAĞLAM MESAİ") }
        if effort >= 35 * scale { return ReceiptRank(grade: "B+", label: "İYİ GİDİYOR") }
        if effort > 0 { return ReceiptRank(grade: "C+", label: "KAYDA GEÇTİ") }
        return ReceiptRank(grade: "—", label: "BİR ADIM DAHA")
    }

    private static func computeVerdict(
        effort: Int,
        reviews: Int,
        focusMinutes: Int,
        quizzes: Int,
        streak: Int,
        period: ReceiptPeriod
    ) -> String {
        if effort == 0 {
            return period == .gun
                ? "Masa hazır, kalem açık. Bir kart çevirsen fiş kesilir."
                : "Bu hafta masa sakin kalmış; bugün 5 kartla başla."
        }
        if focusMinutes >= 120 && reviews >= 40 {
            return "Kütüphane görevlisi ışıkları kapatmak için seni bekliyor."
        }
        if streak >= 7 {
            return "\(streak) gündür aralıksız. Sınav takvimi senden çekinsin."
        }
        if reviews >= 50 {
            return "Kart destesi eridi; hafıza kasları ısındı."
        }
        if focusMinutes >= 75 {
            return "Telefon sessizde, zihin derste. Temiz odak."
        }
        if quizzes >= 3 {
            return "Test üstüne test. Eksikler tek tek kapandı."
        }
        return "Azar azar, her gün. Kalıcı öğrenme tam olarak böyle çalışır."
    }
}
