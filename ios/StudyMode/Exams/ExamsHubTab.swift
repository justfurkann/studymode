import SwiftUI

/// Native iOS port of `src/pages/ExamHub.tsx`:
/// Semester exam calendar, nearest exam focus card, post-exam grade prompts, and mock exam launcher per course.
struct ExamsHubTab: View {
    @Environment(StudyStore.self) private var store

    private struct EditingTarget: Identifiable {
        let course: Course?
        let exam: CourseExam?
        var id: String { exam?.id ?? "new-\(course?.id.uuidString ?? "any")" }
    }

    private struct MockTarget: Identifiable {
        let course: Course
        let exam: CourseExam?
        var id: String { "\(course.id.uuidString)-\(exam?.id ?? "all")" }
    }

    @State private var path = NavigationPath()
    @State private var editorTarget: EditingTarget?
    @State private var mockTarget: MockTarget?
    @State private var showPastExams = false

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                GridPaper()
                if store.status != .ready {
                    ScrollView {
                        StudyLoadingStage(message: "Sınav takvimin yükleniyor…", cardCount: 3)
                            .padding(.horizontal, 16)
                    }
                } else {
                    mainContent
                }
            }
            .navigationTitle("Sınavlar")
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        OnboardingHaptics.light()
                        editorTarget = EditingTarget(course: nil, exam: nil)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus")
                            Text("Sınav ekle")
                        }
                        .fontWeight(.semibold)
                    }
                    .disabled(store.status != .ready)
                }
            }
            .navigationDestination(for: CourseExam.self) { ExamStudyView(exam: $0) }
            .navigationDestination(for: Course.self) { CourseDetailView(course: $0) }
            .navigationDestination(for: NoteItem.self) { NoteDetailView(note: $0) }
        }
        .sheet(item: $editorTarget) { target in
            CourseExamEditorSheet(course: target.course, editing: target.exam)
                .environment(store)
        }
        .fullScreenCover(item: $mockTarget) { target in
            MockExamView(course: target.course, preselectedExam: target.exam)
                .environment(store)
        }
        .overlay(alignment: .top) { SaveErrorBanner() }
    }

    private var mainContent: some View {
        let upcoming = store.allUpcomingExams()
        let finished = store.allFinishedExams()
        let waitingGrade = finished.filter { $0.exam.grade == nil }
        let gradedPast = finished.filter { $0.exam.grade != nil }
        let courses = store.sortedCourses

        return ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let focus = upcoming.first {
                    focusHeroCard(exam: focus.exam, course: focus.course)
                        .staggeredAppear(0)
                } else {
                    emptyCalendarHero
                        .staggeredAppear(0)
                }

                if !waitingGrade.isEmpty {
                    pendingGradesSection(waitingGrade)
                        .staggeredAppear(1)
                }

                if !upcoming.isEmpty {
                    calendarSection(upcoming)
                        .staggeredAppear(2)
                }

                mockExamSection(courses: courses)
                    .staggeredAppear(3)

                if !gradedPast.isEmpty {
                    pastExamsDisclosure(gradedPast)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
        .refreshable { await store.load() }
    }

    // MARK: - Focus Hero Card

    private func focusHeroCard(exam: CourseExam, course: Course) -> some View {
        let countdown = Exams.countdown(exam, store.audience)
        let readiness = store.readiness(for: exam)

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Circle().fill(course.tint).frame(width: 8, height: 8)
                        Text("SIRADAKİ SINAV · \(course.name.uppercased())")
                            .font(.caption2.weight(.heavy))
                            .tracking(0.5)
                            .foregroundStyle(.white.opacity(0.82))
                            .lineLimit(1)
                    }

                    Text(countdown?.text ?? Exams.name(exam, store.audience))
                        .font(Theme.display(.title))
                        .foregroundStyle(.white)

                    Text("\(Exams.dateText(exam))\(readiness.map { " · Hazırlık: %\($0)" } ?? "")")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.80))
                }

                Spacer(minLength: 8)

                TalkingFosfor(
                    size: 52,
                    mood: (readiness ?? 0) >= 75 ? .cheering : .marking,
                    onDark: true
                )
            }

            if let readiness {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.14))
                        Capsule()
                            .fill(Theme.hi)
                            .frame(width: max(14, geo.size.width * CGFloat(readiness) / 100.0))
                    }
                }
                .frame(height: 8)
            }

            HStack(spacing: 10) {
                NavigationLink(value: exam) {
                    HStack(spacing: 5) {
                        Image(systemName: "book.fill")
                        Text("Çalış")
                    }
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(.white)
                    .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.22), lineWidth: 1))
                }
                .buttonStyle(.plain)

                Button {
                    OnboardingHaptics.medium()
                    mockTarget = MockTarget(course: course, exam: exam)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "sparkles")
                        Text("Sınav provası")
                    }
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .foregroundStyle(Theme.onHi)
                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(TactileCardButtonStyle(scale: 0.98))
            }
        }
        .padding(20)
        .background(Color(light: 0x1B2250, dark: 0x22284E), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.cardLine, lineWidth: 2))
        .background(RoundedRectangle(cornerRadius: 22).fill(Theme.cardDrop).offset(y: 5))
    }

    private var emptyCalendarHero: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("Sınav")
                            .font(Theme.display(.title2))
                            .foregroundStyle(Theme.text)
                        Highlighted(text: "takvimin", font: Theme.display(.title2))
                    }
                    Text("Vize, final ya da yazılı tarihlerini ekle; hangi derse önce çalışacağını ve hazırlık durumunu birlikte takip edelim.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                }
                Spacer(minLength: 4)
                FosforMascotView(size: 52, mood: .curious)
            }

            Button {
                OnboardingHaptics.medium()
                editorTarget = EditingTarget(course: nil, exam: nil)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "calendar.badge.plus")
                    Text("İlk sınav tarihini ekle")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .focusCard()
    }

    // MARK: - Pending Grades Banner

    private func pendingGradesSection(_ items: [(exam: CourseExam, course: Course)]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Sınavın nasıl geçti?")
            ForEach(items, id: \.exam.id) { item in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Circle().fill(item.course.tint).frame(width: 8, height: 8)
                            Text("\(item.course.name) · \(Exams.name(item.exam, store.audience))")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text)
                        }
                        Text(Exams.dateText(item.exam))
                            .font(.caption)
                            .foregroundStyle(Theme.text2)
                    }
                    Spacer()
                    Button {
                        OnboardingHaptics.light()
                        editorTarget = EditingTarget(course: item.course, exam: item.exam)
                    } label: {
                        Text("Not gir")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.onHi)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Theme.hi, in: Capsule())
                            .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                .padding(14)
                .background(Theme.hiSoft.opacity(0.65), in: RoundedRectangle(cornerRadius: 15))
                .overlay(RoundedRectangle(cornerRadius: 15).stroke(Theme.cardLine.opacity(0.45), lineWidth: 1))
            }
        }
    }

    // MARK: - Upcoming Calendar List

    private func calendarSection(_ upcoming: [(exam: CourseExam, course: Course, days: Int)]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Takvim")
            VStack(spacing: 0) {
                ForEach(Array(upcoming.enumerated()), id: \.element.exam.id) { idx, entry in
                    if idx > 0 { Divider().overlay(Theme.border) }
                    NavigationLink(value: entry.exam) {
                        calendarRow(exam: entry.exam, course: entry.course, days: entry.days)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button {
                            editorTarget = EditingTarget(course: entry.course, exam: entry.exam)
                        } label: {
                            Label("Sınavı düzenle", systemImage: "pencil")
                        }
                        Button {
                            mockTarget = MockTarget(course: entry.course, exam: entry.exam)
                        } label: {
                            Label("Sınav provası başlat", systemImage: "sparkles")
                        }
                        Button(role: .destructive) {
                            store.deleteCourseExam(entry.exam)
                        } label: {
                            Label("Sınavı sil", systemImage: "trash")
                        }
                    }
                }
            }
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    private func calendarRow(exam: CourseExam, course: Course, days: Int) -> some View {
        let dayDate = Dates.day(exam.date) ?? .now
        let dayNum = Calendar.current.component(.day, from: dayDate)
        let monthShort = dayDate.formatted(Date.FormatStyle(locale: Dates.turkish).month(.abbreviated))
        let readiness = store.readiness(for: exam)
        let countdown = Exams.countdown(exam, store.audience)

        return HStack(spacing: 12) {
            // Date tile (mirrors `.exam-date` on the site)
            VStack(spacing: 1) {
                Text("\(dayNum)")
                    .font(Theme.display(.headline))
                    .monospacedDigit()
                Text(monthShort.uppercased())
                    .font(.system(size: 10, weight: .bold, design: .rounded))
            }
            .foregroundStyle(days <= 3 ? Theme.onHi : Theme.text)
            .frame(width: 46, height: 48)
            .background(days <= 3 ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(days <= 3 ? Theme.cardLine : Theme.border, lineWidth: days <= 3 ? 1.5 : 1)
            )

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Circle().fill(course.tint).frame(width: 8, height: 8)
                    Text("\(course.name) · \(Exams.name(exam, store.audience))")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                }

                Text(
                    [
                        Exams.cleanTime(exam.time),
                        exam.weight.map { "Ağırlık %\(Int($0.rounded()))" },
                        readiness.map { "Hazırlık: %\($0)" } ?? "Henüz not yok"
                    ]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                )
                .font(.caption)
                .foregroundStyle(Theme.text2)
                .lineLimit(1)
            }

            Spacer(minLength: 6)

            if let countdown {
                CountdownChip(text: countdown.text, tone: countdown.tone)
                    .fixedSize()
            }
        }
        .padding(13)
        .contentShape(Rectangle())
    }

    // MARK: - Mock Exam Per Course

    private func mockExamSection(courses: [Course]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                SectionTitle("Sınav provası")
                Text("Bir ders seç; test, boşluk doldurma ve klasik sorularla gerçek sınav provası yap.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
            }

            if courses.isEmpty {
                EmptyBox(
                    title: "Henüz dersin yok",
                    text: "Çalışma masasından ilk ders notunu eklediğinde sınav provası hazır olur."
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(courses) { course in
                        let noteCount = store.notes(in: course).count
                        let lastMock = store.lastMockExam(for: course)

                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(course.tint)
                                .frame(width: 5, height: 40)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(course.name)
                                    .font(.headline)
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)

                                HStack(spacing: 6) {
                                    Text(noteCount == 0 ? "Henüz not yok" : "\(noteCount) not")
                                    if let lastMock {
                                        Text("· Son prova: %\(lastMock.percent)")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .font(.caption)
                                .foregroundStyle(Theme.text2)
                            }

                            Spacer(minLength: 8)

                            Button {
                                OnboardingHaptics.medium()
                                mockTarget = MockTarget(course: course, exam: store.nextExam(course))
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: "sparkles")
                                    Text("Prova çöz")
                                }
                                .font(.caption.weight(.bold))
                                .foregroundStyle(noteCount == 0 ? Theme.text3 : Theme.onHi)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(noteCount == 0 ? Theme.surface2 : Theme.hi, in: Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(noteCount == 0 ? Theme.border : Theme.cardLine, lineWidth: 1.2)
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(noteCount == 0)
                        }
                        .padding(14)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
                    }
                }
            }
        }
    }

    // MARK: - Graded Past Exams

    private func pastExamsDisclosure(_ past: [(exam: CourseExam, course: Course)]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                OnboardingHaptics.selection()
                withAnimation(.spring(response: 0.36, dampingFraction: 0.80)) {
                    showPastExams.toggle()
                }
            } label: {
                HStack {
                    Text("Geçmiş sınavlar (\(past.count))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    Image(systemName: showPastExams ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text3)
                }
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)

            if showPastExams {
                VStack(spacing: 8) {
                    ForEach(past, id: \.exam.id) { item in
                        Button {
                            editorTarget = EditingTarget(course: item.course, exam: item.exam)
                        } label: {
                            HStack {
                                Circle().fill(item.course.tint).frame(width: 8, height: 8)
                                Text("\(item.course.name) · \(Exams.name(item.exam, store.audience))")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.text)
                                Spacer()
                                if let g = item.exam.grade {
                                    Text("Not: \(g.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish)))")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Theme.onHi)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Theme.hi, in: Capsule())
                                }
                            }
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
