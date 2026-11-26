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
        case .ortaokul: "backpack"
        case .lise: "pencil.and.ruler"
        case .universite: "graduationcap"
        case .yukseklisans: "books.vertical"
        case .mezun: "briefcase"
        }
    }
}

/// What the intro remembers on this phone until there is an account to write it to.
enum OnboardingStore {
    private static let doneKey = "studymode.onboarding.v1"
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

/// Three short pages about what StudyMode does, then "Seni tanıyalım", then sign-up.
/// Sign-in comes last: the AI needs an account, but nobody should meet a form first.
struct OnboardingView: View {
    @Environment(CaptchaController.self) private var captcha
    /// Called with true for "Hadi başla" (new account), false for "Giriş yap" (existing account).
    let onFinish: (_ newAccount: Bool) -> Void

    @State private var page = 0
    @State private var level: StudentLevel? = OnboardingStore.pendingLevel
    private let lastPage = 3

    var body: some View {
        ZStack {
            GridPaper()
            VStack(spacing: 0) {
                topBar
                TabView(selection: $page) {
                    IntroPage(
                        before: "Notunu yükle, ", mark: "önemlisini", after: " biz işaretleyelim.",
                        text: "Ders notunun fotoğrafını çek, PDF'ini ekle ya da yapıştır. Gerisini StudyMode hazırlar."
                    ) { NoteArt() }
                        .tag(0)
                    IntroPage(
                        before: "Özet, kart ve test ", mark: "kendiliğinden", after: ".",
                        text: "Her not için kısa bir özet, ezber kartları ve sınav tarzında sorular hazırlanır. Formüller de dahil."
                    ) { StudySetArt() }
                        .tag(1)
                    IntroPage(
                        before: "Sınavına gerçekten ", mark: "hazır", after: " mısın?",
                        text: "Unutmak üzere olduğun kartları tam zamanında önüne getiririz. Sınav tarihini gir, planı ona göre yapalım."
                    ) { ReadinessArt() }
                        .tag(2)
                    LevelPage(level: $level)
                        .tag(3)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.snappy, value: page)

                bottomBar
            }

            // The shared bot check runs during the intro, so a token is ready at sign-up.
            TurnstileView(controller: captcha)
                .frame(width: 1, height: 1)
                .opacity(0)
                .accessibilityHidden(true)
        }
        .onChange(of: level) { _, new in OnboardingStore.pendingLevel = new }
    }

    private var topBar: some View {
        HStack {
            Image("Logo").resizable().scaledToFit().frame(height: 26)
                .accessibilityLabel("StudyMode")
            Spacer()
            Button("Giriş yap") { finish(newAccount: false) }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text)
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private var bottomBar: some View {
        VStack(spacing: 14) {
            HStack(spacing: 7) {
                ForEach(0...lastPage, id: \.self) { i in
                    Capsule()
                        .fill(i == page ? Theme.accent : Theme.border)
                        .frame(width: i == page ? 22 : 8, height: 8)
                }
            }
            .animation(.snappy, value: page)
            .accessibilityElement()
            .accessibilityLabel("Sayfa \(page + 1) / \(lastPage + 1)")

            if page < lastPage {
                Button { page += 1 } label: {
                    HStack(spacing: 6) { Text("Devam"); Image(systemName: "arrow.right") }
                }
                .buttonStyle(PrimaryButtonStyle())
            } else {
                Button { finish(newAccount: true) } label: {
                    HStack(spacing: 6) { Text("Hadi başla"); Image(systemName: "arrow.right") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(level == nil)
                Text(level == nil ? "Devam etmek için birini seç." : "Son adım: hesabını aç, notların her cihazında dursun.")
                    .font(.footnote)
                    .foregroundStyle(Theme.text3)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
        .padding(.top, 8)
    }

    private func finish(newAccount: Bool) {
        OnboardingStore.isDone = true
        onFinish(newAccount)
    }
}

/// One intro page: art on top, a title with one highlighted word, one sentence.
private struct IntroPage<Art: View>: View {
    let before: String
    let mark: String
    let after: String
    let text: String
    @ViewBuilder let art: () -> Art

    /// The highlighted word sits inside the sentence, like `<span class="hl">` on the site.
    private var title: AttributedString {
        // Narrow no-break spaces pad the highlight without ever being left alone at a line end.
        let pad = "\u{202F}"
        let tail = after.first?.isPunctuation == true ? "" : pad
        var marked = AttributedString(pad + mark + tail)
        marked.backgroundColor = Theme.hi
        marked.foregroundColor = Theme.onHi
        return AttributedString(before) + marked + AttributedString(after)
    }

    var body: some View {
        VStack(spacing: 28) {
            Spacer(minLength: 8)
            art()
                .frame(maxWidth: 320)
                .frame(height: 260)
            VStack(spacing: 12) {
                Text(title)
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Text(text)
                    .font(.body)
                    .foregroundStyle(Theme.text2)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 28)
            Spacer(minLength: 8)
        }
    }
}

// MARK: - Seni tanıyalım

private struct LevelPage: View {
    @Binding var level: StudentLevel?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
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
                .padding(.top, 12)

                VStack(spacing: 10) {
                    ForEach(StudentLevel.allCases) { item in
                        let selected = level == item
                        Button {
                            withAnimation(.snappy) { level = item }
                        } label: {
                            HStack(spacing: 14) {
                                Image(systemName: item.symbol)
                                    .font(.title3)
                                    .foregroundStyle(selected ? Theme.onHi : Theme.text)
                                    .frame(width: 44, height: 44)
                                    .background(selected ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.label)
                                        .font(.headline)
                                        .foregroundStyle(Theme.text)
                                    Text(item.hint)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.text2)
                                }
                                Spacer()
                                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(selected ? Theme.accent : Theme.border)
                            }
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(selected ? Theme.cardLine : Theme.border, lineWidth: selected ? 2 : 1))
                            .contentShape(RoundedRectangle(cornerRadius: 16))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
    }
}

// MARK: - Art (drawn with SwiftUI, in the Fosforlu palette)

/// A page of notes with the important lines marked by the highlighter.
private struct NoteArt: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "doc.text").foregroundStyle(Theme.text2)
                Capsule().fill(Theme.text.opacity(0.75)).frame(width: 120, height: 10)
            }
            .padding(.bottom, 4)
            line(0.92, marked: false)
            line(0.78, marked: true)
            line(0.64, marked: false)
            line(0.9, marked: true)
            line(0.55, marked: false)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .rotationEffect(.degrees(-2))
        .padding(.horizontal, 24)
        .accessibilityHidden(true)
    }

    private func line(_ width: CGFloat, marked: Bool) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                if marked {
                    RoundedRectangle(cornerRadius: 4).fill(Theme.hi)
                        .frame(width: geo.size.width * width, height: 16)
                }
                Capsule().fill(Theme.text.opacity(marked ? 0.85 : 0.22))
                    .frame(width: geo.size.width * width - 10, height: 7)
                    .padding(.leading, 5)
            }
            .frame(maxHeight: .infinity, alignment: .center)
        }
        .frame(height: 16)
    }
}

/// Three small cards: Özet, Kartlar, Test.
private struct StudySetArt: View {
    var body: some View {
        ZStack {
            card(icon: "checklist", title: "Test", color: Theme.surface2)
                .rotationEffect(.degrees(7))
                .offset(x: 46, y: 26)
            card(icon: "rectangle.on.rectangle", title: "Kartlar", color: Theme.surface)
                .rotationEffect(.degrees(-5))
                .offset(x: -40, y: 10)
            card(icon: "text.alignleft", title: "Özet", color: Theme.hiSoft)
                .rotationEffect(.degrees(1))
                .offset(y: -18)
        }
        .accessibilityHidden(true)
    }

    private func card(icon: String, title: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                Text(title).font(.headline)
            }
            .foregroundStyle(Theme.text)
            ForEach([0.9, 0.7, 0.8], id: \.self) { w in
                Capsule().fill(Theme.text.opacity(0.2)).frame(width: 150 * w, height: 7)
            }
        }
        .padding(16)
        .frame(width: 190, alignment: .leading)
        .background(color, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.cardLine, lineWidth: 2))
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardDrop).offset(y: 4))
    }
}

/// An exam countdown, a readiness bar and today's cards.
private struct ReadinessArt: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            CountdownChip(text: "Vizeye 8 gün", tone: .warning)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Hazırlık").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    Spacer()
                    Text("%72").font(.subheadline.weight(.bold).monospacedDigit()).foregroundStyle(Theme.text)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.surface2)
                        Capsule().fill(Theme.hi).frame(width: geo.size.width * 0.72)
                            .overlay(alignment: .leading) {
                                Capsule().stroke(Theme.cardLine, lineWidth: 1.5).frame(width: geo.size.width * 0.72)
                            }
                    }
                }
                .frame(height: 14)
            }
            HStack(spacing: 8) {
                Image(systemName: "rectangle.stack.fill")
                Text("Bugün 12 kart seni bekliyor")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.text)
            HStack(spacing: 6) {
                ForEach(0..<7) { i in
                    RoundedRectangle(cornerRadius: 5)
                        .fill(i < 5 ? Theme.hi : Theme.surface2)
                        .overlay(RoundedRectangle(cornerRadius: 5).stroke(Theme.border, lineWidth: 1))
                        .frame(height: 22)
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .padding(.horizontal, 24)
        .accessibilityHidden(true)
    }
}
