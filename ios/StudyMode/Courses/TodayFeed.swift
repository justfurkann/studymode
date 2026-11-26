import SwiftUI

/// The site's Bugün page on the home tab: greeting, YKS/LGS countdown, "Şimdi bununla başla", the
/// week strip, the smart plan, steps to continue, other exams, weak topics and recent notes. Each
/// note appears once, in the first list that has it (the site's `take` rule).
struct TodayFeed: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(\.openNote) private var openNote

    @State private var bigExamHidden = false
    @State private var session: SessionBox?
    @State private var addingTo: Course?
    @State private var mock: MockBox?

    /// Which part of the feed this view draws: the top sits above the courses, the lists below the hero.
    enum Part { case greeting, top, lists }
    let part: Part

    var body: some View {
        Group {
            switch part {
            case .greeting: greeting
            case .top: top
            case .lists: lists
            }
        }
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: "Tekrar", cards: box.cards, mode: .grades).environment(store)
        }
        .sheet(item: $addingTo) { course in
            AddNoteView(course: course, onDone: openNote).environment(store)
        }
        .fullScreenCover(item: $mock) { box in
            MockExamView(course: box.course, preselectedExam: box.exam).environment(store)
        }
    }

    // MARK: - Top

    private var top: some View {
        let focus = store.examFocus()
        return VStack(alignment: .leading, spacing: 16) {
            if let exam = BigExam.forLevel(auth.educationLevel), !bigExamHidden, !exam.isHidden, let text = exam.countdown() {
                bigExamCard(exam, text: text)
            }
            if let focus { focusCard(focus) }
            weekStrip
        }
    }

    private var greeting: some View {
        let date = Date.now.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).weekday(.wide))
        let name = auth.firstName
        return VStack(alignment: .leading, spacing: 2) {
            Text(date.prefix(1).uppercased() + date.dropFirst())
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
            if !name.isEmpty {
                Text("Merhaba \(name)")
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.text)
            }
        }
    }

    private func bigExamCard(_ exam: BigExam, text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.clock")
                .font(.title2)
                .foregroundStyle(Theme.text)
            VStack(alignment: .leading, spacing: 2) {
                Text(text)
                    .font(Theme.display(.headline, weight: .bold))
                    .foregroundStyle(Theme.text)
                Text(exam.detail)
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
            }
            Spacer(minLength: 4)
            Menu {
                Button("Bu yıl bu sınava girmiyorum, gizle", systemImage: "eye.slash") {
                    exam.hide()
                    withAnimation { bigExamHidden = true }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .frame(width: 44, height: 44)
                    .foregroundStyle(Theme.text2)
            }
            .accessibilityLabel("\(exam.name) geri sayımını gizle")
        }
        .padding(.leading, 14)
        .padding(.vertical, 6)
        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.cardLine, lineWidth: 1.5))
    }

    private func focusCard(_ focus: ExamFocus) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Circle().fill(focus.course.tint).frame(width: 9, height: 9)
                Text("Şimdi bununla başla")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.text2)
                    .textCase(.uppercase)
            }
            Text(focus.headline)
                .font(Theme.display(.title3, weight: .bold))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
            Text(focus.reason)
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            if let readiness = focus.readiness {
                FosforProgressBar(value: Double(max(3, readiness)), total: 100, height: 8)
                    .accessibilityLabel("Sınava hazırlık %\(readiness)")
            }
            actionButton(focus.actionLabel, target: focus.target, primary: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    private var weekStrip: some View {
        let week = store.lastWeek()
        let studiedToday = week.last?.done ?? false
        let streak = store.streak
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(streak > 0 ? "\(streak) gündür çalışıyorsun" : "Çalışma serisi: 0 gün", systemImage: "flame.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text)
                Spacer()
            }
            HStack(spacing: 0) {
                ForEach(week, id: \.key) { day in
                    VStack(spacing: 5) {
                        Circle()
                            .fill(day.done ? Theme.hi : Theme.surface2)
                            .overlay(Circle().stroke(day.done ? Theme.cardLine : (day.today ? Theme.text3 : Theme.border), lineWidth: day.today ? 1.5 : 1))
                            .overlay {
                                if day.done {
                                    Image(systemName: "checkmark").font(.caption2.weight(.heavy)).foregroundStyle(Theme.onHi)
                                }
                            }
                            .frame(width: 26, height: 26)
                        Text(day.label)
                            .font(.caption2.weight(day.today ? .bold : .regular))
                            .foregroundStyle(day.today ? Theme.text : Theme.text3)
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(day.label): \(day.done ? "çalıştın" : "çalışma yok")")
                }
            }
            Text(studiedToday
                 ? "Bugünkü çalışma kaydın alındı."
                 : streak > 0
                    ? "Seriyi korumak için bugün en az 1 kart tekrar et veya 1 test çöz."
                    : "Seri başlatmak için bugün en az 1 kart tekrar et veya 1 test çöz.")
                .font(.caption)
                .foregroundStyle(Theme.text2)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Lists

    private var lists: some View {
        let now = Date.now
        let focus = store.examFocus(now: now)
        var shown = Set<UUID>(focus?.noteId.map { [$0] } ?? [])
        func take<T>(_ items: [T], _ id: (T) -> UUID) -> [T] {
            let out = items.filter { !shown.contains(id($0)) }
            out.forEach { shown.insert(id($0)) }
            return out
        }

        let plan = store.smartPlan(now: now, maxItems: 2)
        let exams = Array(store.upcomingExams(now: now).prefix(5))
        let inProgress = store.notes
            .filter { $0.generator != nil }
            .sorted { $0.lastChange > $1.lastChange }
            .map { (note: $0, progress: store.noteProgress($0)) }
            .filter { !$0.progress.isCompleted }
            .prefix(3)
        let weak = Array(store.weakNotes().prefix(4))
        let recent = store.notes.sorted { $0.lastChange > $1.lastChange }.prefix(5)

        let planItems = take(plan.items) { $0.note.id }
        let stepNotes = take(Array(inProgress)) { $0.note.id }
        let weakNotes = take(weak) { $0.note.id }
        let recentNotes = take(Array(recent)) { $0.id }
        let otherExams = exams.filter { $0.exam.id != focus?.exam.id }
        let showPlan = (!exams.isEmpty || !store.attempts.isEmpty || store.notes.count > 1) && !planItems.isEmpty

        return VStack(alignment: .leading, spacing: 20) {
            if showPlan {
                section(focus != nil ? "Sırada bunlar da var" : plan.headline, subtitle: plan.subheadline) {
                    ForEach(Array(planItems.enumerated()), id: \.element.id) { index, item in
                        row(icon: "sparkles", tint: item.course?.tint ?? Theme.accent,
                            title: "\(index + 1). \(item.note.title)",
                            subtitle: [item.course?.name, item.reason].compactMap { $0 }.joined(separator: " · "),
                            chip: item.actionLabel, target: item.target)
                    }
                }
            }

            if !stepNotes.isEmpty {
                section("Adım adım öğrenmeye devam et", subtitle: "Sıfırdan 5 adımda konuyu tamamla") {
                    ForEach(stepNotes, id: \.note.id) { entry in
                        let course = store.courses.first { $0.id == entry.note.courseId }
                        let step = entry.progress.current
                        row(icon: "safari", tint: course?.tint ?? Theme.accent, title: entry.note.title,
                            subtitle: "\(course?.name ?? "") · Sıradaki: \(step.number). Adım (\(step.title))",
                            chip: "\(entry.progress.completedCount)/5 adım",
                            target: .note(NoteRoute(note: entry.note, start: step.start)))
                    }
                }
            }

            if !otherExams.isEmpty {
                section(focus != nil ? "Diğer sınavlar" : "Yaklaşan sınavlar") {
                    ForEach(otherExams, id: \.exam.id) { entry in
                        let readiness = store.examReadiness(entry.exam)
                        let noteCount = entry.exam.noteIds.isEmpty ? store.notes(in: entry.course).count : entry.exam.noteIds.count
                        let detail = [
                            entry.exam.weight.map { "Ağırlık %\(Int($0.rounded()))" },
                            "\(noteCount) not",
                            readiness.map { "hazırlık %\($0)" } ?? "hazırlık henüz ölçülmedi",
                        ].compactMap { $0 }.joined(separator: " · ")
                        NavigationLink(value: entry.exam) {
                            rowLabel(icon: "calendar.badge.clock", tint: entry.course.tint,
                                     title: "\(entry.course.name) · \(Exams.name(entry.exam, store.audience))",
                                     subtitle: detail, chip: Exams.countdown(entry.exam, store.audience)?.text)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if !weakNotes.isEmpty {
                section("Tekrar çalışman gereken konular") {
                    ForEach(weakNotes, id: \.note.id) { entry in
                        row(icon: "target", tint: Theme.danger, title: entry.note.title,
                            subtitle: store.courses.first { $0.id == entry.note.courseId }?.name ?? "",
                            chip: "Son test \(entry.attempt.score)/\(entry.attempt.total)",
                            target: .note(NoteRoute(note: entry.note, start: .test)))
                    }
                }
            }

            if !recentNotes.isEmpty {
                section("Son notlar") {
                    ForEach(recentNotes) { note in
                        let course = store.courses.first { $0.id == note.courseId }
                        let when = Dates.parse(note.lastChange).map { Dates.short($0) }
                        let percent = note.generator != nil ? "%\(store.noteProgress(note).percent) tamamlandı" : nil
                        row(icon: "doc.text", tint: course?.tint ?? Theme.accent, title: note.title,
                            subtitle: [course?.name, when, percent].compactMap { $0 }.joined(separator: " · "),
                            chip: nil, target: .note(NoteRoute(note: note, start: .summary)))
                    }
                }
            }
        }
    }

    // MARK: - Pieces

    private func section<Content: View>(_ title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                SectionTitle(title)
                if let subtitle {
                    Text(subtitle).font(.caption).foregroundStyle(Theme.text2)
                }
            }
            VStack(spacing: 0) {
                content()
            }
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    @ViewBuilder
    private func row(icon: String, tint: Color, title: String, subtitle: String, chip: String?, target: NoteTarget) -> some View {
        let label = rowLabel(icon: icon, tint: tint, title: title, subtitle: subtitle, chip: chip)
        switch target {
        case let .note(route):
            NavigationLink(value: route) { label }.buttonStyle(.plain)
        default:
            Button { perform(target) } label: { label }.buttonStyle(.plain)
        }
    }

    private func rowLabel(icon: String, tint: Color, title: String, subtitle: String, chip: String?) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 6)
            if let chip {
                Text(chip)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.hiSoft, in: Capsule())
            } else {
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Theme.text3)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(minHeight: 52)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func actionButton(_ title: String, target: NoteTarget, primary: Bool) -> some View {
        let label = HStack(spacing: 6) {
            Text(title)
            Image(systemName: "arrow.right")
        }
        switch target {
        case let .note(route):
            NavigationLink(value: route) { label }.buttonStyle(PrimaryButtonStyle())
        default:
            Button { perform(target) } label: { label }.buttonStyle(PrimaryButtonStyle())
        }
    }

    private func perform(_ target: NoteTarget) {
        OnboardingHaptics.light()
        switch target {
        case .note: break
        case let .reviewNote(note):
            let due = store.cards(of: note).filter { $0.isDue() }.sorted { $0.dueDate < $1.dueDate }
            if !due.isEmpty { session = SessionBox(cards: due) }
        case let .addNote(course):
            addingTo = course
        case let .mockExam(course, exam):
            mock = MockBox(course: course, exam: exam)
        }
    }
}

private struct MockBox: Identifiable {
    let course: Course
    let exam: CourseExam?
    let id = UUID()
}
