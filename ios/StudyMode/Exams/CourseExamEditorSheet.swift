import SwiftUI

/// Create, edit, or delete a course exam (`course_exams`), or enter its post-exam grade.
struct CourseExamEditorSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let initialCourse: Course?
    let editingExam: CourseExam?
    var focusGradeOnOpen: Bool = false

    @State private var selectedCourseId: UUID?
    @State private var kind: ExamKind = .vize
    @State private var customTitle = ""
    @State private var dateValue = Calendar.current.date(byAdding: .day, value: 14, to: .now) ?? .now
    @State private var hasTime = false
    @State private var timeValue = Calendar.current.date(bySettingHour: 10, minute: 0, second: 0, of: .now) ?? .now
    @State private var weightText = ""
    @State private var gradeText = ""
    @State private var allNotes = true
    @State private var selectedNoteIds: Set<String> = []
    @State private var showNewCourseAlert = false
    @State private var newCourseName = ""
    @State private var confirmDelete = false
    @State private var gradeCelebrationBurst = 0
    @State private var error: String?

    init(course: Course? = nil, editing: CourseExam? = nil, focusGradeOnOpen: Bool = false) {
        self.initialCourse = course
        self.editingExam = editing
        self.focusGradeOnOpen = focusGradeOnOpen
        _selectedCourseId = State(initialValue: editing?.courseId ?? course?.id)
        if let editing {
            _kind = State(initialValue: editing.kind)
            _customTitle = State(initialValue: editing.title ?? "")
            if let parsedDay = Dates.day(editing.date) {
                _dateValue = State(initialValue: parsedDay)
            }
            if let clean = Exams.cleanTime(editing.time) {
                let parts = clean.split(separator: ":").compactMap { Int($0) }
                if parts.count == 2,
                   let dt = Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: .now) {
                    _hasTime = State(initialValue: true)
                    _timeValue = State(initialValue: dt)
                }
            }
            if let w = editing.weight {
                _weightText = State(initialValue: String(Int(w.rounded())))
            }
            if let g = editing.grade {
                _gradeText = State(initialValue: g.formatted(.number.precision(.fractionLength(0...1))))
            }
            if !editing.noteIds.isEmpty {
                _allNotes = State(initialValue: false)
                _selectedNoteIds = State(initialValue: Set(editing.noteIds.map { $0.lowercased() }))
            }
        }
    }

    private var activeCourse: Course? {
        store.courses.first { $0.id == selectedCourseId }
    }

    private var courseNotes: [NoteItem] {
        guard let activeCourse else { return [] }
        return store.notes(in: activeCourse)
    }

    private var parsedGrade: Double? {
        let cleaned = gradeText.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        guard !cleaned.isEmpty, let v = Double(cleaned), (0...100).contains(v) else { return nil }
        return v
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if initialCourse == nil && editingExam == nil {
                            coursePickerSection
                        }

                        kindSection
                        dateAndTimeSection
                        weightAndGradeSection

                        if !courseNotes.isEmpty {
                            scopeSection
                        }

                        if let error {
                            Message(text: error, kind: .error)
                        }

                        if let editingExam {
                            Button(role: .destructive) {
                                confirmDelete = true
                            } label: {
                                Label("Sınavı sil", systemImage: "trash")
                                    .foregroundStyle(Theme.danger)
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .padding(.top, 8)
                            .confirmationDialog(
                                "\(Exams.name(editingExam, store.audience)) sınavı silinsin mi?",
                                isPresented: $confirmDelete,
                                titleVisibility: .visible
                            ) {
                                Button("Sınavı sil", role: .destructive) {
                                    OnboardingHaptics.medium()
                                    store.deleteCourseExam(editingExam)
                                    dismiss()
                                }
                                Button("Vazgeç", role: .cancel) {}
                            }
                        }
                    }
                    .padding(16)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)

                HighlighterSparkBurst(trigger: gradeCelebrationBurst)
            }
            .navigationTitle(editingExam == nil ? "Sınav ekle" : "Sınavı düzenle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    Button {
                        save()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.circle.fill")
                            Text(editingExam == nil ? "Sınavı ekle" : "Değişiklikleri kaydet")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(activeCourse == nil)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Theme.bg.opacity(0.96))
            }
            .alert("Yeni ders", isPresented: $showNewCourseAlert) {
                TextField("Ders adı", text: $newCourseName)
                Button("Vazgeç", role: .cancel) { newCourseName = "" }
                Button("Ekle") { createCourse() }
            }
            .onAppear {
                if selectedCourseId == nil {
                    selectedCourseId = store.sortedCourses.first?.id
                }
            }
        }
    }

    // MARK: - Sections

    private var coursePickerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Ders")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            Menu {
                ForEach(store.sortedCourses) { c in
                    Button {
                        selectedCourseId = c.id
                        selectedNoteIds = []
                        allNotes = true
                    } label: {
                        Text(c.name)
                    }
                }
                Divider()
                Button { showNewCourseAlert = true } label: {
                    Label("Yeni ders ekle…", systemImage: "plus")
                }
            } label: {
                HStack {
                    if let activeCourse {
                        Circle().fill(activeCourse.tint).frame(width: 10, height: 10)
                    }
                    Text(activeCourse?.name ?? "Ders seç")
                        .foregroundStyle(activeCourse == nil ? Theme.text3 : Theme.text)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.footnote)
                        .foregroundStyle(Theme.text3)
                }
                .field()
            }
        }
    }

    private var kindSection: some View {
        let options = Exams.kindOptions(for: store.audience)
        return VStack(alignment: .leading, spacing: 10) {
            Text("Sınav türü")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(options, id: \.kind) { opt in
                        let selected = kind == opt.kind
                        Button {
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) {
                                kind = opt.kind
                            }
                        } label: {
                            Text(opt.label)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(selected ? Theme.onHi : Theme.text)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 9)
                                .background(selected ? Theme.hi : Theme.surface, in: Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(selected ? Theme.cardLine : Theme.border, lineWidth: selected ? 1.8 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if kind == .diger {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Sınav adı (ör. Proje sunumu, TYT, Sözlü)", text: $customTitle)
                        .field()

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Exams.schoolPresetTitles, id: \.self) { preset in
                                Button {
                                    OnboardingHaptics.light()
                                    customTitle = preset
                                } label: {
                                    Text(preset)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(customTitle == preset ? Theme.onHi : Theme.text2)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(customTitle == preset ? Theme.hi : Theme.surface2, in: Capsule())
                                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var dateAndTimeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Tarih ve saat")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            VStack(spacing: 12) {
                DatePicker(
                    "Sınav tarihi",
                    selection: $dateValue,
                    displayedComponents: .date
                )
                .environment(\.locale, Dates.turkish)
                .tint(Theme.accent)

                Divider().overlay(Theme.border)

                Toggle("Başlangıç saati belli", isOn: $hasTime.animation(.spring(response: 0.34, dampingFraction: 0.80)))
                    .font(.subheadline)
                    .tint(Theme.accent)

                if hasTime {
                    DatePicker(
                        "Saat",
                        selection: $timeValue,
                        displayedComponents: .hourAndMinute
                    )
                    .environment(\.locale, Dates.turkish)
                    .tint(Theme.accent)
                }
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    private var weightAndGradeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ağırlık ve sınav notu (isteğe bağlı)")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Ağırlık (%)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.text3)
                    TextField("Ör. 40", text: $weightText)
                        .keyboardType(.numberPad)
                        .field()
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("Aldığın not (0-100)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.text3)
                    TextField("Sınav sonrası gir", text: $gradeText)
                        .keyboardType(.decimalPad)
                        .field()
                        .onChange(of: gradeText) { _, _ in
                            if let g = parsedGrade, g >= 70 {
                                gradeCelebrationBurst += 1
                            }
                        }
                }
            }

            if let g = parsedGrade {
                HStack(spacing: 10) {
                    FosforMascotView(
                        size: 42,
                        mood: g >= 80 ? .cheering : (g >= 60 ? .proud : .curious)
                    )
                    Text(g >= 85
                         ? "Harika bir sonuç! Kaydedince ders sayfasında görünecek."
                         : g >= 60
                            ? "Güzel! Notun ders takvimine işlenecek."
                            : "Kaydedildiğinde sıradaki sınav için çalışma planına odaklanabiliriz.")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.text)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                .transition(.scale(scale: 0.95).combined(with: .opacity))
            }
        }
    }

    private var scopeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sınav kapsamı")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            VStack(alignment: .leading, spacing: 10) {
                Toggle("Dersteki tüm notlar dahil", isOn: $allNotes.animation(.spring(response: 0.34, dampingFraction: 0.80)))
                    .font(.subheadline.weight(.medium))
                    .tint(Theme.accent)

                if !allNotes {
                    Divider().overlay(Theme.border)
                    ForEach(courseNotes) { note in
                        let key = note.id.uuidString.lowercased()
                        let picked = selectedNoteIds.contains(key)
                        Button {
                            OnboardingHaptics.selection()
                            if picked {
                                selectedNoteIds.remove(key)
                            } else {
                                selectedNoteIds.insert(key)
                            }
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: picked ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(picked ? Theme.accent : Theme.border)
                                Text(note.title)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(1)
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    // MARK: - Actions

    private func createCourse() {
        let trimmed = newCourseName.trimmingCharacters(in: .whitespacesAndNewlines)
        newCourseName = ""
        guard !trimmed.isEmpty else { return }
        Task {
            do {
                let c = try await store.createCourse(name: trimmed)
                selectedCourseId = c.id
            } catch {
                self.error = "Ders oluşturulamadı. Bağlantını kontrol et."
            }
        }
    }

    private func save() {
        guard let courseId = selectedCourseId else { return }
        error = nil

        let weight: Double? = {
            let t = weightText.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
            guard !t.isEmpty else { return nil }
            return Double(t)
        }()
        if let weight, !(0...100).contains(weight) {
            error = "Ağırlık 0 ile 100 arasında olmalı."
            return
        }

        let trimmedGrade = gradeText.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces)
        if !trimmedGrade.isEmpty && parsedGrade == nil {
            error = "Sınav notu 0 ile 100 arasında bir sayı olmalı."
            return
        }

        let timeString: String? = {
            guard hasTime else { return nil }
            let c = Calendar.current.dateComponents([.hour, .minute], from: timeValue)
            return String(format: "%02d:%02d", c.hour ?? 9, c.minute ?? 0)
        }()

        let noteIds: [String] = allNotes
            ? []
            : courseNotes
                .filter { selectedNoteIds.contains($0.id.uuidString.lowercased()) }
                .map { $0.id.uuidString.lowercased() }

        let draft = CourseExamDraft(
            existingId: editingExam?.id,
            courseId: courseId,
            kind: kind,
            title: kind == .diger ? customTitle : nil,
            date: Exams.dayString(dateValue),
            time: timeString,
            weight: weight,
            grade: parsedGrade,
            noteIds: noteIds
        )

        OnboardingHaptics.success()
        store.saveCourseExam(draft)
        dismiss()
    }
}
