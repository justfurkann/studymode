import SwiftUI

// MARK: - Scene 1: Live Note Scanner & Interactive Highlighter

/// Shows a real lecture note being scanned while Fosfor sweeps highlighter ink across exam-critical lines.
/// Users can also tap any line on the sheet to toggle highlighter ink themselves.
struct ScannerHighlightScene: View {
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scanProgress: CGFloat = 0
    @State private var showScanBeam = false
    @State private var markedRows: Set<Int> = []
    @State private var extractedReady = false
    @State private var userInteracted = false
    @State private var floatChips = false
    @State private var activeSource = 0
    @State private var fosforRow: Int? = nil

    private struct NoteLine: Identifiable {
        let id: Int
        let text: String
        let autoMark: Bool
        let tag: String?
    }

    private let sources: [(icon: String, label: String)] = [
        ("camera.fill", "Fotoğraf"),
        ("doc.richtext.fill", "PDF"),
        ("rectangle.stack.badge.play", "Slayt")
    ]

    private let lines: [NoteLine] = [
        .init(id: 0, text: "Mitokondri çift zarlı bir organeldir.", autoMark: false, tag: nil),
        .init(id: 1, text: "ATP sentezi iç zarda gerçekleşir.", autoMark: true, tag: "Önemli"),
        .init(id: 2, text: "Dış zar küçük moleküllere açıktır.", autoMark: false, tag: nil),
        .init(id: 3, text: "Krebs döngüsü matrikste başlar.", autoMark: true, tag: "ΔG < 0"),
        .init(id: 4, text: "En çok ATP oksidatif evrede üretilir.", autoMark: true, tag: nil)
    ]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 12) {
                // Floating input format chips cleanly above the note sheet
                HStack(spacing: 8) {
                    ForEach(Array(sources.enumerated()), id: \.offset) { idx, src in
                        let selected = activeSource == idx
                        HStack(spacing: 5) {
                            Image(systemName: src.icon)
                                .font(.caption2.weight(.bold))
                            Text(src.label)
                                .font(.caption2.weight(.bold))
                        }
                        .foregroundStyle(selected ? Theme.onHi : Theme.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(selected ? Theme.hi : Theme.surface, in: Capsule())
                        .overlay(Capsule().stroke(selected ? Theme.cardLine : Theme.border, lineWidth: selected ? 1.5 : 1))
                        .background(
                            Capsule()
                                .fill(selected ? Theme.cardDrop : Color.clear)
                                .offset(y: selected ? 2 : 0)
                        )
                        .offset(y: reduceMotion ? 0 : (floatChips && idx == 1 ? -2 : 1))
                    }
                }

                // Main tactile lecture sheet
                VStack(alignment: .leading, spacing: 9) {
                    // Sheet header
                    HStack(spacing: 8) {
                        Image(systemName: "doc.text.fill")
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.onHi)
                            .frame(width: 28, height: 28)
                            .background(Theme.hi, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.cardLine, lineWidth: 1.5))

                        VStack(alignment: .leading, spacing: 1) {
                            Text("Hücre Enerjisi · 3. Hafta.pdf")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Text("Biyoloji · Ders notu")
                                .font(.caption2)
                                .foregroundStyle(Theme.text3)
                        }

                        Spacer(minLength: 4)

                        HStack(spacing: 4) {
                            Image(systemName: extractedReady ? "checkmark.circle.fill" : "waveform.path.ecg")
                                .contentTransition(.symbolEffect(.replace))
                            Text(extractedReady ? "Hazır" : "Okunuyor")
                        }
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(extractedReady ? Theme.onHi : Theme.text2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(extractedReady ? Theme.hi : Theme.surface2, in: Capsule())
                        .overlay(Capsule().stroke(extractedReady ? Theme.cardLine : Theme.border, lineWidth: 1))
                    }
                    .padding(.bottom, 1)

                    Rectangle()
                        .fill(Theme.border)
                        .frame(height: 1)

                    // Interactive note lines with true pixel-masked highlighter ink wipe
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(lines) { line in
                            let isMarked = markedRows.contains(line.id)
                            Button {
                                userInteracted = true
                                OnboardingHaptics.light()
                                withAnimation(.spring(response: 0.38, dampingFraction: 0.80)) {
                                    if isMarked {
                                        markedRows.remove(line.id)
                                    } else {
                                        markedRows.insert(line.id)
                                        fosforRow = line.id
                                    }
                                }
                            } label: {
                                HStack(spacing: 6) {
                                    HighlighterWipeText(text: line.text, isMarked: isMarked)

                                    Spacer(minLength: 0)

                                    if let tag = line.tag, isMarked {
                                        Text(tag)
                                            .font(.system(size: 9, weight: .bold, design: .rounded))
                                            .foregroundStyle(Theme.text)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Theme.surface2, in: Capsule())
                                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                                            .transition(.scale(scale: 0.75).combined(with: .opacity))
                                    }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    // Micro interactive hint
                    HStack(spacing: 5) {
                        Image(systemName: "hand.tap.fill")
                            .font(.caption2)
                        Text("Satırlara dokun, fosforlu kalemi dene")
                            .font(.caption2.weight(.medium))
                    }
                    .foregroundStyle(Theme.text3)
                    .padding(.top, 2)
                }
                .padding(15)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
                .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 5))
                .overlay {
                    // Animated scan beam sweeping top-to-bottom
                    GeometryReader { geo in
                        if showScanBeam {
                            VStack(spacing: 0) {
                                LinearGradient(
                                    colors: [Theme.hi.opacity(0), Theme.hi.opacity(0.32)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                )
                                .frame(height: 26)
                                Rectangle()
                                    .fill(Theme.accent)
                                    .frame(height: 2)
                            }
                            .offset(y: -20 + scanProgress * (geo.size.height + 16))
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .allowsHitTesting(false)
                }
                .rotationEffect(.degrees(-1.2))
                .padding(.horizontal, 12)
            }

            // Fosfor mascot perched at bottom-right corner reacting to highlights
            FosforMascotView(framed: false, 
                size: 50,
                mood: extractedReady ? .proud : .marking
            )
            .rotationEffect(.degrees(fosforRow != nil ? -8 : 4))
            .offset(x: -2, y: 10)
            .animation(.spring(response: 0.4, dampingFraction: 0.7), value: fosforRow)
        }
        .frame(maxWidth: 344, maxHeight: 280)
        .onAppear {
            if !reduceMotion {
                withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                    floatChips = true
                }
            }
        }
        .task(id: isActive) {
            guard isActive else { return }
            if reduceMotion {
                markedRows = [1, 3, 4]
                extractedReady = true
                return
            }
            userInteracted = false
            while !Task.isCancelled && !userInteracted {
                // Reset cycle cleanly
                withAnimation(.easeOut(duration: 0.25)) {
                    markedRows = []
                    extractedReady = false
                    fosforRow = nil
                }
                scanProgress = 0
                showScanBeam = true
                withAnimation(.easeInOut(duration: 1.05)) {
                    scanProgress = 1
                }
                try? await Task.sleep(for: .milliseconds(420))
                guard !Task.isCancelled && !userInteracted else { break }

                withAnimation(.spring(response: 0.42, dampingFraction: 0.8)) {
                    markedRows.insert(1)
                    fosforRow = 1
                }
                try? await Task.sleep(for: .milliseconds(420))
                guard !Task.isCancelled && !userInteracted else { break }

                withAnimation(.spring(response: 0.42, dampingFraction: 0.8)) {
                    markedRows.insert(3)
                    fosforRow = 3
                }
                showScanBeam = false
                try? await Task.sleep(for: .milliseconds(420))
                guard !Task.isCancelled && !userInteracted else { break }

                withAnimation(.spring(response: 0.42, dampingFraction: 0.8)) {
                    markedRows.insert(4)
                    extractedReady = true
                    fosforRow = nil
                }
                try? await Task.sleep(for: .milliseconds(2700))
                withAnimation(.spring(response: 0.38, dampingFraction: 0.8)) {
                    activeSource = (activeSource + 1) % sources.count
                }
            }
        }
    }
}

/// Renders a single line of text where a yellow highlighter bar wipes left-to-right and turns covered glyphs ink-dark
/// without changing glyph metrics or causing text crossfade artifacts.
private struct HighlighterWipeText: View {
    let text: String
    let isMarked: Bool

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(Theme.text2)
            .lineLimit(1)
            .padding(.horizontal, 6)
            .padding(.vertical, 3.5)
            .overlay(alignment: .leading) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Theme.hi)
                        Text(text)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.onHi)
                            .lineLimit(1)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3.5)
                            .fixedSize()
                    }
                    .frame(width: isMarked ? geo.size.width : 0, alignment: .leading)
                    .clipped()
                    .animation(.spring(response: 0.44, dampingFraction: 0.84), value: isMarked)
                }
            }
    }
}

// MARK: - Scene 2: 3D Interactive Study Deck (Summary + 3D Flashcard Flip + Live Quiz)

/// Orchestrates 3 real study cards in a 3D spring fan. Auto-plays through Özet → 3D Kart Flip → Test,
/// and lets the user tap tabs, flip the flashcard in 3D, or answer the mini quiz live.
struct StudyDeckOrchestraScene: View {
    let isActive: Bool

    enum DeckTab: Int, CaseIterable, Identifiable {
        case summary = 0
        case flashcard = 1
        case quiz = 2

        var id: Int { rawValue }

        var title: String {
            switch self {
            case .summary: "Özet"
            case .flashcard: "Kart"
            case .quiz: "Test"
            }
        }

        var icon: String {
            switch self {
            case .summary: "text.alignleft"
            case .flashcard: "rectangle.on.rectangle.angled"
            case .quiz: "checklist"
            }
        }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedTab: DeckTab = .flashcard
    @State private var isCardFlipped = false
    @State private var pickedOption: Int? = nil
    @State private var userTookControl = false
    @State private var quizBurst = 0

    var body: some View {
        VStack(spacing: 12) {
            // Interactive mode switcher pills
            HStack(spacing: 6) {
                ForEach(DeckTab.allCases) { tab in
                    let active = selectedTab == tab
                    Button {
                        userTookControl = true
                        OnboardingHaptics.selection()
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                            selectedTab = tab
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: tab.icon)
                                .font(.caption2.weight(.bold))
                            Text(tab.title)
                                .font(.caption.weight(.bold))
                        }
                        .foregroundStyle(active ? Theme.onHi : Theme.text2)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(active ? Theme.hi : Theme.surface, in: Capsule())
                        .overlay(Capsule().stroke(active ? Theme.cardLine : Theme.border, lineWidth: active ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            // 3-card 3D fanned stage
            ZStack {
                ForEach(DeckTab.allCases) { tab in
                    let rel = relativeSlot(for: tab)
                    deckCardContent(for: tab, isFront: rel == 0)
                        .frame(maxWidth: 306)
                        .frame(height: 198)
                        .scaleEffect(rel == 0 ? 1.0 : 0.90)
                        .rotationEffect(.degrees(rel == 0 ? 0 : (rel < 0 ? -5.5 : 5.5)))
                        .offset(
                            x: rel == 0 ? 0 : (rel < 0 ? -20 : 20),
                            y: rel == 0 ? 0 : 12
                        )
                        .opacity(rel == 0 ? 1.0 : 0.58)
                        .zIndex(rel == 0 ? 3 : (rel < 0 ? 1 : 2))
                        .contentShape(RoundedRectangle(cornerRadius: 20))
                        .onTapGesture {
                            guard rel != 0 else { return }
                            userTookControl = true
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.44, dampingFraction: 0.76)) {
                                selectedTab = tab
                            }
                        }
                }
            }
            .frame(height: 214)
        }
        .frame(maxWidth: 340, maxHeight: 270)
        .task(id: isActive) {
            guard isActive else { return }
            userTookControl = false
            isCardFlipped = false
            pickedOption = nil
            if reduceMotion {
                selectedTab = .summary
                return
            }

            while !Task.isCancelled && !userTookControl {
                // Step 1: Summary card
                withAnimation(.spring(response: 0.46, dampingFraction: 0.78)) {
                    selectedTab = .summary
                    isCardFlipped = false
                    pickedOption = nil
                }
                try? await Task.sleep(for: .milliseconds(2100))
                guard !Task.isCancelled && !userTookControl else { break }

                // Step 2: Flashcard front -> 3D flip to back
                withAnimation(.spring(response: 0.46, dampingFraction: 0.78)) {
                    selectedTab = .flashcard
                }
                try? await Task.sleep(for: .milliseconds(1050))
                guard !Task.isCancelled && !userTookControl else { break }

                withAnimation(.spring(response: 0.56, dampingFraction: 0.76)) {
                    isCardFlipped = true
                }
                try? await Task.sleep(for: .milliseconds(1850))
                guard !Task.isCancelled && !userTookControl else { break }

                // Step 3: Live Quiz -> auto-solve correct option
                withAnimation(.spring(response: 0.46, dampingFraction: 0.78)) {
                    selectedTab = .quiz
                }
                try? await Task.sleep(for: .milliseconds(950))
                guard !Task.isCancelled && !userTookControl else { break }

                withAnimation(.spring(response: 0.38, dampingFraction: 0.74)) {
                    pickedOption = 1
                }
                quizBurst += 1
                try? await Task.sleep(for: .milliseconds(2100))
            }
        }
    }

    private func relativeSlot(for tab: DeckTab) -> Int {
        let diff = tab.rawValue - selectedTab.rawValue
        if diff == 0 { return 0 }
        if diff == -1 || diff == 2 { return -1 }
        return 1
    }

    @ViewBuilder
    private func deckCardContent(for tab: DeckTab, isFront: Bool) -> some View {
        switch tab {
        case .summary:
            summaryCard
        case .flashcard:
            flashcard3D(isFront: isFront)
        case .quiz:
            quizCard(isFront: isFront)
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Label("ÖZET · 6 KAVRAM", systemImage: "sparkles")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.hi, in: Capsule())
                Spacer()
                Text("Psikolojiye Giriş")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(Theme.text3)
            }

            Text("Öğrenme ve Uzun Süreli Bellek")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text)

            VStack(alignment: .leading, spacing: 6) {
                summaryBullet("Aktif hatırlama", detail: "bilgiyi geri çağırdıkça izi güçlendirir.")
                summaryBullet("Aralıklı tekrar", detail: "unutma eğrisini tam kırılma anında yakalar.")
            }

            Spacer(minLength: 0)

            HStack(spacing: 6) {
                Text("Formül dahil:")
                    .font(.caption2)
                    .foregroundStyle(Theme.text3)
                Text("R = e^(−t / S)")
                    .font(.caption.weight(.bold).monospaced())
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
        .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 4))
    }

    private func summaryBullet(_ key: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 6) {
            Circle()
                .fill(Theme.hi)
                .overlay(Circle().stroke(Theme.cardLine, lineWidth: 1))
                .frame(width: 7, height: 7)
                .padding(.top, 5)
            (Text(key).fontWeight(.bold).foregroundStyle(Theme.text)
             + Text(" " + detail).foregroundStyle(Theme.text2))
                .font(.caption)
                .lineLimit(2)
        }
    }

    private func flashcard3D(isFront: Bool) -> some View {
        let angle: Double = isCardFlipped ? 180 : 0
        return ZStack {
            // Front face
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("EZBER KARTI · 1 / 12")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                        Text("Çevir")
                    }
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.hiSoft, in: Capsule())
                }

                Spacer(minLength: 0)

                Text("Aralıklı tekrar neden sınav gecesi ezberinden daha kalıcıdır?")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)

                Text("Cevabı görmek için karta dokun")
                    .font(.caption2)
                    .foregroundStyle(Theme.text3)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 4))
            .opacity(isCardFlipped ? 0 : 1)

            // Back face (pre-rotated 180deg so text reads cleanly after flip)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("CEVAP")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.onHi)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.hi, in: Capsule())
                    Spacer()
                    Text(" Tekrar: 4 gün sonra")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Theme.text2)
                }

                Spacer(minLength: 0)

                Text("Tam unutmak üzereyken hatırladığında beyin o bilgiyi 'önemli' olarak kodlar.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)

                HStack(spacing: 6) {
                    ForEach(["Bilemedim", "Zor", "İyi", "Kolay"], id: \.self) { label in
                        let chosen = label == "İyi"
                        Text(label)
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(chosen ? Theme.onHi : Theme.text2)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(chosen ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(chosen ? Theme.cardLine : Theme.border, lineWidth: chosen ? 1.5 : 1)
                            )
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 4))
            .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
            .opacity(isCardFlipped ? 1 : 0)
        }
        .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
        .onTapGesture {
            guard isFront else {
                userTookControl = true
                OnboardingHaptics.selection()
                withAnimation(.spring(response: 0.44, dampingFraction: 0.76)) {
                    selectedTab = .flashcard
                }
                return
            }
            userTookControl = true
            OnboardingHaptics.medium()
            withAnimation(.spring(response: 0.52, dampingFraction: 0.76)) {
                isCardFlipped.toggle()
            }
        }
    }

    private func quizCard(isFront: Bool) -> some View {
        let options = [
            "Notların altını tekrar tekrar çizmek",
            "Notu kapatıp kendi sözlerinle anlatmak"
        ]
        return ZStack {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("TEST · SORU 1 / 5")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    if pickedOption == 1 {
                        Label("Doğru!", systemImage: "checkmark.circle.fill")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Theme.success)
                            .transition(.scale.combined(with: .opacity))
                    } else if pickedOption == 0 {
                        Text("Pasif okuma — diğerini dene")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.danger)
                            .transition(.opacity)
                    }
                }

                Text("Hangisi aktif hatırlamaya örnektir?")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text)

                VStack(spacing: 7) {
                    ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                        let isSelected = pickedOption == idx
                        let isCorrect = idx == 1
                        Button {
                            guard isFront else {
                                userTookControl = true
                                withAnimation(.spring(response: 0.44, dampingFraction: 0.76)) {
                                    selectedTab = .quiz
                                }
                                return
                            }
                            userTookControl = true
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.74)) {
                                pickedOption = idx
                            }
                            if isCorrect {
                                OnboardingHaptics.success()
                                quizBurst += 1
                            } else {
                                OnboardingHaptics.light()
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: isSelected
                                      ? (isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill")
                                      : "circle")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(
                                        isSelected
                                            ? (isCorrect ? Theme.onHi : Theme.danger)
                                            : Theme.text3
                                    )
                                Text(opt)
                                    .font(.caption.weight(isSelected ? .bold : .medium))
                                    .foregroundStyle(isSelected && isCorrect ? Theme.onHi : Theme.text)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.84)
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 9)
                            .background(
                                isSelected
                                    ? (isCorrect ? Theme.hi : Theme.dangerSoft)
                                    : Theme.surface2,
                                in: RoundedRectangle(cornerRadius: 11)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 11)
                                    .stroke(
                                        isSelected && isCorrect ? Theme.cardLine : Theme.border,
                                        lineWidth: isSelected && isCorrect ? 1.5 : 1
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 4))

            HighlighterSparkBurst(trigger: quizBurst)
        }
    }
}

// MARK: - Scene 3: Live Exam Readiness Gauge, Memory Curve & Daily Boost

/// Visualizes exam readiness counting up with a live memory retention curve and interactive study day blocks.
struct ExamReadinessArenaScene: View {
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var activeDays: Int = 2
    @State private var curveReveal: CGFloat = 0
    @State private var userBoosted = false
    @State private var burstTrigger = 0

    private let dayLabels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
    private let readinessSteps = [24, 38, 54, 68, 79, 88, 95, 98]

    private var readinessPercent: Int {
        readinessSteps[min(max(activeDays, 0), readinessSteps.count - 1)]
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 12) {
                // Course & exam countdown row (with right margin so Fosfor perches cleanly on the card rim)
                HStack(spacing: 8) {
                    CountdownChip(
                        text: activeDays >= 6 ? "Sınava hazır" : "Vizeye 6 gün",
                        tone: activeDays >= 6 ? .danger : .warning
                    )
                    .fixedSize()
                    Text("· Veri Yapıları")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.text2)
                        .lineLimit(1)
                    Spacer(minLength: 48)
                }

                // Rolling readiness readout + tactile highlighter bar
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Sınav hazırlığı")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                        Spacer()
                        Text("Hazırlık: %\(readinessPercent)")
                            .font(Theme.display(.headline))
                            .monospacedDigit()
                            .foregroundStyle(Theme.text)
                            .contentTransition(.numericText(value: Double(readinessPercent)))
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Theme.surface2)
                            Capsule()
                                .fill(Theme.hi)
                                .frame(width: max(20, geo.size.width * CGFloat(readinessPercent) / 100.0))
                                .overlay(
                                    Capsule()
                                        .stroke(Theme.cardLine, lineWidth: 1.5)
                                )
                                .animation(.spring(response: 0.5, dampingFraction: 0.78), value: readinessPercent)
                        }
                    }
                    .frame(height: 13)
                }

                // Live memory curve: forgetting vs StudyMode spaced-repetition rescue
                MemoryRescueGraph(reveal: curveReveal, rescues: min(3, max(1, activeDays / 2)))
                    .frame(height: 62)

                // Interactive 7-day plan strip + boost button
                VStack(spacing: 8) {
                    HStack(spacing: 5) {
                        ForEach(0..<7, id: \.self) { index in
                            let done = index < activeDays
                            Button {
                                userBoosted = true
                                OnboardingHaptics.selection()
                                withAnimation(.spring(response: 0.38, dampingFraction: 0.75)) {
                                    activeDays = index + 1
                                }
                                if index + 1 >= 6 {
                                    OnboardingHaptics.success()
                                    burstTrigger += 1
                                }
                            } label: {
                                VStack(spacing: 3) {
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(done ? Theme.hi : Theme.surface2)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 6)
                                                .stroke(done ? Theme.cardLine : Theme.border, lineWidth: done ? 1.5 : 1)
                                        )
                                        .frame(height: 22)
                                        .overlay {
                                            if done {
                                                Image(systemName: "checkmark")
                                                    .font(.system(size: 9, weight: .black))
                                                    .foregroundStyle(Theme.onHi)
                                                    .transition(.scale.combined(with: .opacity))
                                            }
                                        }
                                    Text(dayLabels[index])
                                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                                        .foregroundStyle(done ? Theme.text : Theme.text3)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    Button {
                        userBoosted = true
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.74)) {
                            activeDays = activeDays >= 7 ? 2 : activeDays + 1
                        }
                        if activeDays >= 6 {
                            OnboardingHaptics.success()
                            burstTrigger += 1
                        } else {
                            OnboardingHaptics.light()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: activeDays >= 7 ? "arrow.counterclockwise" : "bolt.fill")
                                .font(.caption2.weight(.bold))
                            Text(activeDays >= 7 ? "Plan tamamlandı · Baştan oynat" : "Bugünkü 15 kartı tamamla (+)")
                                .font(.caption2.weight(.bold))
                        }
                        .foregroundStyle(Theme.text)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 9))
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 5))
            .padding(.horizontal, 12)

            FosforMascotView(framed: false, 
                size: 48,
                mood: activeDays >= 6 ? .cheering : .proud
            )
            .offset(x: -6, y: -18)

            HighlighterSparkBurst(trigger: burstTrigger)
                .offset(x: -28, y: 12)
        }
        .padding(.top, 14)
        .frame(maxWidth: 344, maxHeight: 284)
        .task(id: isActive) {
            guard isActive else { return }
            userBoosted = false
            if reduceMotion {
                activeDays = 5
                curveReveal = 1
                return
            }

            while !Task.isCancelled && !userBoosted {
                activeDays = 1
                curveReveal = 0
                withAnimation(.easeOut(duration: 1.15)) {
                    curveReveal = 1
                }
                for step in 2...6 {
                    try? await Task.sleep(for: .milliseconds(620))
                    guard !Task.isCancelled && !userBoosted else { break }
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.78)) {
                        activeDays = step
                    }
                    if step == 6 {
                        burstTrigger += 1
                    }
                }
                try? await Task.sleep(for: .milliseconds(2500))
            }
        }
    }
}

/// Mini graph contrasting natural forgetting (dashed) against StudyMode's spaced-repetition boosts.
private struct MemoryRescueGraph: View {
    let reveal: CGFloat
    let rescues: Int

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Canvas { context, size in
                let w = size.width
                let h = size.height

                // Subtle horizontal baseline
                var base = Path()
                base.move(to: CGPoint(x: 0, y: h - 6))
                base.addLine(to: CGPoint(x: w, y: h - 6))
                context.stroke(base, with: .color(Theme.border), lineWidth: 1)

                // Faded forgetting curve without spaced repetition
                var forget = Path()
                forget.move(to: CGPoint(x: 4, y: 10))
                forget.addCurve(
                    to: CGPoint(x: w - 6, y: h - 9),
                    control1: CGPoint(x: w * 0.24, y: h * 0.68),
                    control2: CGPoint(x: w * 0.58, y: h * 0.88)
                )
                context.stroke(
                    forget,
                    with: .color(Theme.text3.opacity(0.45)),
                    style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])
                )

                // StudyMode spaced-repetition curve with rescue bounces
                var rescue = Path()
                rescue.move(to: CGPoint(x: 4, y: 10))
                rescue.addQuadCurve(
                    to: CGPoint(x: w * 0.28, y: h * 0.52),
                    control: CGPoint(x: w * 0.14, y: h * 0.46)
                )
                rescue.addLine(to: CGPoint(x: w * 0.31, y: 11))
                rescue.addQuadCurve(
                    to: CGPoint(x: w * 0.62, y: h * 0.42),
                    control: CGPoint(x: w * 0.47, y: h * 0.38)
                )
                rescue.addLine(to: CGPoint(x: w * 0.65, y: 9))
                rescue.addQuadCurve(
                    to: CGPoint(x: w - 6, y: 14),
                    control: CGPoint(x: w * 0.82, y: 16)
                )

                let trimmed = rescue.trimmedPath(from: 0, to: reveal)
                context.stroke(
                    trimmed,
                    with: .color(Theme.hi),
                    style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round)
                )
                context.stroke(
                    trimmed,
                    with: .color(Theme.accent),
                    style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)
                )

                // Rescue marker dots
                let nodes: [CGPoint] = [
                    CGPoint(x: w * 0.31, y: 11),
                    CGPoint(x: w * 0.65, y: 9),
                    CGPoint(x: w - 6, y: 14)
                ]
                for (idx, pt) in nodes.prefix(rescues).enumerated() where reveal > CGFloat(idx + 1) * 0.28 {
                    let dotRect = CGRect(x: pt.x - 5, y: pt.y - 5, width: 10, height: 10)
                    let dot = Path(ellipseIn: dotRect)
                    context.fill(dot, with: .color(Theme.hi))
                    context.stroke(dot, with: .color(Theme.cardLine), lineWidth: 2)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Theme.surface2.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))

            Text("Unutacakken hatırlatır")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Theme.hi, in: Capsule())
                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                .padding(6)
        }
    }
}
