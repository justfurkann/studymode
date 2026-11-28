import AVFoundation
import SwiftUI

/// Lightweight Turkish speech helper for "Sesli oku" on flashcards.
@MainActor
@Observable
private final class CardSpeaker: NSObject, AVSpeechSynthesizerDelegate {
    private let synth = AVSpeechSynthesizer()
    private(set) var isSpeaking = false

    override init() {
        super.init()
        synth.delegate = self
    }

    func toggle(_ text: String) {
        if synth.isSpeaking {
            stop()
            return
        }
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
        let u = AVSpeechUtterance(string: clean)
        u.voice = AVSpeechSynthesisVoice(language: "tr-TR")
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.96
        isSpeaking = true
        synth.speak(u)
    }

    func stop() {
        if synth.isSpeaking || synth.isPaused {
            synth.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }
}

private struct UndoSnapshot {
    let previousCard: Card
    let previousQueue: [UUID]
    let wasNew: Bool
    let wasMissedBefore: Bool
    let addedKnownFirstTry: Bool
}

/// One study round over a fixed queue of cards, like the site's ReviewSession and note card round.
/// `.grades` (Tekrar tab): Bilemedim / Zor / İyi / Kolay with when each brings the card back.
/// `.simple` (a note's Kartlar): Tekrar / Bildim (also supports left/right swipe!).
struct ReviewSession: View {
    /// `.daily`: the Tekrar tab's daily session (grades, card context, "Bugün tamam" and "Biraz daha").
    enum Mode { case grades, simple, daily }

    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let title: String
    let mode: Mode
    /// Called once when the queue is finished (the note's Kartlar step uses it).
    var onFinish: (() -> Void)?

    @State private var queue: [UUID]
    @State private var total: Int
    @State private var answered = 0
    @State private var knownFirstTry = 0
    @State private var missed: Set<UUID> = []
    @State private var revealed = false
    @State private var showHint = false
    @State private var finished = false
    @State private var startedAt = Date.now
    @State private var readinessBefore: (course: Course, value: Int)?
    @State private var startIds: [UUID]

    // Motion & gesture state
    @State private var dragOffset: CGSize = .zero
    @State private var flyAwayOffset: CGSize = .zero
    @State private var isTransitioningCard = false
    @State private var shuffleTrigger = 0
    @State private var easySparkTrigger = 0
    @State private var showReceipt = false
    @State private var lastUndo: UndoSnapshot?
    @State private var speaker = CardSpeaker()
    @State private var codingCard: Card?
    @State private var hintRefresh = 0

    init(title: String, cards: [Card], mode: Mode, onFinish: (() -> Void)? = nil) {
        self.title = title
        self.mode = mode
        self.onFinish = onFinish
        let ids = cards.map(\.id)
        _startIds = State(initialValue: ids)
        _queue = State(initialValue: ids)
        _total = State(initialValue: ids.count)
    }

    private var card: Card? { queue.first.flatMap { id in store.cards.first { $0.id == id } } }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                VStack(spacing: 16) {
                    if let card, !finished {
                        progress
                        if mode == .daily { context(for: card) }
                        deckStage(currentCard: card)
                        controls(for: card)
                    } else if mode == .daily {
                        dailyDone
                            .transition(.scale(scale: 0.94).combined(with: .opacity))
                    } else {
                        done
                            .transition(.scale(scale: 0.94).combined(with: .opacity))
                    }
                }
                .padding(16)

                HighlighterSparkBurst(trigger: easySparkTrigger)
                    .offset(y: 120)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        OnboardingHaptics.light()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .accessibilityLabel("Kapat")
                }
                if !finished, let activeCard = card {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            OnboardingHaptics.light()
                            codingCard = activeCard
                        } label: {
                            Image(systemName: "key.fill")
                        }
                        .accessibilityLabel("Bu kartı şifrele")
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            OnboardingHaptics.light()
                            speaker.toggle(revealed ? activeCard.back : activeCard.front)
                        } label: {
                            Image(systemName: speaker.isSpeaking ? "speaker.slash.fill" : "speaker.wave.2")
                        }
                        .accessibilityLabel(speaker.isSpeaking ? "Okumayı durdur" : "Sesli oku")
                    }
                }
                if lastUndo != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            undoLastAnswer()
                        } label: {
                            Image(systemName: "arrow.uturn.backward")
                        }
                        .accessibilityLabel("Son cevabı geri al")
                    }
                }
                if !finished && queue.count > 1 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            shuffleRemaining()
                        } label: {
                            Label("Karıştır", systemImage: "shuffle")
                        }
                        .accessibilityLabel("Kalan kartları karıştır")
                    }
                }
            }
            .overlay(alignment: .top) { SaveErrorBanner() }
        }
        .onAppear { captureReadiness() }
        .onChange(of: finished) { _, completed in
            if completed { StudySound.reviewComplete.play() }
        }
        .onDisappear { speaker.stop() }
        .onChange(of: revealed) { _, _ in speaker.stop() }
        .sheet(item: $codingCard) { target in
            CardCodingSheet(card: target) { _ in
                hintRefresh += 1
                showHint = true
            }
        }
    }

    // MARK: - 3D Stacked Deck Stage

    private func deckStage(currentCard: Card) -> some View {
        let upcomingCount = min(2, max(0, queue.count - 1))
        let activeX = dragOffset.width + flyAwayOffset.width
        let activeY = dragOffset.height * 0.25 + flyAwayOffset.height

        return ZStack {
            // Background depth cards that rise forward as queue advances
            ForEach((0..<upcomingCount).reversed(), id: \.self) { depthIndex in
                let level = CGFloat(depthIndex + 1)
                let liftProgress = min(1.0, abs(activeX) / 140.0)
                let effectiveLevel = max(0, level - liftProgress)

                RoundedRectangle(cornerRadius: 20)
                    .fill(Theme.surface)
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine.opacity(0.65), lineWidth: 1.5))
                    .scaleEffect(1.0 - effectiveLevel * 0.045)
                    .offset(y: effectiveLevel * 10)
                    .opacity(1.0 - Double(effectiveLevel) * 0.18)
            }

            // Active interactive 3D card
            let customHint = (hintRefresh >= 0) ? CardHintStore.hint(for: currentCard.id) : nil
            FlippableStudyCard(
                card: currentCard,
                revealed: revealed,
                hint: showHint ? (customHint ?? CardHint.make(currentCard.back)) : nil,
                swipeDelta: mode == .simple && revealed ? dragOffset.width : 0,
                onFlipTap: {
                    guard !revealed, !isTransitioningCard else { return }
                    OnboardingHaptics.medium()
                    withAnimation(.spring(response: 0.50, dampingFraction: 0.78)) {
                        revealed = true
                    }
                }
            )
            .id(currentCard.id)
            .offset(x: activeX, y: activeY)
            .rotationEffect(.degrees(Double(activeX) / 22.0))
            .keyframeAnimator(initialValue: ShuffleShake(), trigger: shuffleTrigger) { view, val in
                view
                    .offset(x: val.x)
                    .rotationEffect(.degrees(val.tilt))
                    .scaleEffect(val.scale)
            } keyframes: { _ in
                KeyframeTrack(\.x) {
                    SpringKeyframe(-18, duration: 0.09, spring: .bouncy)
                    SpringKeyframe(16, duration: 0.10, spring: .bouncy)
                    SpringKeyframe(0, duration: 0.22, spring: .bouncy)
                }
                KeyframeTrack(\.tilt) {
                    CubicKeyframe(-4, duration: 0.09)
                    CubicKeyframe(4, duration: 0.10)
                    SpringKeyframe(0, duration: 0.22, spring: .bouncy)
                }
                KeyframeTrack(\.scale) {
                    CubicKeyframe(0.96, duration: 0.09)
                    SpringKeyframe(1.0, duration: 0.30, spring: .bouncy)
                }
            }
            .gesture(
                DragGesture(minimumDistance: 14)
                    .onChanged { value in
                        guard !isTransitioningCard else { return }
                        if mode == .simple && revealed {
                            dragOffset = value.translation
                        } else {
                            // Subtle elastic feel even before reveal / in daily mode
                            dragOffset = CGSize(
                                width: value.translation.width * 0.28,
                                height: value.translation.height * 0.12
                            )
                        }
                    }
                    .onEnded { value in
                        guard !isTransitioningCard else { return }
                        if mode == .simple && revealed {
                            if value.translation.width > 95 {
                                commitAnswerWithFlyAway(currentCard, .good, direction: 1)
                                return
                            } else if value.translation.width < -95 {
                                commitAnswerWithFlyAway(currentCard, .again, direction: -1)
                                return
                            }
                        } else if !revealed && abs(value.translation.width) < 40 && value.translation.height < -45 {
                            OnboardingHaptics.medium()
                            withAnimation(.spring(response: 0.50, dampingFraction: 0.78)) {
                                revealed = true
                            }
                        }
                        withAnimation(.spring(response: 0.38, dampingFraction: 0.74)) {
                            dragOffset = .zero
                        }
                    }
            )
        }
        .padding(.bottom, 6)
    }

    private struct ShuffleShake {
        var x: CGFloat = 0
        var tilt: Double = 0
        var scale: CGFloat = 1
    }

    private func shuffleRemaining() {
        guard queue.count > 1, !isTransitioningCard else { return }
        OnboardingHaptics.medium()
        revealed = false
        showHint = false
        shuffleTrigger += 1
        var shuffled = queue.shuffled()
        if shuffled.first == queue.first, shuffled.count > 1 {
            shuffled.swapAt(0, 1)
        }
        withAnimation(.spring(response: 0.40, dampingFraction: 0.78)) {
            queue = shuffled
        }
    }

    /// The course of the session's first card, and its readiness now, to show the change at the end.
    private func captureReadiness() {
        guard mode == .daily, readinessBefore == nil,
              let first = queue.first.flatMap({ id in store.cards.first { $0.id == id } }),
              let course = store.courses.first(where: { $0.id == first.courseId }),
              let value = store.readiness(of: course) else { return }
        readinessBefore = (course, value)
    }

    /// Which course the card is from, its exam, and whether it was missed before.
    private func context(for card: Card) -> some View {
        let course = store.courses.first { $0.id == card.courseId }
        let exam = course.flatMap { store.nextExam($0) }.flatMap { Exams.countdown($0, store.audience) }
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                if let course {
                    HStack(spacing: 5) {
                        Circle().fill(course.tint).frame(width: 7, height: 7)
                        Text(exam.map { "\(course.name) · \($0.text)" } ?? course.name)
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Theme.surface, in: Capsule())
                    .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                }
                if card.failedBefore {
                    Label("Geçen sefer bilemedin", systemImage: "arrow.counterclockwise")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.danger)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Theme.dangerSoft, in: Capsule())
                } else if card.isNew {
                    Label("Yeni kart", systemImage: "sparkle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.onHi)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Theme.hi, in: Capsule())
                        .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                }
            }
        }
    }

    /// "Bugün tamam": what was done, what changed, and an optional "Biraz daha".
    private var dailyDone: some View {
        let minutes = max(1, Int((Date.now.timeIntervalSince(startedAt) / 60).rounded()))
        let after = readinessBefore.flatMap { store.readiness(of: $0.course) }
        let more = store.hasMore()
        return VStack(spacing: 18) {
            Spacer()
            CelebrationBadgeView()

            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Text("Bugün")
                        .font(Theme.display(.title))
                        .foregroundStyle(Theme.text)
                    Highlighted(text: "tamam", font: Theme.display(.title))
                }
                Text(total == 0
                     ? "Şu an tekrar edilecek kart yok."
                     : "\(total) kart · \(minutes) dk · İlk denemede bilinen: \(knownFirstTry)")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: 10) {
                if let before = readinessBefore, let after {
                    HStack {
                        HStack(spacing: 6) {
                            Circle().fill(before.course.tint).frame(width: 8, height: 8)
                            Text("\(before.course.name) hazırlık").lineLimit(1)
                        }
                        Spacer()
                        Text(after == before.value ? "Hazırlık: %\(after)" : "%\(before.value) → %\(after)")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(after > before.value ? Theme.onHi : Theme.text)
                            .padding(.horizontal, after > before.value ? 8 : 0)
                            .padding(.vertical, after > before.value ? 3 : 0)
                            .background(after > before.value ? Theme.hi : .clear, in: Capsule())
                    }
                }
                if store.streak > 0 {
                    HStack {
                        Label("Çalışma serisi", systemImage: "flame.fill")
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Text("\(store.streak) gün")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(Theme.onHi)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 3)
                            .background(Theme.hi, in: Capsule())
                            .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                    }
                }
            }
            .font(.subheadline)
            .foregroundStyle(Theme.text)
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.cardLine, lineWidth: 1.5))

            Text("Yarın yaklaşık \(store.tomorrowEstimate) kart seni bekliyor.")
                .font(.footnote)
                .foregroundStyle(Theme.text3)

            Spacer()

            VStack(spacing: 10) {
                Button("Bitir") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                Button {
                    OnboardingHaptics.medium()
                    showReceipt = true
                } label: {
                    Label("Çalışma fişini kes", systemImage: "receipt")
                }
                .buttonStyle(SecondaryButtonStyle())
                if more {
                    Button("Biraz daha (+\(ReviewRules.moreSize))") { more10() }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
            .sheet(isPresented: $showReceipt) {
                ReceiptStudioSheet()
                    .environment(store)
                    .environment(auth)
            }
        }
        .frame(maxWidth: .infinity)
    }

    /// Ten more under the same rules; cards just answered are no longer due, so they don't repeat.
    private func more10() {
        let next = store.reviewQueue(size: ReviewRules.moreSize, newAllowed: store.newLeftToday).map(\.id)
        guard !next.isEmpty else { return }
        OnboardingHaptics.medium()
        startIds = next
        queue = next
        total = next.count
        answered = 0
        knownFirstTry = 0
        missed = []
        startedAt = .now
        readinessBefore = nil
        withAnimation(.spring(response: 0.44, dampingFraction: 0.80)) { finished = false }
        captureReadiness()
    }

    private var progress: some View {
        let completed = Double(max(0, total - queue.count))
        return VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text("\(answered) / \(total)")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(Theme.text)
                    .contentTransition(.numericText(value: Double(answered)))
                Spacer()
                Text("Kalan: \(queue.count) kart")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.text3)
                    .contentTransition(.numericText(value: Double(queue.count)))
            }
            FosforProgressBar(value: completed, total: Double(max(total, 1)), height: 10)
        }
    }

    @ViewBuilder
    private func controls(for card: Card) -> some View {
        if !revealed {
            VStack(spacing: 10) {
                Button {
                    OnboardingHaptics.medium()
                    withAnimation(.spring(response: 0.50, dampingFraction: 0.78)) { revealed = true }
                } label: {
                    HStack(spacing: 6) {
                        Text("Cevabı göster")
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())

                if !showHint, !CardHint.make(card.back).isEmpty {
                    Button {
                        OnboardingHaptics.light()
                        withAnimation(.spring(response: 0.36, dampingFraction: 0.80)) { showHint = true }
                    } label: {
                        Label("İpucu göster", systemImage: "lightbulb.fill")
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            }
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        } else {
            switch mode {
            case .simple:
                VStack(spacing: 8) {
                    Text("Sağa kaydır: Bildim · Sola kaydır: Tekrar")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Theme.text3)
                    HStack(spacing: 10) {
                        Button {
                            commitAnswerWithFlyAway(card, .again, direction: -1)
                        } label: {
                            Label("Tekrar", systemImage: "arrow.counterclockwise")
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        Button {
                            commitAnswerWithFlyAway(card, .good, direction: 1)
                        } label: {
                            Label("Bildim", systemImage: "checkmark")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))

            case .grades, .daily:
                HStack(spacing: 8) {
                    ForEach(Grade.allCases, id: \.self) { grade in
                        Button {
                            let dir: CGFloat = grade == .again ? -1 : 1
                            commitAnswerWithFlyAway(card, grade, direction: dir)
                        } label: {
                            VStack(spacing: 3) {
                                Text(grade.label)
                                    .font(.subheadline.weight(.bold))
                                Text(SRS.intervalLabel(store.preview(card, grade)))
                                    .font(.caption2.monospacedDigit())
                                    .opacity(0.78)
                            }
                        }
                        .buttonStyle(GradeButtonStyle(grade: grade))
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
    }

    private var done: some View {
        VStack(spacing: 18) {
            Spacer()
            CelebrationBadgeView()

            VStack(spacing: 6) {
                HStack(spacing: 6) {
                    Text("Tur")
                        .font(Theme.display(.title))
                        .foregroundStyle(Theme.text)
                    Highlighted(text: "bitti!", font: Theme.display(.title))
                }
                Text(summaryLine)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
            }
            Spacer()
            VStack(spacing: 10) {
                Button("Bitir") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
                if mode == .simple, !startIds.isEmpty {
                    Button("Baştan çalış") { restart() }
                        .buttonStyle(SecondaryButtonStyle())
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var summaryLine: String {
        if total == 0 { return "Şu an çalışılacak kart yok." }
        if mode == .simple { return "\(total) kart tamamlandı · İlk denemede bilinen: \(knownFirstTry)" }
        return "\(total) kartı tekrar ettin. Sıradaki tekrarları zamanı gelince burada bulacaksın."
    }

    private func commitAnswerWithFlyAway(_ card: Card, _ grade: Grade, direction: CGFloat) {
        guard !isTransitioningCard else { return }
        switch grade {
        case .again: OnboardingHaptics.light()
        case .hard: OnboardingHaptics.selection()
        case .good: OnboardingHaptics.medium()
        case .easy:
            OnboardingHaptics.success()
            easySparkTrigger += 1
        }

        if reduceMotion {
            dragOffset = .zero
            flyAwayOffset = .zero
            applyAnswer(card, grade)
            return
        }

        isTransitioningCard = true
        withAnimation(.easeIn(duration: 0.18)) {
            flyAwayOffset = CGSize(width: direction * 380, height: direction > 0 ? -28 : 24)
        }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(175))
            dragOffset = .zero
            flyAwayOffset = .zero
            applyAnswer(card, grade)
            isTransitioningCard = false
        }
    }

    private func applyAnswer(_ card: Card, _ grade: Grade) {
        speaker.stop()
        let wasMissedBefore = missed.contains(card.id)
        let addedKnown = grade != .again && !wasMissedBefore
        lastUndo = UndoSnapshot(
            previousCard: card,
            previousQueue: queue,
            wasNew: card.isNew,
            wasMissedBefore: wasMissedBefore,
            addedKnownFirstTry: addedKnown
        )
        store.review(card, grade)
        answered += 1
        if grade == .again {
            missed.insert(card.id)
        } else if !wasMissedBefore {
            knownFirstTry += 1
        }
        revealed = false
        showHint = false
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
            var next = Array(queue.dropFirst())
            if grade == .again { next.append(card.id) }
            queue = next
            if next.isEmpty {
                finished = true
                onFinish?()
            }
        }
    }

    private func undoLastAnswer() {
        guard let snap = lastUndo, !isTransitioningCard else { return }
        speaker.stop()
        OnboardingHaptics.medium()
        lastUndo = nil
        store.undoReview(snap.previousCard, wasNew: snap.wasNew)
        answered = max(0, answered - 1)
        if snap.addedKnownFirstTry { knownFirstTry = max(0, knownFirstTry - 1) }
        if !snap.wasMissedBefore { missed.remove(snap.previousCard.id) }
        revealed = false
        showHint = false
        withAnimation(.spring(response: 0.40, dampingFraction: 0.82)) {
            finished = false
            queue = snap.previousQueue
        }
    }

    private func restart() {
        OnboardingHaptics.medium()
        queue = startIds
        total = startIds.count
        answered = 0
        knownFirstTry = 0
        missed = []
        withAnimation(.spring(response: 0.42, dampingFraction: 0.80)) {
            finished = false
        }
    }
}

// MARK: - True 3D Flippable Study Card

private struct FlippableStudyCard: View {
    let card: Card
    let revealed: Bool
    let hint: String?
    let swipeDelta: CGFloat
    let onFlipTap: () -> Void

    var body: some View {
        let angle: Double = revealed ? 180 : 0
        ZStack {
            // Front Face (Question)
            frontFace
                .opacity(revealed ? 0 : 1)

            // Back Face (Question recap + Answer, pre-rotated 180° for crisp readability)
            backFace
                .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                .opacity(revealed ? 1 : 0)
        }
        .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
        .overlay(alignment: .topLeading) {
            if swipeDelta > 30 {
                swipeStamp(text: "BİLDİM", isPositive: true)
                    .opacity(min(1, Double(swipeDelta - 20) / 65.0))
                    .padding(18)
            }
        }
        .overlay(alignment: .topTrailing) {
            if swipeDelta < -30 {
                swipeStamp(text: "TEKRAR", isPositive: false)
                    .opacity(min(1, Double(-swipeDelta - 20) / 65.0))
                    .padding(18)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onFlipTap)
    }

    private var frontFace: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("SORU")
                    .font(.caption2.weight(.heavy))
                    .tracking(0.8)
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Theme.hi, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                Spacer()
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Theme.text3)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    MathText(card.front)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)

                    if let hint {
                        Label(hint, systemImage: "lightbulb.fill")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.cardLine.opacity(0.4), lineWidth: 1))
                            .transition(.scale(scale: 0.94).combined(with: .opacity))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)
            }
            .scrollBounceBehavior(.basedOnSize)

            HStack(spacing: 6) {
                Image(systemName: "hand.tap.fill")
                    .font(.caption2)
                Text("Kartı çevirmek için dokun")
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(Theme.text3)
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .focusCard()
    }

    private var backFace: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("CEVAP")
                    .font(.caption2.weight(.heavy))
                    .tracking(0.8)
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(Theme.hi, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                Spacer()
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    MathText(card.front)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)

                    Divider().overlay(Theme.border)

                    MathText(card.back)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)

                    if let source = card.source, !source.isEmpty {
                        Text("“\(source)”")
                            .font(.footnote.italic())
                            .foregroundStyle(Theme.text3)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 10))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(20)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2.5))
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 5))
    }

    private func swipeStamp(text: String, isPositive: Bool) -> some View {
        Text(text)
            .font(Theme.display(.subheadline))
            .foregroundStyle(isPositive ? Theme.onHi : .white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isPositive ? Theme.hi : Theme.danger, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.cardLine, lineWidth: 2))
            .rotationEffect(.degrees(isPositive ? -10 : 10))
    }
}

// MARK: - Tactile Grade Button Style

private struct GradeButtonStyle: ButtonStyle {
    let grade: Grade

    func makeBody(configuration: Configuration) -> some View {
        let primary = grade == .good
        let pressed = configuration.isPressed
        configuration.label
            .foregroundStyle(primary ? Theme.onHi : (grade == .again ? Theme.danger : Theme.text))
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(
                primary ? Theme.hi : (grade == .again ? Theme.dangerSoft.opacity(0.6) : Theme.surface),
                in: RoundedRectangle(cornerRadius: 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(primary ? Theme.cardLine : Theme.border, lineWidth: primary ? 2 : 1.5)
            )
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(primary ? Theme.cardDrop : .clear)
                    .offset(y: pressed ? 1 : 3)
            )
            .offset(y: pressed ? 2 : 0)
            .scaleEffect(pressed ? 0.97 : 1.0)
            .animation(.easeOut(duration: 0.08), value: pressed)
    }
}

/// The site's cardHint: a short answer shows its first letter and length ("M_________"),
/// a longer one its first few words.
enum CardHint {
    static func make(_ back: String) -> String {
        let text = TeX.plain(back).trimmingCharacters(in: .whitespacesAndNewlines)
        let firstSentence = text.components(separatedBy: "\n").first.map { line -> String in
            if let r = line.range(of: #"(?<=[.!?])\s"#, options: .regularExpression) { return String(line[..<r.lowerBound]) }
            return line
        }?.trimmingCharacters(in: .whitespaces) ?? ""
        let words = firstSentence.split(whereSeparator: \.isWhitespace).map(String.init)
        guard let first = words.first else { return "" }
        if words.count <= 2 {
            let word = first.trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?"))
            guard word.count > 1 else { return word }
            return String(word.prefix(1)) + String(repeating: "_", count: word.count - 1) + (words.count > 1 ? " …" : "")
        }
        let shown = min(4, max(1, words.count / 3))
        return words.prefix(shown).joined(separator: " ") + " …"
    }
}

/// A failed save, shown on top of whatever is open.
struct SaveErrorBanner: View {
    @Environment(StudyStore.self) private var store

    var body: some View {
        if let error = store.saveError {
            Message(text: error, kind: .error)
                .padding(.horizontal, 16)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture { store.saveError = nil }
                .task {
                    try? await Task.sleep(for: .seconds(5))
                    store.saveError = nil
                }
        }
    }
}
