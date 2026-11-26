import SwiftUI

/// Text with **bold** and LaTeX formulas, the native counterpart of the site's MathText.
/// Formulas are shown in a serif face so they read as math; a formula on its own line gets its own line.
struct MathText: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Self.build(text)
    }

    static func build(_ text: String) -> Text {
        var result = Text("")
        for part in TeX.split(text) {
            switch part {
            case let .text(value):
                result = result + markdown(value)
            case let .math(value, display):
                let formula = Text(TeX.toUnicode(value)).fontDesign(.serif)
                result = display ? result + Text("\n") + formula + Text("\n") : result + formula
            }
        }
        return result
    }

    private static func markdown(_ value: String) -> Text {
        let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        if let attributed = try? AttributedString(markdown: value, options: options) { return Text(attributed) }
        return Text(value)
    }
}
