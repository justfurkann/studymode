import SwiftUI

/// One course: its exams and its notes, newest first.
struct CourseDetailView: View {
    @Environment(StudyStore.self) private var store
    let course: Course

    var body: some View {
        let notes = store.notes(in: course)
        let exams = store.examsFor(course)
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header(noteCount: notes.count)
                    if !exams.isEmpty { examsSection(exams) }
                    notesSection(notes)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
        // The big header already names the course; an inline title would repeat it.
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private func header(noteCount: Int) -> some View {
        let due = store.dueCount(course: course)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Circle().fill(course.tint).frame(width: 14, height: 14)
                Text(course.name)
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
            }
            Text("\(noteCount) not · \(store.cardCount(course: course)) kart\(due > 0 ? " · \(due) tekrar bekliyor" : "")")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
        }
        .padding(.top, 8)
    }

    private func examsSection(_ exams: [CourseExam]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Sınavlar")
            VStack(spacing: 0) {
                ForEach(Array(exams.enumerated()), id: \.element.id) { index, exam in
                    if index > 0 { Divider().overlay(Theme.border) }
                    ExamRow(exam: exam)
                }
            }
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    private func notesSection(_ notes: [NoteItem]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle("Notlar")
            if notes.isEmpty {
                Text("Bu derste henüz not yok. Not ekleme uygulamaya birazdan geliyor; şimdilik sitede ekleyebilirsin.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(notes) { note in
                        NavigationLink(value: note) { NoteRow(note: note) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

struct SectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(Theme.display(.title3, weight: .bold))
            .foregroundStyle(Theme.text)
    }
}

private struct ExamRow: View {
    @Environment(StudyStore.self) private var store
    let exam: CourseExam

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(Exams.name(exam, store.audience))
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    if let weight = exam.weight {
                        Text("%\(Int(weight.rounded()))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.surface2, in: Capsule())
                    }
                }
                Text(Exams.dateText(exam))
                    .font(.footnote)
                    .foregroundStyle(Theme.text2)
            }
            Spacer(minLength: 8)
            trailing
        }
        .padding(14)
    }

    @ViewBuilder
    private var trailing: some View {
        if let countdown = Exams.countdown(exam, store.audience) {
            CountdownChip(text: countdown.days == 0 ? "Bugün" : countdown.days == 1 ? "Yarın" : "\(countdown.days) gün", tone: countdown.tone)
        } else if let grade = exam.grade {
            Text("Notun: \(grade.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish)))")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text)
        } else {
            Text("Bitti")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.text3)
        }
    }
}

private struct NoteRow: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem

    var body: some View {
        let cards = store.cardCount(note: note)
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(note.title)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 8) {
                    StatusChip(note: note)
                    if cards > 0 {
                        Text("\(cards) kart")
                            .font(.caption)
                            .foregroundStyle(Theme.text2)
                    }
                    if let date = Dates.parse(note.createdAt) {
                        Text(Dates.short(date))
                            .font(.caption)
                            .foregroundStyle(Theme.text3)
                    }
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

private struct StatusChip: View {
    let note: NoteItem

    var body: some View {
        if !note.isPrepared {
            Label("Hazırlanmadı", systemImage: "circle.dashed")
                .labelStyle(Chip(foreground: Theme.text2, background: Theme.surface2))
        } else if let done = note.completedSteps?.count, done >= 5 {
            Label("Bitti", systemImage: "checkmark.circle.fill")
                .labelStyle(Chip(foreground: Theme.onHi, background: Theme.hi))
        } else if let done = note.completedSteps?.count, done > 0 {
            Label("\(done)/5 adım", systemImage: "circle.lefthalf.filled")
                .labelStyle(Chip(foreground: Theme.text, background: Theme.hiSoft))
        } else {
            Label("Hazır", systemImage: "sparkles")
                .labelStyle(Chip(foreground: Theme.text, background: Theme.hiSoft))
        }
    }

    private struct Chip: LabelStyle {
        let foreground: Color
        let background: Color

        func makeBody(configuration: Configuration) -> some View {
            HStack(spacing: 4) {
                configuration.icon
                configuration.title
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(foreground)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(background, in: Capsule())
        }
    }
}
