import SwiftUI

/// "Dersler": every course with its next exam and how many cards are waiting.
struct CoursesView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                content
            }
            .navigationTitle("Dersler")
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationDestination(for: Course.self) { CourseDetailView(course: $0) }
            .navigationDestination(for: NoteItem.self) { NoteDetailView(note: $0) }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch store.status {
        case .idle, .loading:
            ProgressView().tint(Theme.text2)
        case let .failed(message):
            VStack(spacing: 14) {
                Message(text: message, kind: .error)
                Button("Tekrar dene") { Task { await store.load() } }
                    .buttonStyle(SecondaryButtonStyle())
            }
            .padding(20)
        case .ready:
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    greeting
                    if store.courses.isEmpty {
                        EmptyCourses()
                    } else {
                        LazyVStack(spacing: 12) {
                            ForEach(store.sortedCourses) { course in
                                NavigationLink(value: course) { CourseRow(course: course) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
    }

    private var greeting: some View {
        let left = min(store.goalLeft, store.todayQueue.count)
        let done = min(ReviewRules.dailyGoal, store.reviewsToday)
        return VStack(alignment: .leading, spacing: 10) {
            if !auth.firstName.isEmpty {
                Text("Selam, \(auth.firstName)")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.text2)
            }
            if left > 0 || done > 0 {
                HStack(spacing: 8) {
                    Image(systemName: left == 0 ? "checkmark.circle.fill" : "rectangle.stack.fill")
                    Text(left == 0 ? "Bugünkü tekrar tamam" : "Bugünkü hedef: \(done)/\(ReviewRules.dailyGoal)")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.hi, in: Capsule())
            }
        }
        .padding(.top, 4)
    }
}

struct CourseRow: View {
    @Environment(StudyStore.self) private var store
    let course: Course

    var body: some View {
        let notes = store.notes(in: course).count
        let cards = store.cardCount(course: course)
        let readiness = store.readiness(of: course)
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 3)
                .fill(course.tint)
                .frame(width: 6)
                .padding(.vertical, 2)
            VStack(alignment: .leading, spacing: 8) {
                Text(course.name)
                    .font(Theme.display(.headline, weight: .bold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 6) {
                    Text(notes == 0 ? "Not yok" : "\(notes) not")
                    Text("·")
                    Text("\(cards) kart")
                    if let readiness {
                        Text("·")
                        Text("Hazırlık %\(readiness)").fontWeight(.semibold).foregroundStyle(Theme.text)
                    }
                }
                .font(.footnote)
                .foregroundStyle(Theme.text2)
                if let exam = store.nextExam(course), let countdown = Exams.countdown(exam, store.audience) {
                    CountdownChip(text: countdown.text, tone: countdown.tone)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.text3)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}

struct CountdownChip: View {
    let text: String
    let tone: Exams.Tone

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "calendar")
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(tone == .danger ? Theme.onHi : Theme.text)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(background, in: Capsule())
    }

    private var background: Color {
        switch tone {
        case .danger: Theme.hi
        case .warning: Theme.hiSoft
        case .neutral: Theme.surface2
        }
    }
}

private struct EmptyCourses: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Henüz dersin yok")
                .font(Theme.display(.title3))
                .foregroundStyle(Theme.text)
            Text("Ders ve not ekleme uygulamaya birazdan geliyor. Şimdilik studymode.fun'da eklediğin dersler burada görünür.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
            Link("Sitede ders ekle", destination: Config.siteURL)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text)
                .underline()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .padding(.top, 8)
    }
}
