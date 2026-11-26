import SwiftUI
import UIKit

/// "Fosforlu": grid-paper ground, navy ink, one highlighter yellow.
/// Values mirror the tokens at the top of src/styles/global.css (light and dark).
enum Theme {
    static let bg = Color(light: 0xFAFAF6, dark: 0x11142A)
    static let surface = Color(light: 0xFFFFFF, dark: 0x191D38)
    static let surface2 = Color(light: 0xF2F2EB, dark: 0x232847)
    static let border = Color(light: 0xE5E5DC, dark: 0x2C3156)
    static let text = Color(light: 0x1B2250, dark: 0xF4F3EA)
    static let text2 = Color(light: 0x4A5078, dark: 0xB9BBD2)
    static let text3 = Color(light: 0x737894, dark: 0x8A8EA9)
    /// Main action color: navy in light, yellow in dark.
    static let accent = Color(light: 0x1B2250, dark: 0xFFE14D)
    static let onAccent = Color(light: 0xFFFFFF, dark: 0x11142A)
    /// The highlighter. Only ever a background, never text.
    static let hi = Color(light: 0xFFE14D, dark: 0xFFE14D)
    static let onHi = Color(light: 0x1B2250, dark: 0x11142A)
    static let hiSoft = Color(light: 0xFFF6C7, dark: 0x33301A)
    static let cardLine = Color(light: 0x1B2250, dark: 0x3A4070)
    static let cardDrop = Color(light: 0x1B2250, dark: 0x070916)
    static let grid = Color(light: 0x1B2250, dark: 0xF4F3EA)
    static let success = Color(light: 0x1C8A55, dark: 0x4ADE80)
    static let danger = Color(light: 0xD1343C, dark: 0xF87171)
    static let dangerSoft = Color(light: 0xFDE5E7, dark: 0x3A1A22)

    /// Bricolage Grotesque / Figtree are web fonts; on iPhone the rounded system face carries the
    /// same friendly, heavy headline feel and keeps Dynamic Type.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .heavy) -> Font {
        .system(style, design: .rounded, weight: weight)
    }
}

extension Color {
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

/// The site's grid-paper page background.
struct GridPaper: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 24
            var path = Path()
            var x: CGFloat = 0
            while x <= size.width { path.move(to: CGPoint(x: x, y: 0)); path.addLine(to: CGPoint(x: x, y: size.height)); x += step }
            var y: CGFloat = 0
            while y <= size.height { path.move(to: CGPoint(x: 0, y: y)); path.addLine(to: CGPoint(x: size.width, y: y)); y += step }
            context.stroke(path, with: .color(Theme.grid.opacity(scheme == .dark ? 0.035 : 0.05)), lineWidth: 1)
        }
        .background(Theme.bg)
        .ignoresSafeArea()
    }
}

/// A word marked with the highlighter, like `<span class="hl">` on the site. At most one per title.
struct Highlighted: View {
    let text: String
    var font: Font = Theme.display(.largeTitle)

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(Theme.onHi)
            .padding(.horizontal, 6)
            .background(
                Theme.hi
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .padding(.top, 8)
            )
    }
}

/// The "pressable" look (ink border + solid drop shadow). Only for the main action, like btn-primary.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .font(.headline)
            .foregroundStyle(Theme.onHi)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(Theme.hi, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardLine, lineWidth: 2))
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Theme.cardDrop)
                    .offset(y: pressed ? 1 : 4)
            )
            .offset(y: pressed ? 3 : 0)
            .opacity(isEnabled ? 1 : 0.55)
            .animation(.easeOut(duration: 0.08), value: pressed)
    }
}

/// Plain secondary action.
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.text)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

/// Focus card: surface with ink border and drop, like the site's sign-in card.
struct FocusCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(20)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 20))
            .overlay(RoundedRectangle(cornerRadius: 20).stroke(Theme.cardLine, lineWidth: 2))
            .background(RoundedRectangle(cornerRadius: 20).fill(Theme.cardDrop).offset(y: 5))
    }
}

extension View {
    func focusCard() -> some View { modifier(FocusCard()) }
}

/// Text field in the app's style.
struct FieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 14)
            .frame(minHeight: 50)
            .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            .foregroundStyle(Theme.text)
    }
}

extension View {
    func field() -> some View { modifier(FieldStyle()) }
}
