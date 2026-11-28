import Foundation
import Supabase

// MARK: - Course Exams & Mock Exam Results Persistence (mirrors src/lib/store.tsx)

struct CourseExamDraft {
    var existingId: String?
    var courseId: UUID
    var kind: ExamKind
    var title: String?
    /// YYYY-MM-DD
    var date: String
    /// Optional HH:mm
    var time: String?
    var weight: Double?
    var grade: Double?
    var noteIds: [String]
}

private struct CourseExamUpsertFull: Encodable {
    let id: UUID
    let course_id: UUID
    let kind: String
    let title: String?
    let date: String
    let time: String?
    let weight: Double?
    let grade: Double?
    let note_ids: [String]
    let updated_at: String
}

private struct CourseExamUpsertBasic: Encodable {
    let id: UUID
    let course_id: UUID
    let kind: String
    let title: String?
    let date: String
    let weight: Double?
    let note_ids: [String]
    let updated_at: String
}

private struct CourseExamDatePatch: Encodable {
    let exam_date: String?
    let updated_at: String
}

private struct NewExamResultRow: Encodable {
    let id: UUID
    let course_id: UUID
    let format: String
    let difficulty: String
    let source: String
    let note_ids: [String]
    let questions: [MockExamQuestion]
    let answers: [MockExamAnswer]
    let scores: [Double]
    let feedback: [String]
    let score: Double
    let total: Int
    let duration_seconds: Int?
    let created_at: String
}

private struct ExamMistakeCardRow: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID?
    let front: String
    let back: String
    let source: String?
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let created_at: String
    let updated_at: String
}

extension Exams {
    static func kindOptions(for audience: ExamAudience) -> [(kind: ExamKind, label: String)] {
        let order: [ExamKind] = audience == .uni
            ? [.vize, .final, .butunleme, .quiz, .diger]
            : [.vize, .final, .quiz, .butunleme, .diger]
        return order.map { k in
            (k, k == .diger ? "Diğer" : words(k, audience).label)
        }
    }

    static let schoolPresetTitles = ["TYT", "AYT", "LGS", "Ortak sınav"]

    static func dayString(_ date: Date) -> String {
        let cal = Calendar.current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 2026, c.month ?? 1, c.day ?? 1)
    }
}

extension StudyStore {
    /// Upcoming exams across all courses, nearest first (mirrors `upcomingExams` in `courseExams.ts`).
    func allUpcomingExams(now: Date = .now) -> [(exam: CourseExam, course: Course, days: Int)] {
        var result: [(exam: CourseExam, course: Course, days: Int)] = []
        for course in courses {
            for exam in examsFor(course) {
                if let days = Exams.daysLeft(exam, now: now) {
                    result.append((exam, course, days))
                }
            }
        }
        return result.sorted { a, b in
            if a.days != b.days { return a.days < b.days }
            if a.exam.date != b.exam.date { return a.exam.date < b.exam.date }
            return a.course.name.localizedCaseInsensitiveCompare(b.course.name) == .orderedAscending
        }
    }

    /// Finished exams across all courses, most recent first.
    func allFinishedExams(now: Date = .now) -> [(exam: CourseExam, course: Course)] {
        var result: [(exam: CourseExam, course: Course)] = []
        for course in courses {
            for exam in examsFor(course) where Exams.ended(exam, now: now) {
                result.append((exam, course))
            }
        }
        return result.sorted { $0.exam.date > $1.exam.date }
    }

    /// Last mock exam result for a course, if any.
    func lastMockExam(for course: Course) -> ExamResultSummary? {
        examResults.filter { $0.courseId == course.id }.max { $0.createdAt < $1.createdAt }
    }

    /// Readiness specifically for the notes an exam covers (mirrors `examReadiness` in `examFocus.ts`).
    func readiness(for exam: CourseExam) -> Int? {
        readiness(of: notes.filter { $0.courseId == exam.courseId && exam.covers($0.id) })
    }

    /// Creates or updates a `CourseExam` and syncs `courses.exam_date` to the nearest upcoming exam.
    @discardableResult
    func saveCourseExam(_ draft: CourseExamDraft, now: Date = .now) -> CourseExam {
        let resolvedUUID: UUID = {
            if let existingId = draft.existingId, !existingId.hasPrefix("legacy-"), let parsed = UUID(uuidString: existingId) {
                return parsed
            }
            return UUID()
        }()

        let cleanedTitle: String? = {
            let t = draft.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return t.isEmpty ? nil : String(t.prefix(80))
        }()
        let cleanedTime = Exams.cleanTime(draft.time)
        let clampedWeight = draft.weight.map { min(max($0, 0), 100) }
        let clampedGrade = draft.grade.map { min(max($0, 0), 100) }

        let saved = CourseExam(
            id: resolvedUUID.uuidString,
            courseId: draft.courseId,
            kind: draft.kind,
            title: draft.kind == .diger ? cleanedTitle : nil,
            date: draft.date,
            time: cleanedTime,
            weight: clampedWeight,
            grade: clampedGrade,
            noteIds: draft.noteIds
        )

        if let idx = exams.firstIndex(where: { $0.id.lowercased() == saved.id.lowercased() }) {
            exams[idx] = saved
        } else {
            exams.append(saved)
        }

        let nextDate = nearestUpcomingDate(for: draft.courseId, now: now)
        if let cIdx = courses.firstIndex(where: { $0.id == draft.courseId }) {
            courses[cIdx].examDate = nextDate
        }

        let stamp = ISO.string(now)
        let fullRow = CourseExamUpsertFull(
            id: resolvedUUID,
            course_id: saved.courseId,
            kind: saved.kind.rawValue,
            title: saved.title,
            date: saved.date,
            time: saved.time,
            weight: saved.weight,
            grade: saved.grade,
            note_ids: saved.noteIds,
            updated_at: stamp
        )
        let basicRow = CourseExamUpsertBasic(
            id: resolvedUUID,
            course_id: saved.courseId,
            kind: saved.kind.rawValue,
            title: saved.title,
            date: saved.date,
            weight: saved.weight,
            note_ids: saved.noteIds,
            updated_at: stamp
        )
        let coursePatch = CourseExamDatePatch(exam_date: nextDate, updated_at: stamp)

        enqueueWrite { [weak self] in
            do {
                do {
                    try await supabase.from("course_exams").upsert(fullRow).execute()
                } catch let error as PostgrestError where error.code == "PGRST204" || error.code == "42703" {
                    try await supabase.from("course_exams").upsert(basicRow).execute()
                }
                try await supabase.from("courses").update(coursePatch).eq("id", value: saved.courseId).execute()
            } catch {
                await MainActor.run {
                    self?.saveError = "Sınav kaydedilemedi. İnternet bağlantını kontrol et."
                }
            }
        }

        return saved
    }

    /// Deletes a `CourseExam` (or clears `courses.exam_date` if it was a legacy exam) and updates `courses.exam_date`.
    func deleteCourseExam(_ exam: CourseExam, now: Date = .now) {
        exams.removeAll { $0.id.lowercased() == exam.id.lowercased() }
        let nextDate = exam.isLegacy ? nil : nearestUpcomingDate(for: exam.courseId, now: now)
        if let cIdx = courses.firstIndex(where: { $0.id == exam.courseId }) {
            courses[cIdx].examDate = nextDate
        }

        let stamp = ISO.string(now)
        let coursePatch = CourseExamDatePatch(exam_date: nextDate, updated_at: stamp)
        let deleteUUID = exam.isLegacy ? nil : UUID(uuidString: exam.id)

        enqueueWrite { [weak self] in
            do {
                if let deleteUUID {
                    try await supabase.from("course_exams").delete().eq("id", value: deleteUUID).execute()
                }
                try await supabase.from("courses").update(coursePatch).eq("id", value: exam.courseId).execute()
            } catch {
                await MainActor.run {
                    self?.saveError = "Sınav silinemedi. İnternet bağlantını kontrol et."
                }
            }
        }
    }

    private func nearestUpcomingDate(for courseId: UUID, now: Date) -> String? {
        exams
            .filter { $0.courseId == courseId && !Exams.ended($0, now: now) }
            .map(\.date)
            .sorted()
            .first
    }

    /// Saves a completed mock exam to `exam_results` and increments today's `study_days.quizzes` (mirrors `addExam`).
    @discardableResult
    func saveMockExamResult(
        courseId: UUID,
        format: String,
        difficulty: String,
        source: String,
        noteIds: [String],
        questions: [MockExamQuestion],
        answers: [MockExamAnswer],
        scores: [Double],
        feedback: [String],
        totalScore: Double,
        durationSeconds: Int?,
        now: Date = .now
    ) -> ExamResultSummary {
        let id = UUID()
        let stamp = ISO.string(now)
        let summary = ExamResultSummary(
            id: id,
            courseId: courseId,
            format: format,
            difficulty: difficulty,
            source: source,
            score: totalScore,
            total: questions.count,
            durationSeconds: durationSeconds,
            createdAt: stamp
        )
        examResults.insert(summary, at: 0)

        let day = SRS.dayKey(now)
        if let index = days.firstIndex(where: { $0.day == day }) {
            days[index] = StudyDayCount(
                day: days[index].day,
                reviews: days[index].reviews,
                quizzes: days[index].quizzes + 1,
                actions: days[index].actions,
                newCards: days[index].newCards
            )
        } else {
            days.insert(StudyDayCount(day: day, reviews: 0, quizzes: 1, actions: 0, newCards: 0), at: 0)
        }

        let row = NewExamResultRow(
            id: id,
            course_id: courseId,
            format: format,
            difficulty: difficulty,
            source: source,
            note_ids: noteIds,
            questions: questions,
            answers: answers,
            scores: scores,
            feedback: feedback,
            score: totalScore,
            total: questions.count,
            duration_seconds: durationSeconds,
            created_at: stamp
        )

        enqueueWrite { [weak self] in
            do {
                try await supabase.from("exam_results").insert(row).execute()
                try await StudyDays.bump(day: day, quizzes: 1, into: self)
            } catch {
                await MainActor.run {
                    self?.saveError = "Sınav provası sonucu kaydedilemedi. İnternet bağlantını kontrol et."
                }
            }
        }

        return summary
    }

    /// Converts missed or partial-credit mock exam questions into flashcards.
    @discardableResult
    func cardsFromMockExam(
        courseId: UUID,
        mistakes: [(noteId: UUID?, front: String, back: String, source: String?)],
        now: Date = .now
    ) -> Int {
        guard !mistakes.isEmpty else { return 0 }
        let stamp = ISO.string(now)
        let rows = mistakes.map { item in
            ExamMistakeCardRow(
                id: UUID(),
                course_id: courseId,
                note_id: item.noteId,
                front: item.front,
                back: item.back,
                source: item.source,
                due: stamp,
                interval: 0,
                ease: 2.5,
                reps: 0,
                lapses: 0,
                created_at: stamp,
                updated_at: stamp
            )
        }
        addCardsLocally(rows.map {
            Card(
                id: $0.id,
                courseId: $0.course_id,
                noteId: $0.note_id,
                front: $0.front,
                back: $0.back,
                source: $0.source,
                due: stamp,
                interval: 0,
                ease: 2.5,
                reps: 0,
                lapses: 0
            )
        })
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("cards").insert(rows).execute()
            } catch {
                await MainActor.run {
                    self?.saveError = "Kartlar eklenemedi. İnternet bağlantını kontrol et."
                }
            }
        }
        return rows.count
    }

    /// Loads the full question-by-question detail of a past mock exam (`public.exam_results`).
    func fetchExamDetail(id: UUID) async throws -> ExamResultDetail {
        try await supabase
            .from("exam_results")
            .select("id,course_id,format,difficulty,source,note_ids,questions,answers,scores,feedback,score,total,duration_seconds,created_at")
            .eq("id", value: id)
            .single()
            .execute()
            .value
    }

    /// Deletes a saved mock exam result locally and on Supabase.
    func deleteExamResult(id: UUID) {
        let backup = examResults
        examResults.removeAll { $0.id == id }
        enqueueWrite { [weak self] in
            do {
                try await supabase.from("exam_results").delete().eq("id", value: id).execute()
            } catch {
                await MainActor.run {
                    self?.examResults = backup
                    self?.saveError = "Sınav sonucu silinemedi. İnternet bağlantını kontrol et."
                }
            }
        }
    }
}

/// Full saved mock exam row (`public.exam_results`), leniently decoded so both web- and iOS-created exams open cleanly.
struct ExamResultDetail: Identifiable, Decodable {
    struct StoredQuestion: Identifiable, Decodable, Hashable {
        let id: String
        let type: MockQuestionType
        let prompt: String
        let options: [String]
        let answerIndex: Int
        let explanation: String
        let modelAnswer: String
        let source: String?
        let noteTitle: String?
        let noteId: String?

        enum CodingKeys: String, CodingKey {
            case id, type, prompt, options, answerIndex, explanation, modelAnswer, source, noteTitle, noteId
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
            let rawType = (try? c.decode(String.self, forKey: .type)) ?? "mcq"
            type = MockQuestionType(rawValue: rawType) ?? .mcq
            prompt = (try? c.decode(String.self, forKey: .prompt)) ?? ""
            options = (try? c.decode([String].self, forKey: .options)) ?? []
            answerIndex = (try? c.decode(Int.self, forKey: .answerIndex)) ?? 0
            explanation = (try? c.decode(String.self, forKey: .explanation)) ?? ""
            modelAnswer = (try? c.decode(String.self, forKey: .modelAnswer)) ?? ""
            source = try? c.decodeIfPresent(String.self, forKey: .source)
            noteTitle = try? c.decodeIfPresent(String.self, forKey: .noteTitle)
            noteId = try? c.decodeIfPresent(String.self, forKey: .noteId)
        }
    }

    let id: UUID
    let courseId: UUID
    let format: String
    let difficulty: String?
    let source: String
    let noteIds: [String]
    let questions: [StoredQuestion]
    let answers: [MockExamAnswer]
    let scores: [Double]
    let feedback: [String]
    let score: Double
    let total: Int
    let durationSeconds: Int?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, format, difficulty, source, questions, answers, scores, feedback, score, total
        case courseId = "course_id"
        case noteIds = "note_ids"
        case durationSeconds = "duration_seconds"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        courseId = try c.decode(UUID.self, forKey: .courseId)
        format = (try? c.decode(String.self, forKey: .format)) ?? "test"
        difficulty = try? c.decodeIfPresent(String.self, forKey: .difficulty)
        source = (try? c.decode(String.self, forKey: .source)) ?? "ai"
        noteIds = (try? c.decode([String].self, forKey: .noteIds)) ?? []
        questions = (try? c.decode([StoredQuestion].self, forKey: .questions)) ?? []
        answers = (try? c.decode([MockExamAnswer].self, forKey: .answers)) ?? []
        scores = (try? c.decode([Double].self, forKey: .scores)) ?? []
        feedback = (try? c.decode([String].self, forKey: .feedback)) ?? []
        score = (try? c.decode(Double.self, forKey: .score)) ?? 0
        total = (try? c.decode(Int.self, forKey: .total)) ?? questions.count
        durationSeconds = try? c.decodeIfPresent(Int.self, forKey: .durationSeconds)
        createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
    }

    var percent: Int {
        Int(((score / Double(max(1, total))) * 100.0).rounded())
    }
}
