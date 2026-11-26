import SwiftUI

/// Who the student is, as the site asks it ("Seni biraz tanıyalım", src/lib/studentType.ts LEVELS).
enum StudentLevel: String, CaseIterable, Identifiable {
    case ortaokul, lise, universite, yukseklisans, mezun

    var id: String { rawValue }

    var label: String {
        switch self {
        case .ortaokul: "Ortaokul"
        case .lise: "Lise"
        case .universite: "Üniversite"
        case .yukseklisans: "Yüksek lisans / doktora"
        case .mezun: "Mezun / çalışıyorum"
        }
    }

    var hint: String {
        switch self {
        case .ortaokul: "Yazılılar, LGS"
        case .lise: "Yazılılar, TYT, AYT"
        case .universite: "Vize, final, bütünleme"
        case .yukseklisans: "Tez, makale, seminer"
        case .mezun: "YKS tekrarı, KPSS, sertifika"
        }
    }

    var symbol: String {
        switch self {
        case .ortaokul: "backpack.fill"
        case .lise: "pencil.and.ruler.fill"
        case .universite: "graduationcap.fill"
        case .yukseklisans: "books.vertical.fill"
        case .mezun: "briefcase.fill"
        }
    }

    /// Live sample tag shown as soon as the student picks a level.
    var livePreview: String {
        switch self {
        case .ortaokul: "Örnek: Fen 2. Yazılı · LGS modu hazır"
        case .lise: "Örnek: Fizik 1. Yazılı · TYT & AYT dili açık"
        case .universite: "Örnek: Vizeye 6 gün · Final takvimi açık"
        case .yukseklisans: "Örnek: Makale özeti · Seminer kartları"
        case .mezun: "Örnek: Günlük 15 kart · KPSS & sertifika"
        }
    }
}

/// What the intro remembers on this phone until there is an account to write it to.
enum OnboardingStore {
    private static let doneKey = "studymode.onboarding.v2"
    private static let levelKey = "studymode.onboarding.level"

    static var isDone: Bool {
        get { UserDefaults.standard.bool(forKey: doneKey) }
        set { UserDefaults.standard.set(newValue, forKey: doneKey) }
    }

    /// The level picked in the intro, waiting to be saved on the account after sign-in.
    static var pendingLevel: StudentLevel? {
        get { UserDefaults.standard.string(forKey: levelKey).flatMap(StudentLevel.init(rawValue:)) }
        set { UserDefaults.standard.set(newValue?.rawValue, forKey: levelKey) }
    }
}

/// Interactive, choreographed 4-step intro in StudyMode's "Fosforlu" design language:
/// 1. Live Note Scanner & Highlighter  2. 3D Study Deck  3. Exam Readiness & Memory Rescue  4. Persona Selector.
struct OnboardingView: View {
    @Environment(CaptchaController.self) private var captcha
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Called with true for "Hadi başla" (new account), false for "Giriş yap" (existing account).
    let onFinish: (_ newAccount: Bool) -> Void

    @State private var page = 0
    @State private var level: StudentLevel? = OnboardingStore.pendingLevel
    @State private var appeared = false
    private let lastPage = 3

    init(onFinish: @escaping (_ newAccount: Bool) -> Void) {
        self.onFinish = onFinish
        #if DEBUG
        if let raw = UserDefaults.standard.string(forKey: "onboardingPage"), let startPage = Int(raw) {
            _page = State(initialValue: min(max(startPage, 0), 3))
        }
        #endif
    }

    private let stepIcons = ["highlighter", "rectangle.stack.fill", "chart.line.uptrend.xyaxis", "person.crop.rectangle.fill"]

    var body: some View {
        ZStack {
            InteractiveOnboardingBackdrop(page: page)

            VStack(spacing: 0) {
                topBar
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : -12)

                TabView(selection: $page) {
                    IntroStagePage(
                        isActive: page == 0,
                        kicker: "ADIM 1 · AKILLI NOT OKUMA",
                        before: "Notunu yükle, ",
                        mark: "önemlisini",
                        after: " biz işaretleyelim.",
                        text: "Ders notunun fotoğrafını çek, PDF ya da slayt ekle. Sınavda çıkacak yerleri saniyeler içinde ayıklayalım."
                    ) {
                        ScannerHighlightScene(isActive: page == 0)
                    }
                    .tag(0)

                    IntroStagePage(
                        isActive: page == 1,
                        kicker: "ADIM 2 · ÇALIŞMA SETİ",
                        before: "Özet, kart ve test ",
                        mark: "kendiliğinden",
                        after: ".",
                        text: "Her nottan özet, 3 boyutlu ezber kartları ve sınav ayarında sorular üretilir. Üstteki sekmelere dokunup dene."
                    ) {
                        StudyDeckOrchestraScene(isActive: page == 1)
                    }
                    .tag(1)

                    IntroStagePage(
                        isActive: page == 2,
                        kicker: "ADIM 3 · ARALIKLI TEKRAR",
                        before: "Sınavına gerçekten ",
                        mark: "hazır",
                        after: " mısın?",
                        text: "Unutmak üzere olduğun kartları tam zamanında önüne getiririz. Sınav tarihini gir, hazırlığını gün gün gör."
                    ) {
                        ExamReadinessArenaScene(isActive: page == 2)
                    }
                    .tag(2)

                    LevelStagePage(level: $level, isActive: page == 3)
                        .tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.spring(response: 0.48, dampingFraction: 0.84), value: page)

                bottomDock
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 16)
            }

            // Shared bot check runs silently during the intro so a token is ready at sign-up.
            TurnstileView(controller: captcha)
                .frame(width: 1, height: 1)
                .opacity(0)
                .accessibilityHidden(true)
        }
        .onAppear {
            if reduceMotion {
                appeared = true
            } else {
                withAnimation(.spring(response: 0.55, dampingFraction: 0.82)) {
                    appeared = true
                }
            }
        }
        .onChange(of: page) { _, _ in
            OnboardingHaptics.selection()
        }
        .onChange(of: level) { _, new in
            OnboardingStore.pendingLevel = new
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(height: 26)
                .accessibilityLabel("StudyMode")

            Spacer()

            Button {
                OnboardingHaptics.light()
                finish(newAccount: false)
            } label: {
                HStack(spacing: 5) {
                    Text("Giriş yap")
                    Image(systemName: "arrow.up.right")
                        .font(.caption.weight(.bold))
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.border, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - Bottom Dock

    private var bottomDock: some View {
        VStack(spacing: 14) {
            // Interactive step scrubber pills
            HStack(spacing: 8) {
                ForEach(0...lastPage, id: \.self) { index in
                    let current = index == page
                    let passed = index < page
                    Button {
                        withAnimation(.spring(response: 0.45, dampingFraction: 0.82)) {
                            page = index
                        }
                    } label: {
                        HStack(spacing: 5) {
                            if current {
                                Image(systemName: stepIcons[index])
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Theme.onHi)
                                    .transition(.scale.combined(with: .opacity))
                            }
                            Capsule()
                                .fill(current ? Theme.onHi : (passed ? Theme.accent : Theme.border))
                                .frame(width: current ? 14 : 8, height: 6)
                        }
                        .padding(.horizontal, current ? 9 : 0)
                        .frame(height: 20)
                        .background(
                            Capsule()
                                .fill(current ? Theme.hi : Color.clear)
                        )
                        .overlay(
                            Capsule()
                                .stroke(current ? Theme.cardLine : Color.clear, lineWidth: 1.5)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .animation(.spring(response: 0.38, dampingFraction: 0.78), value: page)
            .accessibilityElement()
            .accessibilityLabel("Sayfa \(page + 1) / \(lastPage + 1)")

            if page < lastPage {
                Button {
                    OnboardingHaptics.light()
                    withAnimation(.spring(response: 0.46, dampingFraction: 0.82)) {
                        page += 1
                    }
                } label: {
                    HStack(spacing: 8) {
                        Text(page == 2 ? "Son adıma geç" : "Devam")
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.bold))
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            } else {
                Button {
                    OnboardingHaptics.success()
                    finish(newAccount: true)
                } label: {
                    HStack(spacing: 8) {
                        Text("Ücretsiz başla")
                        Image(systemName: "arrow.right")
                            .font(.subheadline.weight(.bold))
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(level == nil)

                Text(level == nil
                     ? "Devam etmek için yukarıdan seviyeni seç."
                     : "Ücretsiz hesapla yapay zekâ açılır, notların her cihazda senkron kalır.")
                    .font(.footnote)
                    .foregroundStyle(Theme.text3)
                    .multilineTextAlignment(.center)
                    .animation(.easeInOut(duration: 0.2), value: level == nil)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
        .padding(.top, 6)
    }

    private func finish(newAccount: Bool) {
        OnboardingStore.isDone = true
        onFinish(newAccount)
    }
}

// MARK: - Living Grid & Parallax Spotlight Backdrop

private struct InteractiveOnboardingBackdrop: View {
    let page: Int

    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var spotlightOffset: CGSize {
        switch page {
        case 0: CGSize(width: -70, height: -130)
        case 1: CGSize(width: 80, height: -95)
        case 2: CGSize(width: -45, height: -70)
        default: CGSize(width: 55, height: -150)
        }
    }

    var body: some View {
        ZStack {
            GridPaper()

            // Soft moving highlighter ambient wash behind the active stage
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Theme.hi.opacity(scheme == .dark ? 0.16 : 0.34),
                            Theme.hi.opacity(0)
                        ],
                        center: .center,
                        startRadius: 12,
                        endRadius: 210
                    )
                )
                .frame(width: 420, height: 420)
                .offset(spotlightOffset)
                .animation(
                    reduceMotion ? .none : .spring(response: 0.75, dampingFraction: 0.82),
                    value: page
                )
                .allowsHitTesting(false)

            // Subtle architectural notebook registration ticks (+) that drift with page swipe
            GeometryReader { geo in
                let shift = CGFloat(page) * -14
                ZStack {
                    CrosshairTick()
                        .position(x: 34, y: geo.size.height * 0.18)
                        .offset(x: shift * 0.4)
                    CrosshairTick()
                        .position(x: geo.size.width - 32, y: geo.size.height * 0.48)
                        .offset(x: shift * 0.6)
                    CrosshairTick()
                        .position(x: 46, y: geo.size.height * 0.56)
                        .offset(x: -shift * 0.3)
                }
                .animation(
                    reduceMotion ? .none : .spring(response: 0.6, dampingFraction: 0.84),
                    value: page
                )
            }
            .allowsHitTesting(false)
        }
        .ignoresSafeArea()
    }
}

private struct CrosshairTick: View {
    var body: some View {
        ZStack {
            Rectangle().fill(Theme.border).frame(width: 11, height: 1.5)
            Rectangle().fill(Theme.border).frame(width: 1.5, height: 11)
        }
    }
}

// MARK: - Stage Page Template with Kinetic Highlighter Headline

private struct IntroStagePage<Stage: View>: View {
    let isActive: Bool
    let kicker: String
    let before: String
    let mark: String
    let after: String
    let text: String
    @ViewBuilder let stage: () -> Stage

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var highlightSwept = false
    @State private var stageVisible = false

    private var headline: AttributedString {
        let pad = "\u{202F}"
        let tail = after.first?.isPunctuation == true ? "" : pad
        var marked = AttributedString(pad + mark + tail)
        if highlightSwept {
            marked.backgroundColor = Theme.hi
            marked.foregroundColor = Theme.onHi
        } else {
            marked.foregroundColor = Theme.text
        }
        return AttributedString(before) + marked + AttributedString(after)
    }

    var body: some View {
        VStack(spacing: 18) {
            Spacer(minLength: 2)

            stage()
                .scaleEffect(stageVisible ? 1.0 : 0.94)
                .opacity(stageVisible ? 1.0 : 0)

            VStack(spacing: 10) {
                Text(kicker)
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(Theme.text3)

                Text(headline)
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(.easeOut(duration: 0.28), value: highlightSwept)

                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 4)
        }
        .onAppear {
            if reduceMotion {
                stageVisible = true
                highlightSwept = true
            }
        }
        .task(id: isActive) {
            guard !reduceMotion else {
                stageVisible = true
                highlightSwept = true
                return
            }
            if isActive {
                highlightSwept = false
                withAnimation(.spring(response: 0.50, dampingFraction: 0.80)) {
                    stageVisible = true
                }
                try? await Task.sleep(for: .milliseconds(210))
                guard !Task.isCancelled else { return }
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    highlightSwept = true
                }
            } else {
                highlightSwept = false
            }
        }
    }
}

// MARK: - Step 4: "Seni tanıyalım" Interactive Persona Selector

private struct LevelStagePage: View {
    @Binding var level: StudentLevel?
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var cardsRevealed = false
    @State private var pickBurst = 0

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 14) {
                // Header + Fosfor greeting
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            Text("Seni")
                                .font(Theme.display(.title))
                                .foregroundStyle(Theme.text)
                            Highlighted(text: "tanıyalım", font: Theme.display(.title))
                        }
                        Text("Sınavlarını senin dilinle konuşalım: vize ve final mi, yazılı ve TYT mi?")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 4)

                    ZStack {
                        FosforMascotView(
                            size: 54,
                            mood: level == nil ? .curious : .cheering
                        )
                        HighlighterSparkBurst(trigger: pickBurst)
                    }
                }
                .padding(.top, 8)

                // Dynamic live preview banner reacting immediately to selection
                HStack(spacing: 8) {
                    Image(systemName: level == nil ? "sparkles" : "checkmark.seal.fill")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(level == nil ? Theme.text3 : Theme.onHi)
                        .frame(width: 24, height: 24)
                        .background(level == nil ? Theme.surface2 : Theme.hi, in: Circle())
                        .overlay(Circle().stroke(level == nil ? Theme.border : Theme.cardLine, lineWidth: 1))

                    Text(level?.livePreview ?? "Seviyeni seçtiğinde sınav takvimi dilin anında ayarlanır.")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.84)
                        .contentTransition(.interpolate)

                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .background(level == nil ? Theme.surface : Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(level == nil ? Theme.border : Theme.cardLine, lineWidth: level == nil ? 1 : 1.5)
                )

                // Tactile level cards with staggered spring reveal
                VStack(spacing: 9) {
                    ForEach(Array(StudentLevel.allCases.enumerated()), id: \.element.id) { idx, item in
                        let selected = level == item
                        Button {
                            OnboardingHaptics.medium()
                            withAnimation(.spring(response: 0.36, dampingFraction: 0.74)) {
                                level = item
                            }
                            pickBurst += 1
                        } label: {
                            HStack(spacing: 13) {
                                Image(systemName: item.symbol)
                                    .font(.headline)
                                    .foregroundStyle(selected ? Theme.onHi : Theme.text)
                                    .frame(width: 42, height: 42)
                                    .background(
                                        selected ? Theme.hi : Theme.surface2,
                                        in: RoundedRectangle(cornerRadius: 12)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(selected ? Theme.cardLine : Color.clear, lineWidth: 1.5)
                                    )
                                    .scaleEffect(selected ? 1.06 : 1.0)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.label)
                                        .font(.headline)
                                        .foregroundStyle(Theme.text)
                                    Text(item.hint)
                                        .font(.caption)
                                        .foregroundStyle(Theme.text2)
                                }

                                Spacer()

                                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(selected ? Theme.accent : Theme.border)
                                    .symbolEffect(.bounce, value: selected)
                            }
                            .padding(.horizontal, 13)
                            .padding(.vertical, 11)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(selected ? Theme.cardLine : Theme.border, lineWidth: selected ? 2 : 1)
                            )
                            .background(
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(selected ? Theme.cardDrop : Color.clear)
                                    .offset(y: selected ? 4 : 0)
                            )
                            .offset(y: selected ? -1 : 0)
                            .contentShape(RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                        .opacity(cardsRevealed ? 1 : 0)
                        .offset(y: cardsRevealed ? 0 : CGFloat(14 + idx * 6))
                        .animation(
                            reduceMotion
                                ? .none
                                : .spring(response: 0.46, dampingFraction: 0.80).delay(Double(idx) * 0.045),
                            value: cardsRevealed
                        )
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
        .task(id: isActive) {
            if isActive {
                if reduceMotion {
                    cardsRevealed = true
                } else {
                    cardsRevealed = false
                    try? await Task.sleep(for: .milliseconds(60))
                    cardsRevealed = true
                }
            }
        }
    }
}

#Preview {
    OnboardingView { _ in }
        .environment(CaptchaController())
}
