import SwiftUI

/// Full interactive Mock Exam ("Sınav Provası") ported from `src/pages/Exam.tsx`:
/// Supports AI-generated exams (Test + Boşluk Doldurma + Klasik yazılı) and instant offline MCQ exams,
/// wall-clock timer, AI written-answer grading, Supabase `exam_results` sync, and converting mistakes to cards.
struct MockExamView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let course: Course
    var preselectedExam: CourseExam? = nil

    enum Phase: Equatable {
        case setup
        case preparing
        case running
        case grading
        case result
    }

    enum GenerationMode: Hashable {
        case ai
        case local
    }

    @State private var phase: Phase = .setup
    @State private var mode: GenerationMode = .ai
    @State private var targetExamId: String = ""
    @State private var plan = MockExamPlan()
    @State private var selectedNoteIds: Set<UUID> = []
    @State private var showTeacherNotes = false
    @State private var error: String?

    // Active exam state
    @State private var questions: [MockExamQuestion] = []
    @State private var answers: [MockExamAnswer] = []
    @State private var currentIndex = 0
    @State private var startedAt: Date = .now
    @State private var endsAt: Date? = nil
    @State private var evaluation: MockExamEvaluation? = nil
    @State private var durationTaken: Int? = nil
    @State private var convertedCount: Int? = nil
    @State private var confirmEarlySubmit = false
    @State private var confirmExitRunning = false
    @State private var similarCount: Int = 5
    @State private var isSimilarRound = false
    @State private var resultError: String? = nil

    private static let similarOptions = [3, 5, 8, 10]

    private static let letters = ["A", "B", "C", "D", "E", "F"]

    private var courseNotes: [NoteItem] {
        store.notes(in: course)
    }

    private var upcomingExams: [CourseExam] {
        store.examsFor(course).filter { !Exams.ended($0) }
    }

    private var chosenNotes: [NoteItem] {
        courseNotes.filter { selectedNoteIds.contains($0.id) }
    }

    private var effectiveQuestionCount: Int {
        mode == .ai ? plan.totalQuestions : max(5, plan.mcqCount > 0 ? plan.mcqCount : 10)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                switch phase {
                case .setup:
                    setupScreen
                case .preparing:
                    workingStage(
                        title: "Sınav kağıdın hazırlanıyor…",
                        subtitle: mode == .ai
                            ? "Fosfor seçtiğin notları okuyup gerçek sınav ayarında sorular yazıyor."
                            : "Notlarındaki sorular harmanlanıyor."
                    )
                case .running:
                    runningScreen
                case .grading:
                    workingStage(
                        title: "Cevapların puanlanıyor…",
                        subtitle: questions.contains(where: { $0.type == .open })
                            ? "Klasik yazılı cevapların örnek anahtara göre değerlendiriliyor."
                            : "Sonuç tablon hesaplanıyor."
                    )
                case .result:
                    resultScreen
                }
            }
            .navigationTitle(phase == .running ? course.name : "Sınav provası")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        if phase == .running {
                            confirmExitRunning = true
                        } else {
                            dismiss()
                        }
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .disabled(phase == .preparing || phase == .grading)
                    .accessibilityLabel("Kapat")
                }

                if phase == .running {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Bitir") {
                            let unanswered = answers.filter { !$0.isAnswered }.count
                            if unanswered > 0 {
                                confirmEarlySubmit = true
                            } else {
                                submitExam()
                            }
                        }
                        .fontWeight(.bold)
                    }
                }
            }
            .interactiveDismissDisabled(phase == .running || phase == .preparing || phase == .grading)
            .confirmationDialog(
                "Sınavdan çıkılsın mı? İşaretlediğin cevaplar kaydedilmeyecek.",
                isPresented: $confirmExitRunning,
                titleVisibility: .visible
            ) {
                Button("Sınavdan çık", role: .destructive) { dismiss() }
                Button("Sınava dön", role: .cancel) {}
            }
            .confirmationDialog(
                "Boş bıraktığın sorular var. Sınavı yine de bitirmek istiyor musun?",
                isPresented: $confirmEarlySubmit,
                titleVisibility: .visible
            ) {
                Button("Sınavı bitir ve puanla") { submitExam() }
                Button("Çözmeye devam et", role: .cancel) {}
            }
            .onAppear {
                bootstrapSetup()
            }
        }
    }

    // MARK: - Setup Screen

    private var setupScreen: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header card
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 6) {
                            Circle().fill(course.tint).frame(width: 10, height: 10)
                            Text(course.name)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text2)
                        }
                        Text("Gerçeğine en yakın deneme sınavı")
                            .font(Theme.display(.title3))
                            .foregroundStyle(Theme.text)
                        Text("Soru türlerini, süreyi ve hocanın söylediklerini seç; notlarından sınav üretelim.")
                            .font(.footnote)
                            .foregroundStyle(Theme.text2)
                    }
                    Spacer(minLength: 4)
                    FosforMascotView(size: 50, mood: .marking)
                }
                .focusCard()

                if courseNotes.isEmpty {
                    EmptyBox(
                        title: "Bu derste henüz not yok",
                        text: "Sınav provası oluşturmak için önce bu derse en az bir ders notu ekle."
                    )
                } else {
                    // Target exam selector (if course has upcoming exams)
                    if !upcomingExams.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Hangi sınava hazırlanıyorsun?")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text2)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(upcomingExams) { ex in
                                        let active = targetExamId == ex.id
                                        Button {
                                            OnboardingHaptics.selection()
                                            selectTargetExam(ex.id)
                                        } label: {
                                            Text(Exams.name(ex, store.audience))
                                                .font(.subheadline.weight(.bold))
                                                .foregroundStyle(active ? Theme.onHi : Theme.text)
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 8)
                                                .background(active ? Theme.hi : Theme.surface, in: Capsule())
                                                .overlay(
                                                    Capsule()
                                                        .stroke(active ? Theme.cardLine : Theme.border, lineWidth: active ? 1.5 : 1)
                                                )
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }

                    // AI vs Existing Questions toggle
                    FosforSegmentedBar(
                        segments: [
                            .init(value: GenerationMode.ai, title: "Yapay zekâyla yeni", icon: "sparkles"),
                            .init(value: GenerationMode.local, title: "Hazır sorulardan", icon: "rectangle.stack")
                        ],
                        selection: $mode
                    )

                    if mode == .ai {
                        aiPlanControls
                    } else {
                        pillRow(
                            title: "Test sorusu sayısı",
                            values: [5, 10, 15, 20, 30],
                            selected: plan.mcqCount == 0 ? 10 : plan.mcqCount,
                            label: { "\($0)" },
                            onSelect: { plan.mcqCount = $0; persistPlan() }
                        )
                    }

                    // Duration & Difficulty
                    pillRow(
                        title: "Süre sınırı",
                        values: MockExamPlan.minuteOptions,
                        selected: plan.minutes,
                        label: { $0 == 0 ? "Süresiz" : "\($0) dk" },
                        onSelect: { plan.minutes = $0; persistPlan() }
                    )

                    if mode == .ai {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Zorluk")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text2)
                            FosforSegmentedBar(
                                segments: MockExamDifficulty.allCases.map {
                                    .init(value: $0, title: $0.label)
                                },
                                selection: Binding(
                                    get: { plan.difficulty },
                                    set: { plan.difficulty = $0; persistPlan() }
                                )
                            )
                        }

                        teacherHintsDisclosure
                    }

                    notesSelectionSection

                    if let error {
                        Message(text: error, kind: .error)
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            if !courseNotes.isEmpty {
                VStack(spacing: 6) {
                    Button {
                        startExam()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: mode == .ai ? "sparkles" : "play.fill")
                            Text("Sınavı başlat (\(effectiveQuestionCount) soru\(plan.minutes > 0 ? " · \(plan.minutes) dk" : ""))")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(chosenNotes.isEmpty || effectiveQuestionCount == 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Theme.bg.opacity(0.96))
            }
        }
    }

    private var aiPlanControls: some View {
        VStack(alignment: .leading, spacing: 16) {
            pillRow(
                title: "Test sorusu (çoktan seçmeli)",
                values: MockExamPlan.mcqOptions,
                selected: plan.mcqCount,
                label: { $0 == 0 ? "Yok" : "\($0)" },
                onSelect: { val in
                    plan.mcqCount = val
                    ensureAtLeastOneQuestion()
                    persistPlan()
                }
            )

            pillRow(
                title: "Boşluk doldurma (ortak kelime havuzlu)",
                values: MockExamPlan.blankOptions,
                selected: plan.blankCount,
                label: { $0 == 0 ? "Yok" : "\($0)" },
                onSelect: { val in
                    plan.blankCount = val
                    ensureAtLeastOneQuestion()
                    persistPlan()
                }
            )

            if plan.blankCount > 0 {
                pillRow(
                    title: "Havuzdaki yanıltıcı kelime sayısı",
                    values: MockExamPlan.distractorOptions,
                    selected: plan.distractorCount,
                    label: { $0 == 0 ? "Yok" : "+\($0)" },
                    onSelect: { plan.distractorCount = $0; persistPlan() }
                )
            }

            pillRow(
                title: "Klasik yazılı soru (yapay zekâ puanlar)",
                values: MockExamPlan.openOptions,
                selected: plan.openCount,
                label: { $0 == 0 ? "Yok" : "\($0)" },
                onSelect: { val in
                    plan.openCount = val
                    ensureAtLeastOneQuestion()
                    persistPlan()
                }
            )
        }
    }

    private func pillRow(
        title: String,
        values: [Int],
        selected: Int,
        label: @escaping (Int) -> String,
        onSelect: @escaping (Int) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text2)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(values, id: \.self) { val in
                        let isSelected = selected == val
                        Button {
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.30, dampingFraction: 0.78)) {
                                onSelect(val)
                            }
                        } label: {
                            Text(label(val))
                                .font(.subheadline.weight(.bold).monospacedDigit())
                                .foregroundStyle(isSelected ? Theme.onHi : Theme.text)
                                .padding(.horizontal, 13)
                                .padding(.vertical, 8)
                                .background(isSelected ? Theme.hi : Theme.surface, in: Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(isSelected ? Theme.cardLine : Theme.border, lineWidth: isSelected ? 1.6 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var teacherHintsDisclosure: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button {
                OnboardingHaptics.selection()
                withAnimation(.spring(response: 0.36, dampingFraction: 0.80)) {
                    showTeacherNotes.toggle()
                }
            } label: {
                HStack {
                    Label("Hoca ne dedi? / Çıkmış soru tarzı", systemImage: "text.bubble")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Image(systemName: showTeacherNotes ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text3)
                }
                .padding(14)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
            }
            .buttonStyle(.plain)

            if showTeacherNotes {
                VStack(alignment: .leading, spacing: 10) {
                    TextField(
                        "Hoca sınav hakkında ne söyledi? (ör. 4. hafta dahil değil, tanımlar önemli)",
                        text: $plan.info,
                        axis: .vertical
                    )
                    .lineLimit(2...5)
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    .onChange(of: plan.info) { _, _ in persistPlan() }

                    TextField(
                        "Varsa çıkmış örnek soruları yapıştır (tarzını taklit eder, birebir kopyalamaz)",
                        text: $plan.pastQuestions,
                        axis: .vertical
                    )
                    .lineLimit(2...5)
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                    .onChange(of: plan.pastQuestions) { _, _ in persistPlan() }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private var notesSelectionSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Kapsamdaki notlar (\(chosenNotes.count)/\(courseNotes.count))")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text2)
                Spacer()
                Button(selectedNoteIds.count == courseNotes.count ? "Hiçbiri" : "Tümünü seç") {
                    OnboardingHaptics.selection()
                    if selectedNoteIds.count == courseNotes.count {
                        selectedNoteIds.removeAll()
                    } else {
                        selectedNoteIds = Set(courseNotes.map(\.id))
                    }
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.text)
            }

            VStack(spacing: 8) {
                ForEach(courseNotes) { note in
                    let picked = selectedNoteIds.contains(note.id)
                    Button {
                        OnboardingHaptics.selection()
                        if picked {
                            selectedNoteIds.remove(note.id)
                        } else {
                            selectedNoteIds.insert(note.id)
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: picked ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(picked ? Theme.accent : Theme.border)
                            Text(note.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Spacer()
                        }
                        .padding(12)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 13))
                        .overlay(
                            RoundedRectangle(cornerRadius: 13)
                                .stroke(picked ? Theme.cardLine : Theme.border, lineWidth: picked ? 1.5 : 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Working Stage

    private func workingStage(title: String, subtitle: String) -> some View {
        VStack(spacing: 18) {
            Spacer()
            FosforMascotView(size: 68, mood: .marking)
            VStack(spacing: 6) {
                Text(title)
                    .font(Theme.display(.title3))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
            }
            ProgressView()
                .tint(Theme.accent)
                .padding(.top, 4)
            Spacer()
        }
        .padding(20)
    }

    // MARK: - Running Exam Screen

    private var runningScreen: some View {
        let q = questions[currentIndex]
        let answeredCount = answers.filter(\.isAnswered).count

        return TimelineView(.periodic(from: .now, by: 1)) { timeline in
            VStack(spacing: 0) {
                // Top timer + navigator strip
                VStack(spacing: 10) {
                    HStack {
                        Text("Soru \(currentIndex + 1) / \(questions.count)")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Text("Cevaplanan: \(answeredCount)/\(questions.count)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)

                        if let endsAt {
                            let left = max(0, Int(ceil(endsAt.timeIntervalSince(timeline.date))))
                            HStack(spacing: 4) {
                                Image(systemName: "clock.fill")
                                Text(String(format: "%02d:%02d", left / 60, left % 60))
                                    .monospacedDigit()
                            }
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(left <= 60 ? .white : Theme.onHi)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(left <= 60 ? Theme.danger : Theme.hi, in: Capsule())
                            .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                        }
                    }

                    // Question jump strip
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(questions.indices, id: \.self) { idx in
                                let isCurrent = idx == currentIndex
                                let isDone = idx < answers.count && answers[idx].isAnswered
                                Button {
                                    OnboardingHaptics.selection()
                                    withAnimation(.spring(response: 0.34, dampingFraction: 0.82)) {
                                        currentIndex = idx
                                    }
                                } label: {
                                    Text("\(idx + 1)")
                                        .font(.caption.weight(.bold).monospacedDigit())
                                        .foregroundStyle(isCurrent ? Theme.onHi : Theme.text)
                                        .frame(width: 32, height: 30)
                                        .background(
                                            isCurrent ? Theme.hi : (isDone ? Theme.hiSoft : Theme.surface),
                                            in: RoundedRectangle(cornerRadius: 9)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 9)
                                                .stroke(isCurrent || isDone ? Theme.cardLine : Theme.border, lineWidth: isCurrent ? 1.8 : 1)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        questionCard(q, index: currentIndex)
                            .id(q.id)
                            .transition(.opacity.combined(with: .offset(y: 6)))
                    }
                    .padding(16)
                }
                .scrollDismissesKeyboard(.interactively)

                // Bottom Prev / Next / Finish bar
                HStack(spacing: 12) {
                    Button {
                        OnboardingHaptics.light()
                        withAnimation(.spring(response: 0.36, dampingFraction: 0.82)) {
                            currentIndex = max(0, currentIndex - 1)
                        }
                    } label: {
                        Image(systemName: "arrow.left")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(width: 68)
                    .disabled(currentIndex == 0)

                    if currentIndex < questions.count - 1 {
                        Button {
                            OnboardingHaptics.light()
                            withAnimation(.spring(response: 0.36, dampingFraction: 0.82)) {
                                currentIndex += 1
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text("Sonraki soru")
                                Image(systemName: "arrow.right")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    } else {
                        Button {
                            let unanswered = answers.filter { !$0.isAnswered }.count
                            if unanswered > 0 {
                                confirmEarlySubmit = true
                            } else {
                                submitExam()
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "flag.checkered")
                                Text("Sınavı bitir ve puanla")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Theme.bg.opacity(0.96))
            }
            .onChange(of: timeline.date) { _, now in
                if let endsAt, now >= endsAt, phase == .running {
                    submitExam()
                }
            }
        }
    }

    @ViewBuilder
    private func questionCard(_ q: MockExamQuestion, index: Int) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(q.type.badge)
                    .font(.caption2.weight(.heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Theme.hi, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                Spacer()
                if let noteTitle = q.noteTitle {
                    Text(noteTitle)
                        .font(.caption2)
                        .foregroundStyle(Theme.text3)
                        .lineLimit(1)
                }
            }

            switch q.type {
            case .mcq:
                MathText(q.prompt)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 8) {
                    ForEach(Array(q.options.enumerated()), id: \.offset) { optIdx, optText in
                        let picked = answers[index] == .choice(optIdx)
                        Button {
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.78)) {
                                answers[index] = .choice(optIdx)
                            }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Text(Self.letters[optIdx % Self.letters.count])
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(picked ? Theme.onHi : Theme.text)
                                    .frame(width: 30, height: 30)
                                    .background(picked ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(picked ? Theme.cardLine : Color.clear, lineWidth: 1.5)
                                    )
                                MathText(optText)
                                    .font(.body)
                                    .foregroundStyle(Theme.text)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .padding(.top, 4)
                            }
                            .padding(11)
                            .background(picked ? Theme.hiSoft : Theme.surface, in: RoundedRectangle(cornerRadius: 13))
                            .overlay(
                                RoundedRectangle(cornerRadius: 13)
                                    .stroke(picked ? Theme.cardLine : Theme.border, lineWidth: picked ? 2 : 1)
                            )
                        }
                        .buttonStyle(TactileCardButtonStyle(scale: 0.985))
                    }
                }

            case .blank:
                let parts = q.blankParts
                let chosenWord: String? = {
                    if case let .choice(wIdx) = answers[index], q.options.indices.contains(wIdx) {
                        return q.options[wIdx]
                    }
                    return nil
                }()

                VStack(alignment: .leading, spacing: 14) {
                    (Text(parts.before).foregroundStyle(Theme.text)
                     + Text("  \(chosenWord ?? "_____")  ")
                        .fontWeight(.heavy)
                        .foregroundStyle(chosenWord == nil ? Theme.text3 : Theme.text)
                     + Text(parts.after).foregroundStyle(Theme.text))
                        .font(.title3.weight(.medium))
                        .fixedSize(horizontal: false, vertical: true)

                    if chosenWord != nil {
                        Button {
                            OnboardingHaptics.light()
                            answers[index] = .none
                        } label: {
                            Label("Boşluğu temizle", systemImage: "xmark.circle")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Theme.text2)
                        }
                        .buttonStyle(.plain)
                    }

                    Divider().overlay(Theme.border)

                    Text("Kelime havuzu (birini seç)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text2)

                    FlowWordBank(
                        words: q.options,
                        selectedIndex: {
                            if case let .choice(i) = answers[index] { return i }
                            return nil
                        }(),
                        usedElsewhereIndices: usedWordBankIndices(excludingQuestion: index)
                    ) { wIdx in
                        OnboardingHaptics.selection()
                        withAnimation(.spring(response: 0.30, dampingFraction: 0.76)) {
                            answers[index] = .choice(wIdx)
                        }
                    }
                }

            case .open:
                MathText(q.prompt)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                let binding = Binding<String>(
                    get: {
                        if case let .text(s) = answers[index] { return s }
                        return ""
                    },
                    set: { answers[index] = $0.isEmpty ? .none : .text($0) }
                )

                ZStack(alignment: .topLeading) {
                    if binding.wrappedValue.isEmpty {
                        Text("Cevabını sınav kağıdına yazar gibi kendi cümlelerinle yaz…")
                            .foregroundStyle(Theme.text3)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 14)
                    }
                    TextEditor(text: binding)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 150)
                }
                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }

    private func usedWordBankIndices(excludingQuestion current: Int) -> Set<Int> {
        var set = Set<Int>()
        for (i, q) in questions.enumerated() where i != current && q.type == .blank {
            if i < answers.count, case let .choice(chosen) = answers[i] {
                set.insert(chosen)
            }
        }
        return set
    }

    // MARK: - Result Screen

    private var resultScreen: some View {
        let eval = evaluation ?? MockExamEvaluation(scores: [], feedback: [], total: 0)
        let total = max(1, questions.count)
        let pct = Int(((eval.total / Double(total)) * 100.0).rounded())
        let mistakeItems = buildMistakeCards(eval: eval)

        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Sınav provası sonucu")
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(Theme.text2)

                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("%\(pct)")
                                    .font(Theme.display(.largeTitle))
                                    .foregroundStyle(pct >= 85 ? Theme.onHi : Theme.text)
                                    .padding(.horizontal, pct >= 85 ? 8 : 0)
                                    .background(pct >= 85 ? Theme.hi : .clear, in: RoundedRectangle(cornerRadius: 8))

                                Text("(\(eval.total.formatted(.number.precision(.fractionLength(0...1)).locale(Dates.turkish))) / \(total) puan)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.text2)
                            }

                            if let durationTaken {
                                Text("Süre: \(max(1, durationTaken / 60)) dk \(durationTaken % 60) sn")
                                    .font(.caption)
                                    .foregroundStyle(Theme.text3)
                            }
                        }
                        Spacer()
                        FosforMascotView(
                            size: 58,
                            mood: pct >= 80 ? .cheering : (pct >= 60 ? .proud : .curious)
                        )
                    }

                    FosforProgressBar(value: Double(pct), total: 100, height: 10)

                    if let resultError {
                        Message(text: resultError, kind: .error)
                    }

                    VStack(spacing: 10) {
                        if !mistakeItems.isEmpty {
                            // Targeted remediation drill: "Benzer N soru çöz"
                            VStack(alignment: .leading, spacing: 10) {
                                HStack(spacing: 6) {
                                    Image(systemName: "target")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Theme.onHi)
                                        .frame(width: 24, height: 24)
                                        .background(Theme.hi, in: RoundedRectangle(cornerRadius: 7))
                                    Text("Yanlışlarına benzer sorular çöz")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(Theme.text)
                                    Spacer()
                                    Text("\(mistakeItems.count) eksik")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Theme.danger)
                                }

                                HStack(spacing: 8) {
                                    ForEach(Self.similarOptions, id: \.self) { n in
                                        let picked = similarCount == n
                                        Button {
                                            OnboardingHaptics.selection()
                                            similarCount = n
                                        } label: {
                                            Text("\(n) soru")
                                                .font(.caption.weight(.bold))
                                                .foregroundStyle(picked ? Theme.onHi : Theme.text2)
                                                .frame(maxWidth: .infinity)
                                                .padding(.vertical, 7)
                                                .background(picked ? Theme.hi : Theme.bg, in: RoundedRectangle(cornerRadius: 9))
                                                .overlay(RoundedRectangle(cornerRadius: 9).stroke(picked ? Theme.cardLine : Theme.border, lineWidth: picked ? 1.4 : 1))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }

                                Button {
                                    startSimilarExam(eval: eval, count: similarCount)
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "sparkles")
                                        Text("Benzer \(similarCount) soru çöz")
                                    }
                                }
                                .buttonStyle(PrimaryButtonStyle())
                            }
                            .padding(12)
                            .background(Theme.hiSoft.opacity(0.45), in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardLine.opacity(0.45), lineWidth: 1.2))

                            Button {
                                OnboardingHaptics.success()
                                let added = store.cardsFromMockExam(courseId: course.id, mistakes: mistakeItems)
                                withAnimation(.spring(response: 0.36, dampingFraction: 0.78)) {
                                    convertedCount = added
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: convertedCount == nil ? "plus.rectangle.on.rectangle" : "checkmark.circle.fill")
                                    Text(convertedCount.map { "\($0) eksik karta çevrildi" } ?? "Eksiklerimi karta çevir (\(mistakeItems.count))")
                                }
                            }
                            .buttonStyle(SecondaryButtonStyle())
                            .disabled(convertedCount != nil)
                        }

                        HStack(spacing: 10) {
                            Button {
                                OnboardingHaptics.light()
                                withAnimation(.spring(response: 0.40, dampingFraction: 0.80)) {
                                    phase = .setup
                                }
                            } label: {
                                Label("Yeni sınav kur", systemImage: "slider.horizontal.3")
                            }
                            .buttonStyle(SecondaryButtonStyle())

                            Button("Kapat") { dismiss() }
                                .buttonStyle(SecondaryButtonStyle())
                        }
                    }
                    .padding(.top, 4)
                }
                .focusCard()

                SectionTitle("Soru soru inceleme")

                ForEach(Array(questions.enumerated()), id: \.element.id) { idx, q in
                    let sc = idx < eval.scores.count ? eval.scores[idx] : 0
                    let fb = idx < eval.feedback.count ? eval.feedback[idx] : ""
                    reviewRow(question: q, index: idx, score: sc, feedback: fb)
                        .staggeredAppear(idx)
                }
            }
            .padding(16)
            .padding(.bottom, 32)
        }
    }

    private func reviewRow(question q: MockExamQuestion, index: Int, score: Double, feedback: String) -> some View {
        let ans = index < answers.count ? answers[index] : .none
        let statusColor: Color = score >= 0.99 ? Theme.success : (score > 0 ? Theme.accent : Theme.danger)

        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Soru \(index + 1) · \(q.type.badge)")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.text2)
                Spacer()
                Text(score >= 0.99 ? "Tam puan" : (score > 0 ? "\(score.formatted(.number.precision(.fractionLength(1)).locale(Dates.turkish))) puan" : "0 puan"))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(statusColor)
            }

            MathText(q.prompt)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)

            switch q.type {
            case .mcq, .blank:
                if case let .choice(chosen) = ans, q.options.indices.contains(chosen), chosen != q.answerIndex {
                    Label {
                        MathText(q.options[chosen])
                    } icon: {
                        Image(systemName: "xmark")
                    }
                    .font(.subheadline)
                    .foregroundStyle(Theme.danger)
                }
                if q.options.indices.contains(q.answerIndex) {
                    Label {
                        MathText(q.options[q.answerIndex])
                    } icon: {
                        Image(systemName: "checkmark")
                    }
                    .font(.subheadline)
                    .foregroundStyle(Theme.success)
                }
                if !q.explanation.isEmpty {
                    MathText(q.explanation)
                        .font(.footnote)
                        .foregroundStyle(Theme.text2)
                }

            case .open:
                if case let .text(written) = ans, !written.isEmpty {
                    Text("Senin cevabın: \(written)")
                        .font(.footnote)
                        .foregroundStyle(Theme.text2)
                }
                if !feedback.isEmpty {
                    Text(feedback)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.text)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 10))
                }
                if !q.modelAnswer.isEmpty {
                    Text("Örnek cevap: \(q.modelAnswer)")
                        .font(.footnote)
                        .foregroundStyle(Theme.text2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Logic

    private func bootstrapSetup() {
        let initialExam = preselectedExam ?? upcomingExams.first
        targetExamId = initialExam?.id ?? ""
        plan = MockExamPlan.load(courseId: course.id, examId: targetExamId.isEmpty ? nil : targetExamId)
        applyNoteScope(forExam: initialExam)
    }

    private func selectTargetExam(_ examId: String) {
        targetExamId = examId
        plan = MockExamPlan.load(courseId: course.id, examId: examId)
        let ex = upcomingExams.first { $0.id == examId }
        applyNoteScope(forExam: ex)
    }

    private func applyNoteScope(forExam exam: CourseExam?) {
        if let exam, !exam.noteIds.isEmpty {
            let scoped = courseNotes.filter { exam.covers($0.id) }.map(\.id)
            selectedNoteIds = scoped.isEmpty ? Set(courseNotes.map(\.id)) : Set(scoped)
        } else {
            selectedNoteIds = Set(courseNotes.map(\.id))
        }
    }

    private func ensureAtLeastOneQuestion() {
        if plan.totalQuestions == 0 {
            plan.mcqCount = 5
        }
    }

    private func persistPlan() {
        MockExamPlan.save(plan, courseId: course.id, examId: targetExamId.isEmpty ? nil : targetExamId)
    }

    private func startExam() {
        error = nil
        resultError = nil
        isSimilarRound = false
        let notes = chosenNotes
        guard !notes.isEmpty else { return }

        OnboardingHaptics.medium()
        phase = .preparing
        UIApplication.shared.isIdleTimerDisabled = true

        Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false }
            do {
                let generated: [MockExamQuestion]
                if mode == .ai {
                    var loadedNotes: [(item: NoteItem, content: String)] = []
                    for n in notes {
                        let content = try await store.noteContent(n.id)
                        if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            loadedNotes.append((n, content))
                        }
                    }
                    guard !loadedNotes.isEmpty else {
                        phase = .setup
                        error = "Seçilen notların metni boş görünüyor."
                        return
                    }
                    generated = try await ExamMaker.generateAI(
                        courseName: course.name,
                        notes: loadedNotes,
                        plan: plan
                    )
                } else {
                    var pairs: [(note: NoteItem, questions: [Question])] = []
                    for n in notes {
                        let qs = try await store.questions(for: n)
                        if !qs.isEmpty { pairs.append((n, qs)) }
                    }
                    generated = ExamMaker.generateLocal(notesWithQuestions: pairs, count: effectiveQuestionCount)
                    guard !generated.isEmpty else {
                        phase = .setup
                        error = "Seçtiğin notlarda henüz hazır test sorusu yok. 'Yapay zekâyla yeni' modunu seçebilirsin."
                        return
                    }
                }

                questions = generated
                answers = Array(repeating: .none, count: generated.count)
                currentIndex = 0
                startedAt = .now
                endsAt = plan.minutes > 0 ? Date.now.addingTimeInterval(Double(plan.minutes * 60)) : nil
                evaluation = nil
                convertedCount = nil
                OnboardingHaptics.success()
                withAnimation(.spring(response: 0.44, dampingFraction: 0.82)) {
                    phase = .running
                }
            } catch is CancellationError {
                phase = .setup
            } catch {
                phase = .setup
                self.error = error.localizedDescription
            }
        }
    }

    /// Generates a laser-focused remediation mini-exam targeting ONLY the concepts the student missed.
    private func startSimilarExam(eval: MockExamEvaluation, count: Int) {
        resultError = nil
        let notes = chosenNotes.isEmpty ? courseNotes : chosenNotes
        guard !notes.isEmpty else { return }

        // Build rich context of every missed question + the student's wrong answer + the correct answer
        var mistakeLines: [String] = []
        var mistakeNum = 0
        for (idx, q) in questions.enumerated() {
            let sc = idx < eval.scores.count ? eval.scores[idx] : 0
            guard sc < 0.7 else { continue }
            mistakeNum += 1
            let ans = idx < answers.count ? answers[idx] : .none
            let studentAnswer: String = switch ans {
            case .none: "Boş bıraktı"
            case let .choice(c): q.options.indices.contains(c) ? q.options[c] : "Boş bıraktı"
            case let .text(t): t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Boş bıraktı" : String(t.prefix(240))
            }
            let correctAnswer: String = if q.type == .open {
                String(q.modelAnswer.prefix(260))
            } else if q.options.indices.contains(q.answerIndex) {
                q.options[q.answerIndex]
            } else {
                q.modelAnswer
            }
            let src = [q.noteTitle, q.source].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
            mistakeLines.append("""
            [Yanlış #\(mistakeNum)] Soru: \(q.prompt)
            Öğrencinin yanlış cevabı: \(studentAnswer)
            Doğru cevap: \(correctAnswer)\(src.isEmpty ? "" : "\nKaynak/Konu: \(src)")
            """)
            if mistakeNum >= 8 { break }
        }
        guard !mistakeLines.isEmpty else { return }

        let remediationDirective = """
        HEDEF ODAKLI TELAFİ SINAVI (YANLIŞLARDAN ÖĞRENME):
        Öğrenci az önceki sınav provasında yukarıda verilen soruları yanlış yaptı veya eksik cevapladı.
        1. YALNIZCA bu yanlış yapılan kavramlara, alt başlıklara ve öğrencinin düştüğü kavram yanılgılarına odaklan; başka alakasız konulardan soru sorma.
        2. Yukarıdaki soruları ASLA kelimesi kelimesine kopyalama — aynı bilgiyi FARKLI bir açıdan, yeni bir senaryo, karşılaştırma, ters köşe (hangisi yanlıştır / neden böyledir) veya uygulama sorusu olarak kurgula.
        3. Öğrencinin seçtiği yanlış çeldirici ile doğru kavram arasındaki ince farkı özellikle yokla ki aynı hatayı gerçek sınavda bir daha yapmasın.
        4. Her sorunun açıklamasında (explanation) sadece doğru şıkkı söylemekle kalma, öğrencinin sık karıştırdığı noktayı da 1 net cümleyle vurgula.
        5. Tüm \(count) soru birbirinden farklı ve yüksek öğretici kalitede olsun.
        """

        var remediationPlan = MockExamPlan()
        remediationPlan.mcqCount = count
        remediationPlan.openCount = 0
        remediationPlan.blankCount = 0
        remediationPlan.minutes = 0
        remediationPlan.difficulty = plan.difficulty
        remediationPlan.pastQuestions = mistakeLines.joined(separator: "\n\n")
        remediationPlan.info = remediationDirective

        OnboardingHaptics.medium()
        isSimilarRound = true
        phase = .preparing
        UIApplication.shared.isIdleTimerDisabled = true

        Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false }
            do {
                var loadedNotes: [(item: NoteItem, content: String)] = []
                for n in notes {
                    let content = try await store.noteContent(n.id)
                    if !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        loadedNotes.append((n, content))
                    }
                }
                guard !loadedNotes.isEmpty else {
                    phase = .result
                    resultError = "Notların metni yüklenemedi."
                    return
                }
                let generated = try await ExamMaker.generateAI(
                    courseName: course.name,
                    notes: loadedNotes,
                    plan: remediationPlan
                )
                questions = generated
                answers = Array(repeating: .none, count: generated.count)
                currentIndex = 0
                startedAt = .now
                endsAt = nil
                evaluation = nil
                convertedCount = nil
                mode = .ai
                OnboardingHaptics.success()
                withAnimation(.spring(response: 0.44, dampingFraction: 0.82)) {
                    phase = .running
                }
            } catch is CancellationError {
                phase = .result
            } catch {
                phase = .result
                resultError = error.localizedDescription
            }
        }
    }

    private func submitExam() {
        guard phase == .running else { return }
        OnboardingHaptics.medium()
        let elapsed = max(1, Int(Date.now.timeIntervalSince(startedAt).rounded()))
        durationTaken = elapsed
        endsAt = nil
        phase = .grading

        Task {
            do {
                let eval = try await ExamMaker.evaluate(questions: questions, answers: answers)
                evaluation = eval
                let actualFormat: String = {
                    if questions.allSatisfy({ $0.type == .mcq }) { return "test" }
                    if questions.allSatisfy({ $0.type == .open }) { return "classic" }
                    return "mixed"
                }()
                store.saveMockExamResult(
                    courseId: course.id,
                    format: actualFormat,
                    difficulty: plan.difficulty.rawValue,
                    source: mode == .ai ? "ai" : "local",
                    noteIds: chosenNotes.map { $0.id.uuidString.lowercased() },
                    questions: questions,
                    answers: answers,
                    scores: eval.scores,
                    feedback: eval.feedback,
                    totalScore: eval.total,
                    durationSeconds: elapsed
                )
                OnboardingHaptics.success()
                withAnimation(.spring(response: 0.46, dampingFraction: 0.80)) {
                    phase = .result
                }
            } catch {
                // Even if AI open grading fails due to connectivity, score MCQ/blank locally so the student never loses their exam!
                let fallbackScores = questions.enumerated().map { i, q -> Double in
                    guard q.type != .open else { return 0 }
                    if i < answers.count, case let .choice(c) = answers[i], c == q.answerIndex { return 1 }
                    return 0
                }
                let fallbackFeedback = questions.map { $0.type == .open ? "Bağlantı hatası nedeniyle yazılı cevap puanlanamadı; örnek cevapla karşılaştırabilirsin." : "" }
                let total = fallbackScores.reduce(0, +)
                evaluation = MockExamEvaluation(scores: fallbackScores, feedback: fallbackFeedback, total: total)
                phase = .result
            }
        }
    }

    private func buildMistakeCards(eval: MockExamEvaluation) -> [(noteId: UUID?, front: String, back: String, source: String?)] {
        var out: [(noteId: UUID?, front: String, back: String, source: String?)] = []
        for (idx, q) in questions.enumerated() {
            let sc = idx < eval.scores.count ? eval.scores[idx] : 0
            guard sc < 0.95 else { continue }
            let nId = q.noteId.flatMap(UUID.init(uuidString:))
            switch q.type {
            case .mcq:
                guard q.options.indices.contains(q.answerIndex) else { continue }
                let back = q.options[q.answerIndex] + (q.explanation.isEmpty ? "" : "\n\n\(q.explanation)")
                out.append((nId, q.prompt, back, q.source))
            case .blank:
                let back = q.modelAnswer + (q.explanation.isEmpty ? "" : "\n\n\(q.explanation)")
                out.append((nId, q.prompt, back, q.source))
            case .open:
                guard !q.modelAnswer.isEmpty else { continue }
                out.append((nId, q.prompt, q.modelAnswer, q.source))
            }
        }
        return out
    }
}

// MARK: - Wrapping Word Bank Chips

private struct FlowWordBank: View {
    let words: [String]
    let selectedIndex: Int?
    let usedElsewhereIndices: Set<Int>
    let onPick: (Int) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 105), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(Array(words.enumerated()), id: \.offset) { idx, word in
                let isSelected = selectedIndex == idx
                let usedElsewhere = usedElsewhereIndices.contains(idx)
                Button {
                    onPick(idx)
                } label: {
                    Text(word)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(isSelected ? Theme.onHi : Theme.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(isSelected ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(isSelected ? Theme.cardLine : Theme.border, lineWidth: isSelected ? 1.5 : 1)
                        )
                        .opacity(usedElsewhere && !isSelected ? 0.45 : 1.0)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
