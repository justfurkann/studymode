import SwiftUI

/// One course: its exams and its notes, newest first.
struct CourseDetailView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.openNote) private var openNote
    let course: Course
    @State private var adding = false

    var body: some View {
        let notes = store.notes(in: course)
        let exams = store.examsFor(course)
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header(noteCount: notes.count)
                        .staggeredAppear(0)
                    if !exams.isEmpty {
                        examsSection(exams)
                            .staggeredAppear(1)
                    }
                    notesSection(notes)
                        .staggeredAppear(2)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .refreshable { await store.load() }
        }
        // The big header already names the course; an inline title would repeat it.
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    OnboardingHaptics.light()
                    adding = true
                } label: {
                    Label("Not ekle", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $adding) {
            AddNoteView(course: course, onDone: openNote).environment(store)
        }
    }

    private func header(noteCount: Int) -> some View {
        let readiness = store.readiness(of: course)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Circle().fill(course.tint).frame(width: 14, height: 14)
                Text(course.name)
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
            }

            HStack {
                Text("\(noteCount) not · \(store.cardCount(course: course)) kart")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                Spacer()
                if let readiness {
                    Text("Hazırlık: %\(readiness)")
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.text)
                }
            }

            if let readiness {
                FosforProgressBar(value: Double(readiness), total: 100, height: 9)
            }
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
                HStack(alignment: .center, spacing: 14) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bu derste henüz not yok")
                            .font(Theme.display(.headline))
                            .foregroundStyle(Theme.text)
                        Text("Sağ üstteki + ile yapıştır, fotoğraf çek ya da PDF ekle.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                    }
                    Spacer(minLength: 4)
                    FosforMascotView(size: 48, mood: .curious)
                }
                .padding(16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(Array(notes.enumerated()), id: \.element.id) { idx, note in
                        NavigationLink(value: note) {
                            NoteRow(note: note)
                        }
                        .buttonStyle(TactileCardButtonStyle())
                        .staggeredAppear(idx + 2)
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
            CountdownChip(
                text: countdown.days == 0 ? "Bugün" : countdown.days == 1 ? "Yarın" : "\(countdown.days) gün",
                tone: countdown.tone
            )
        } else if let grade = exam.grade {
            Text("Notun: \(grade.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish)))")
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 9)
                .padding(.vertical, 4)
                .background(Theme.hi, in: Capsule())
                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
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
        let stepsDone = min(5, store.noteSteps(note).count)

        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 7) {
                Text(note.title)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    StatusChip(note: note, stepsDone: stepsDone)

                    if note.isPrepared {
                        HStack(spacing: 3) {
                            ForEach(0..<5, id: \.self) { idx in
                                Capsule()
                                    .fill(idx < stepsDone ? Theme.hi : Theme.surface2)
                                    .overlay(
                                        Capsule()
                                            .stroke(idx < stepsDone ? Theme.cardLine : Theme.border, lineWidth: 0.8)
                                    )
                                    .frame(width: 9, height: 5)
                            }
                        }
                        .accessibilityHidden(true)
                    }

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
                .font(.footnote.weight(.bold))
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
    let stepsDone: Int

    var body: some View {
        if !note.isPrepared {
            Label("Hazırlanmadı", systemImage: "circle.dashed")
                .labelStyle(Chip(foreground: Theme.text2, background: Theme.surface2))
        } else if stepsDone >= 5 {
            Label("Bitti", systemImage: "checkmark.circle.fill")
                .labelStyle(Chip(foreground: Theme.onHi, background: Theme.hi))
        } else if stepsDone > 0 {
            Label("\(stepsDone)/5 adım", systemImage: "circle.lefthalf.filled")
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
