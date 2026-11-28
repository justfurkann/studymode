import SwiftUI

/// Premium Mini-Game 1: "Günün Kavramı" — clean, NYT Wordle-grade Turkish academic word puzzle.
struct DailyWordGameView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme

    private let today = MiniGames.istanbulDay()
    private let term = WordGame.dailyTerm()

    @State private var save: WordSave = WordGame.loadSave()
    @State private var current = ""
    @State private var shakeTrigger = 0
    @State private var alertText: String?

    private let rows: [[String]] = [
        ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
        ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
        ["Z", "C", "V", "B", "N", "M", "Ö", "Ç"]
    ]

    private var answerLen: Int { term.word.count }
    private var won: Bool { save.guesses.contains(term.word) }
    private var over: Bool { won || save.guesses.count >= WordGame.maxGuesses }
    private var clueOpened: Bool { save.guesses.count >= WordGame.clueAfter || over }
    private var keyMarks: [Character: LetterMark] { WordGame.letterMarks(guesses: save.guesses, answer: term.word) }

    private var tileSize: CGFloat {
        switch answerLen {
        case ...5: 54
        case 6: 48
        case 7: 42
        default: 38
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                VStack(spacing: 0) {
                    // Compact centered meta strip
                    HStack(spacing: 8) {
                        Label(term.subject, systemImage: "book.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.onHi)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Theme.hi, in: Capsule())

                        Text("\(answerLen) harf")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Theme.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))

                        if save.streak > 0 {
                            Label("\(save.streak)", systemImage: "flame.fill")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.text)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 5)
                                .background(Theme.surface, in: Capsule())
                                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                        }
                    }
                    .padding(.top, 8)

                    // Status / error toast (fixed height so grid never jumps)
                    ZStack {
                        if let alertText {
                            Text(alertText)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 5)
                                .background(Theme.danger, in: Capsule())
                                .transition(.scale(scale: 0.9).combined(with: .opacity))
                        } else if !clueOpened {
                            Text("\(WordGame.clueAfter - save.guesses.count) deneme sonra tanım ipucu açılır")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(Theme.text3)
                        }
                    }
                    .frame(height: 30)
                    .padding(.top, 4)
                    .animation(.easeInOut(duration: 0.18), value: alertText)

                    Spacer(minLength: 8)

                    // Centered square Wordle grid
                    VStack(spacing: 7) {
                        ForEach(0..<WordGame.maxGuesses, id: \.self) { rowIdx in
                            wordRow(rowIdx)
                        }
                    }
                    .keyframeAnimator(initialValue: CGFloat(0), trigger: shakeTrigger) { view, offset in
                        view.offset(x: offset)
                    } keyframes: { _ in
                        KeyframeTrack {
                            CubicKeyframe(-10, duration: 0.055)
                            CubicKeyframe(10, duration: 0.055)
                            CubicKeyframe(-7, duration: 0.055)
                            CubicKeyframe(7, duration: 0.055)
                            CubicKeyframe(0, duration: 0.055)
                        }
                    }

                    // Definition clue card (opens after 3 tries or at game end)
                    if clueOpened {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(over ? (won ? "Harika! Doğru kavram: \(term.word)" : "Doğru kavram: \(term.word)") : "İpucu")
                                .font(.caption.weight(.heavy))
                                .foregroundStyle(won ? Theme.success : Theme.text)
                            Text(term.clue)
                                .font(.caption)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                    }

                    Spacer(minLength: 12)

                    // Bottom area: either clean Share CTA or native-feel edge-to-edge keyboard
                    if over {
                        VStack(spacing: 10) {
                            ShareLink(
                                item: WordGame.shareText(
                                    day: today,
                                    guesses: save.guesses,
                                    answer: term.word,
                                    won: won,
                                    clueOpened: save.guesses.count > WordGame.clueAfter
                                )
                            ) {
                                Label("Sonucu paylaş", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(PrimaryButtonStyle())

                            Text("Oynanan: \(save.played) · Kazanılan: \(save.wins) · Seri: \(save.streak)")
                                .font(.caption)
                                .foregroundStyle(Theme.text3)
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, 24)
                    } else {
                        keyboard
                            .padding(.horizontal, 5)
                            .padding(.bottom, 18)
                    }
                }
            }
            .navigationTitle("Günün Kavramı")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                }
            }
        }
    }

    // MARK: - Letter Grid Row

    private func wordRow(_ rowIdx: Int) -> some View {
        let isSubmitted = rowIdx < save.guesses.count
        let isCurrent = rowIdx == save.guesses.count && !over
        let letters: [Character] = isSubmitted
            ? Array(save.guesses[rowIdx])
            : (isCurrent ? Array(current) : [])
        let marks: [LetterMark]? = isSubmitted ? WordGame.markGuess(save.guesses[rowIdx], answer: term.word) : nil

        return HStack(spacing: 7) {
            ForEach(0..<answerLen, id: \.self) { col in
                let ch = col < letters.count ? String(letters[col]) : ""
                let mark = marks.flatMap { col < $0.count ? $0[col] : nil }
                let isTyped = isCurrent && !ch.isEmpty

                Text(ch)
                    .font(.system(size: tileSize * 0.48, weight: .heavy, design: .rounded))
                    .foregroundStyle(tileText(mark: mark))
                    .frame(width: tileSize, height: tileSize)
                    .background(tileBg(mark: mark, filled: !ch.isEmpty), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(tileBorder(mark: mark, filled: !ch.isEmpty), lineWidth: isTyped ? 2.2 : 1.4)
                    )
                    .scaleEffect(isTyped ? 1.04 : 1.0)
                    .animation(.spring(response: 0.18, dampingFraction: 0.65), value: ch)
            }
        }
    }

    // MARK: - Clean Native-Feel Edge-to-Edge Turkish Keyboard

    private var keyboard: some View {
        let canSubmit = current.count == answerLen
        return VStack(spacing: 8) {
            // Row 1 (10 keys)
            HStack(spacing: 4) {
                ForEach(rows[0], id: \.self) { letterKey($0) }
            }
            .padding(.horizontal, 6)

            // Row 2 (11 keys)
            HStack(spacing: 3.5) {
                ForEach(rows[1], id: \.self) { letterKey($0) }
            }

            // Row 3 (wide submit + 8 keys + wide backspace)
            HStack(spacing: 4) {
                Button {
                    tapKey("ENTER")
                } label: {
                    Image(systemName: "checkmark")
                        .font(.system(size: 16, weight: .black))
                        .foregroundStyle(canSubmit ? Theme.onHi : Theme.text2)
                        .frame(width: 48, height: 48)
                        .background(canSubmit ? Theme.hi : neutralKeyBg, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .shadow(color: Color.black.opacity(scheme == .dark ? 0.35 : 0.12), radius: 0, y: 1.5)
                }
                .buttonStyle(TactileCardButtonStyle(scale: 0.92))

                ForEach(rows[2], id: \.self) { letterKey($0) }

                Button {
                    tapKey("DEL")
                } label: {
                    Image(systemName: "delete.left")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .frame(width: 48, height: 48)
                        .background(neutralKeyBg, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .shadow(color: Color.black.opacity(scheme == .dark ? 0.35 : 0.12), radius: 0, y: 1.5)
                }
                .buttonStyle(TactileCardButtonStyle(scale: 0.92))
            }
        }
    }

    private func letterKey(_ key: String) -> some View {
        let mark = key.first.flatMap { keyMarks[$0] }
        return Button {
            tapKey(key)
        } label: {
            Text(key)
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundStyle(keyText(mark: mark))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(keyBg(mark: mark), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .shadow(color: Color.black.opacity(mark == .miss ? 0.0 : (scheme == .dark ? 0.35 : 0.12)), radius: 0, y: 1.5)
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.92))
    }

    // MARK: - Input Logic

    private func tapKey(_ key: String) {
        guard !over else { return }
        alertText = nil
        if key == "DEL" {
            if !current.isEmpty {
                OnboardingHaptics.light()
                current.removeLast()
            }
        } else if key == "ENTER" {
            submitGuess()
        } else if current.count < answerLen {
            OnboardingHaptics.selection()
            current.append(key)
        }
    }

    private func submitGuess() {
        guard current.count == answerLen else {
            OnboardingHaptics.light()
            shakeTrigger += 1
            alertText = "\(answerLen) harfli bir tahmin gir."
            return
        }
        guard !save.guesses.contains(current) else {
            OnboardingHaptics.light()
            shakeTrigger += 1
            alertText = "Bu tahmini zaten denedin."
            return
        }
        guard WordGame.isValidTurkishWord(current) else {
            OnboardingHaptics.light()
            shakeTrigger += 1
            alertText = "Geçerli bir Türkçe kelime gir."
            return
        }
        let guess = current
        current = ""
        save = WordGame.addGuess(save, guess: guess, answer: term.word)
        if guess == term.word {
            OnboardingHaptics.success()
        } else {
            OnboardingHaptics.medium()
        }
    }

    // MARK: - Palette

    private var neutralKeyBg: Color {
        scheme == .dark ? Color(uiColor: UIColor(hex: 0x2B3156)) : Color(uiColor: UIColor(hex: 0xE6E6DE))
    }

    private var missedKeyBg: Color {
        scheme == .dark ? Color(uiColor: UIColor(hex: 0x191D38)) : Color(uiColor: UIColor(hex: 0xD2D2C8))
    }

    private func tileBg(mark: LetterMark?, filled: Bool) -> Color {
        switch mark {
        case .hit: Theme.success
        case .near: Theme.hi
        case .miss: missedKeyBg
        case nil: filled ? Theme.surface : Theme.surface.opacity(0.45)
        }
    }

    private func tileText(mark: LetterMark?) -> Color {
        switch mark {
        case .hit: .white
        case .near: Theme.onHi
        case .miss: Theme.text3
        case nil: Theme.text
        }
    }

    private func tileBorder(mark: LetterMark?, filled: Bool) -> Color {
        switch mark {
        case .hit: Theme.success
        case .near: Theme.hi
        case .miss: missedKeyBg
        case nil: filled ? Theme.text : Theme.border
        }
    }

    private func keyBg(mark: LetterMark?) -> Color {
        switch mark {
        case .hit: Theme.success
        case .near: Theme.hi
        case .miss: missedKeyBg
        case nil: neutralKeyBg
        }
    }

    private func keyText(mark: LetterMark?) -> Color {
        switch mark {
        case .hit: .white
        case .near: Theme.onHi
        case .miss: Theme.text3.opacity(0.75)
        case nil: Theme.text
        }
    }
}
