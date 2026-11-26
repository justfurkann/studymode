import Foundation

/// Exam words and countdowns, ported from src/lib/courseExams.ts so the app says exactly what the site says.
enum ExamAudience { case uni, school }

enum Exams {
    struct Words { let label, dative, possessive, possessiveDative: String }

    static func words(_ kind: ExamKind, _ audience: ExamAudience) -> Words {
        switch (audience, kind) {
        case (.uni, .vize): Words(label: "Vize", dative: "Vizeye", possessive: "vizesi", possessiveDative: "vizesine")
        case (.uni, .final): Words(label: "Final", dative: "Finale", possessive: "finali", possessiveDative: "finaline")
        case (.uni, .butunleme): Words(label: "Bütünleme", dative: "Bütünlemeye", possessive: "bütünlemesi", possessiveDative: "bütünlemesine")
        case (.uni, .quiz): Words(label: "Quiz", dative: "Quiz’e", possessive: "quizi", possessiveDative: "quizine")
        case (.school, .vize): Words(label: "1. Yazılı", dative: "1. yazılıya", possessive: "1. yazılısı", possessiveDative: "1. yazılısına")
        case (.school, .final): Words(label: "2. Yazılı", dative: "2. yazılıya", possessive: "2. yazılısı", possessiveDative: "2. yazılısına")
        case (.school, .butunleme): Words(label: "Sorumluluk sınavı", dative: "Sorumluluk sınavına", possessive: "sorumluluk sınavı", possessiveDative: "sorumluluk sınavına")
        case (.school, .quiz): Words(label: "Deneme", dative: "Denemeye", possessive: "denemesi", possessiveDative: "denemesine")
        case (_, .diger): Words(label: "Sınav", dative: "Sınava", possessive: "sınavı", possessiveDative: "sınavına")
        }
    }

    /// Ortaokul and lise have yazılı exams; everyone else keeps vize and final.
    static func audience(forLevel level: String?) -> ExamAudience {
        level == "ortaokul" || level == "lise" ? .school : .uni
    }

    static func name(_ exam: CourseExam, _ audience: ExamAudience) -> String {
        if exam.kind == .diger, let title = exam.title?.trimmingCharacters(in: .whitespaces), !title.isEmpty { return title }
        return words(exam.kind, audience).label
    }

    /// "9:30", "09.30" or "09:30:00" → "09:30".
    static func cleanTime(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespaces) else { return nil }
        let parts = value.split(whereSeparator: { $0 == ":" || $0 == "." })
        guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]), (0..<24).contains(h), (0..<60).contains(m), parts[1].count == 2 else { return nil }
        return String(format: "%02d:%02d", h, m)
    }

    /// One hour after the start time, or the end of the day when no time was entered.
    static func end(_ exam: CourseExam) -> Date? {
        guard let day = Dates.day(exam.date) else { return nil }
        guard let time = cleanTime(exam.time) else { return Calendar.current.date(byAdding: .day, value: 1, to: day) }
        let hm = time.split(separator: ":").compactMap { Int($0) }
        let start = Calendar.current.date(bySettingHour: hm[0], minute: hm[1], second: 0, of: day)
        return start.map { $0.addingTimeInterval(3600) }
    }

    static func ended(_ exam: CourseExam, now: Date = .now) -> Bool {
        guard let end = end(exam) else { return false }
        return now >= end
    }

    /// Whole days until the exam day; nil when it is over.
    static func daysLeft(_ exam: CourseExam, now: Date = .now) -> Int? {
        guard !ended(exam, now: now), let day = Dates.day(exam.date) else { return nil }
        let today = Calendar.current.startOfDay(for: now)
        let days = Calendar.current.dateComponents([.day], from: today, to: day).day ?? 0
        return max(0, days)
    }

    enum Tone { case danger, warning, neutral }

    /// "Vizeye 8 gün", "Final yarın", "Vize bugün 10:00".
    static func countdown(_ exam: CourseExam, _ audience: ExamAudience, now: Date = .now) -> (text: String, days: Int, tone: Tone)? {
        guard let days = daysLeft(exam, now: now) else { return nil }
        let name = name(exam, audience)
        let tone: Tone = days <= 1 ? .danger : days <= 7 ? .warning : .neutral
        let at = cleanTime(exam.time).map { " \($0)" } ?? ""
        if days == 0 { return ("\(name) bugün\(at)", days, tone) }
        if days == 1 { return ("\(name) yarın\(at)", days, tone) }
        if exam.kind == .diger, let title = exam.title?.trimmingCharacters(in: .whitespaces), !title.isEmpty {
            return ("\(name): \(days) gün kaldı", days, tone)
        }
        return ("\(words(exam.kind, audience).dative) \(days) gün", days, tone)
    }

    /// "28 Ekim Çarşamba", with the time when there is one.
    static func dateText(_ exam: CourseExam) -> String {
        guard let day = Dates.day(exam.date) else { return exam.date }
        let text = day.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).weekday(.wide))
        return cleanTime(exam.time).map { "\(text), \($0)" } ?? text
    }
}
