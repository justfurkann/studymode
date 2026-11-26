import Foundation

/// The site's Bugün page logic, ported 1:1: the five learning steps (learningPath.ts), the smart study
/// plan (studyPlan.ts buildSmartStudyPlan), "Şimdi bununla başla" (examFocus.ts pickExamFocus) and the
/// YKS/LGS countdown (bigExams.ts).

enum LearningStep: String, CaseIterable {
    case tanis, anla, sina, pekistir, anlat

    var number: Int { (Self.allCases.firstIndex(of: self) ?? 0) + 1 }

    var title: String {
        switch self {
        case .tanis: "Konuyla Tanış & Kavramlar"
        case .anla: "Adım Adım Konu Anlatımı"
        case .sina: "Kendini Test Et"
        case .pekistir: "Kartlarla Pekiştir"
        case .anlat: "Kendi Cümlelerinle Anlat"
        }
    }

    var shortTitle: String {
        switch self {
        case .tanis: "Tanış"
        case .anla: "Anla"
        case .sina: "Test"
        case .pekistir: "Kartlar"
        case .anlat: "Anlat"
        }
    }
}

/// Where a link on Bugün opens a note (the site's stepUrl / ?sekme=).
enum NoteStart: Hashable { case summary, terms, points, test, cards, explain }

extension LearningStep {
    var start: NoteStart {
        switch self {
        case .tanis: .terms
        case .anla: .points
        case .sina: .test
        case .pekistir: .cards
        case .anlat: .explain
        }
    }
}

/// A note opened at a particular place (NavigationLink value).
struct NoteRoute: Hashable {
    let note: NoteItem
    let start: NoteStart
}

struct NoteProgress {
    let done: [LearningStep]
    var completedCount: Int { done.count }
    var isCompleted: Bool { done.count == LearningStep.allCases.count }
    var percent: Int { Int((Double(done.count) / 5 * 100).rounded()) }
    /// The first step not done, or the last one when all are done.
    var current: LearningStep { LearningStep.allCases.first { !done.contains($0) } ?? .anlat }
}

struct PlanItem: Identifiable {
    let note: NoteItem
    let course: Course?
    let examDays: Int?
    let exam: CourseExam?
    let reason: String
    let actionLabel: String
    let target: NoteTarget
    let priority: Double
    var id: UUID { note.id }
}

/// What a plan or focus button opens.
enum NoteTarget: Hashable {
    case note(NoteRoute)
    /// Card review of one note (/tekrar?not=).
    case reviewNote(NoteItem)
    case addNote(Course)
    case mockExam(Course, CourseExam?)
}

struct SmartPlan {
    let headline: String
    let subheadline: String
    let items: [PlanItem]
}

struct ExamFocus {
    let exam: CourseExam
    let course: Course
    let days: Int
    let readiness: Int?
    let headline: String
    let reason: String
    let actionLabel: String
    let target: NoteTarget
    let noteId: UUID?
}

struct BigExam {
    let id: String
    let name: String
    let dative: String
    /// YYYY-MM-DD
    let date: String
    let detail: String

    static let yks = BigExam(id: "yks", name: "YKS", dative: "YKS’ye", date: "2027-06-19", detail: "TYT 19 Haziran, AYT ve YDT 20 Haziran 2027")
    static let lgs = BigExam(id: "lgs", name: "LGS", dative: "LGS’ye", date: "2027-06-13", detail: "Merkezî sınav 13 Haziran 2027")

    static func forLevel(_ level: String?) -> BigExam? {
        level == "lise" ? .yks : level == "ortaokul" ? .lgs : nil
    }

    func daysLeft(now: Date = .now) -> Int? {
        guard let day = Dates.day(date) else { return nil }
        let today = Calendar.current.startOfDay(for: now)
        let days = Calendar.current.dateComponents([.day], from: today, to: day).day ?? 0
        return days < 0 ? nil : days
    }

    func countdown(now: Date = .now) -> String? {
        guard let days = daysLeft(now: now) else { return nil }
        if days == 0 { return "\(name) bugün" }
        if days == 1 { return "\(name) yarın" }
        return "\(dative) \(days) gün"
    }

    // "Benim sınavım değil": hidden on this device until the next exam year.
    private static let hideKey = "studymode.bigExam.hidden"
    var isHidden: Bool { UserDefaults.standard.string(forKey: Self.hideKey) == "\(id):\(date)" }
    func hide() { UserDefaults.standard.set("\(id):\(date)", forKey: Self.hideKey) }
}

extension StudyStore {
    static let focusWindowDays = 45
    static let readyPercent = 85

    func noteProgress(_ note: NoteItem) -> NoteProgress {
        let done = Set(noteSteps(note))
        let terms = note.keyTerms ?? []
        let checked = Set(note.checkedTerms ?? [])
        let noteCards = cards.filter { $0.noteId == note.id }
        let studied = noteCards.filter { $0.reps > 0 || $0.lapses > 0 }.count
        let tested = attempts.contains { $0.noteId == note.id && $0.total > 0 }
        var steps: [LearningStep] = []
        if done.contains("tanis") || (!terms.isEmpty && terms.allSatisfy { checked.contains($0.term) }) { steps.append(.tanis) }
        if done.contains("anla") { steps.append(.anla) }
        if done.contains("sina") || tested { steps.append(.sina) }
        if done.contains("pekistir") || (!noteCards.isEmpty && studied >= min(noteCards.count, Int((Double(noteCards.count) * 0.5).rounded(.up)))) { steps.append(.pekistir) }
        if done.contains("anlat") { steps.append(.anlat) }
        return NoteProgress(done: steps)
    }

    /// Upcoming exams of all courses, nearest first (upcomingExams).
    func upcomingExams(now: Date = .now) -> [(exam: CourseExam, course: Course, days: Int)] {
        courses
            .flatMap { course in examsFor(course).compactMap { exam in Exams.daysLeft(exam, now: now).map { (exam: exam, course: course, days: $0) } } }
            .sorted { $0.days != $1.days ? $0.days < $1.days : ($0.exam.time ?? "") < ($1.exam.time ?? "") }
    }

    func examReadiness(_ exam: CourseExam) -> Int? {
        readiness(of: notes.filter { $0.courseId == exam.courseId && exam.covers($0.id) })
    }

    /// "Biyoloji vizesine 3 gün kaldı" (courseExamPhrase).
    func examPhrase(_ courseName: String, _ exam: CourseExam, days: Int) -> String {
        let when: String? = days == 0 ? "bugün" : days == 1 ? "yarın" : nil
        if exam.kind == .diger, let title = exam.title?.trimmingCharacters(in: .whitespaces), !title.isEmpty {
            return when.map { "\(courseName) · \(title) \($0)" } ?? "\(courseName) · \(title): \(days) gün kaldı"
        }
        let words = Exams.words(exam.kind, audience)
        return when.map { "\(courseName) \(words.possessive) \($0)" } ?? "\(courseName) \(words.possessiveDative) \(days) gün kaldı"
    }

    func smartPlan(now: Date = .now, maxItems: Int = 2) -> SmartPlan {
        let upcoming = upcomingExams(now: now)
        var candidates: [PlanItem] = []
        for note in notes {
            let course = courses.first { $0.id == note.courseId }
            let nearest = upcoming.first { $0.course.id == note.courseId && $0.exam.covers(note.id) }
            let examDays = nearest?.days
            let progress = noteProgress(note)
            let mastery = mastery(of: note).map { Int($0) }
            let due = cards.filter { $0.noteId == note.id && $0.isDue(now) }.count
            if progress.isCompleted, let m = mastery, m >= 80, due == 0 { continue }

            var priority = 0.0
            if let d = examDays { priority += Double(max(15, 100 - d * 4)) }
            let reason: String
            let label: String
            let target: NoteTarget
            if note.generator == nil {
                priority += 35
                reason = "Çalışma seti henüz oluşturulmadı"
                label = "Seti hazırla"
                target = .note(NoteRoute(note: note, start: .summary))
            } else if let m = mastery, m < 70 {
                priority += 55 + Double(70 - m) * 0.5
                reason = "Konu hâkimiyeti düşük (%\(m))"
                label = "Testi tekrar çöz"
                target = .note(NoteRoute(note: note, start: .test))
            } else if !progress.isCompleted {
                priority += Double(45 - progress.completedCount * 5)
                reason = progress.completedCount == 0 ? "Henüz çalışmaya başlanmadı" : "Öğrenme yolu: \(progress.completedCount)/5 adım"
                label = "\(progress.current.number). Adım: \(progress.current.shortTitle)"
                target = .note(NoteRoute(note: note, start: progress.current.start))
            } else if mastery == nil {
                priority += 40
                reason = "Adımlar bitti, konu hâkimiyeti henüz ölçülmedi"
                label = "Mini testi çöz"
                target = .note(NoteRoute(note: note, start: .test))
            } else if due > 0 {
                priority += 30 + Double(min(20, due * 2))
                reason = "\(due) kart tekrar bekliyor"
                label = "Kartları tekrar et"
                target = .reviewNote(note)
            } else {
                priority += 20
                reason = "Konu hâkimiyeti: %\(mastery ?? 0) · Pekiştirme önerilir"
                label = "Gözden geçir"
                target = .note(NoteRoute(note: note, start: .summary))
            }
            candidates.append(PlanItem(note: note, course: course, examDays: examDays, exam: nearest?.exam, reason: reason, actionLabel: label, target: target, priority: priority))
        }
        candidates.sort { $0.priority != $1.priority ? $0.priority > $1.priority : $0.note.lastChange > $1.note.lastChange }
        let items = Array(candidates.prefix(maxItems))

        var headline = "Bugün için akıllı çalışma planı"
        var sub = "Konu hâkimiyetine ve öğrenme adımlarına göre önceliklendirildi"
        let nearest = items.filter { $0.exam != nil && $0.examDays != nil && $0.course != nil }.min { $0.examDays! < $1.examDays! }
        if let nearest, let exam = nearest.exam, let days = nearest.examDays, let course = nearest.course {
            let phrase = examPhrase(course.name, exam, days: days)
            headline = items.count == 1 ? "\(phrase) — bugün şu konuyu çalış" : "\(phrase) — bugün şu \(items.count) konuyu çalış"
            sub = "Sınav tarihi, test performansı ve eksik adımlara göre seçildi"
        } else if !items.isEmpty {
            headline = items.count == 1 ? "Bugün şu konuyu çalışman öneriliyor" : "Bugün şu \(items.count) konuyu çalışman öneriliyor"
        }
        return SmartPlan(headline: headline, subheadline: sub, items: items)
    }

    /// Higher means "work on this first" (examUrgency).
    private func urgency(days: Int, weight: Double?, readiness: Int?) -> Double {
        let gap = 1 - Double(readiness ?? 0) / 100
        let factor = weight.map { 0.5 + min(100, max(0, $0)) / 100 } ?? 1
        return gap * factor / Double(days + 1)
    }

    func examFocus(now: Date = .now) -> ExamFocus? {
        struct Candidate { let exam: CourseExam; let course: Course; let days: Int; let readiness: Int?; let urgency: Double }
        var candidates: [Candidate] = []
        for entry in upcomingExams(now: now) where entry.days <= Self.focusWindowDays {
            let readiness = examReadiness(entry.exam)
            if let r = readiness, r >= Self.readyPercent { continue }
            let score = urgency(days: entry.days, weight: entry.exam.weight, readiness: readiness)
            candidates.append(Candidate(exam: entry.exam, course: entry.course, days: entry.days, readiness: readiness, urgency: score))
        }
        candidates.sort { $0.urgency != $1.urgency ? $0.urgency > $1.urgency : $0.days < $1.days }
        guard let top = candidates.first else { return nil }
        let headline = examPhrase(top.course.name, top.exam, days: top.days)
        guard let readiness = top.readiness else {
            return ExamFocus(exam: top.exam, course: top.course, days: top.days, readiness: nil, headline: headline,
                             reason: "Bu derste henüz not yok. Önce ders notunu ekle, gerisini birlikte planlayalım.",
                             actionLabel: "Not ekle", target: .addNote(top.course), noteId: nil)
        }
        let ready = "Hazırlığın: %\(readiness)."
        let plan = smartPlan(now: now, maxItems: .max)
        if let item = plan.items.first(where: { $0.note.courseId == top.course.id && top.exam.covers($0.note.id) }) {
            return ExamFocus(exam: top.exam, course: top.course, days: top.days, readiness: readiness, headline: headline,
                             reason: "\(ready) Sıradaki: \(item.note.title).", actionLabel: item.actionLabel, target: item.target, noteId: item.note.id)
        }
        return ExamFocus(exam: top.exam, course: top.course, days: top.days, readiness: readiness, headline: headline,
                         reason: "\(ready) Notların çalışılmış görünüyor; kendini bir provayla dene.", actionLabel: "Prova yap",
                         target: .mockExam(top.course, top.exam.isLegacy ? nil : top.exam), noteId: nil)
    }

    /// Latest test of each note scoring under 70% (Bugün's "Tekrar çalışman gereken konular").
    func weakNotes() -> [(note: NoteItem, attempt: QuizAttempt)] {
        var latest: [UUID: QuizAttempt] = [:]
        for a in attempts where a.total > 0 {
            if let prev = latest[a.noteId], prev.createdAt >= a.createdAt { continue }
            latest[a.noteId] = a
        }
        return latest.values
            .filter { Double($0.score) / Double($0.total) < 0.7 }
            .compactMap { a in notes.first { $0.id == a.noteId }.map { (note: $0, attempt: a) } }
    }

    /// Whether each of the last seven days had any study, oldest first.
    func lastWeek(now: Date = .now) -> [(key: String, label: String, done: Bool, today: Bool)] {
        let style = Date.FormatStyle(locale: Dates.turkish).weekday(.abbreviated)
        return (0..<7).map { i in
            let date = Calendar.current.date(byAdding: .day, value: i - 6, to: now) ?? now
            let key = SRS.dayKey(date)
            let done = days.contains { $0.day == key && $0.studied }
            return (key, date.formatted(style), done, i == 6)
        }
    }
}

extension NoteItem {
    /// updated_at when known, otherwise created_at (for "son notlar").
    var lastChange: String { updatedAt ?? createdAt }
}
