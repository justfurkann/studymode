import SwiftUI
import UIKit

// Ways into Fosfor from inside a note. Each sends the exact passage, where it sits ("Ana nokta 3",
// "Tam özet · Bölüm 2") and the note, so Fosfor knows the course, the note and the text without
// the student typing anything (the site's "select text → Fosfor'a sor").

// MARK: - "Anlamadım" chip

/// Under a key term or a point: one tap and Fosfor explains this passage more simply, half height
/// over the note. Other ways (with an example, step by step) are one tap away in Fosfor.
/// (Replaces the old inline explainer box, which lived apart from Fosfor.)
struct ConceptExplainer: View {
    @Environment(AssistantPlace.self) private var place: AssistantPlace?
    let note: NoteItem
    let topic: String
    var compact = false
    var source: String? = nil

    var body: some View {
        Button {
            OnboardingHaptics.light()
            place?.ask(FosforAsk(quote: topic, source: source), course: note.courseId, note: note.id)
        } label: {
            // The yellow chip says "Fosfor" on its own; no mascot inside it.
            Text("Anlamadım")
                .font((compact ? Font.caption : .subheadline).weight(.bold))
                .foregroundStyle(Theme.text)
            .padding(.horizontal, 12)
            .padding(.vertical, compact ? 4 : 6)
            .background(Theme.hiSoft, in: Capsule())
            .overlay(Capsule().stroke(Theme.hi, lineWidth: 1))
            .frame(minHeight: 36)
            .contentShape(Capsule())
        }
        .buttonStyle(TactileCardButtonStyle(scale: 0.95))
        .accessibilityLabel("Anlamadım, Fosfor'a sor")
    }
}

// MARK: - Long press

private struct AskFosforMenu: ViewModifier {
    @Environment(AssistantPlace.self) private var place: AssistantPlace?
    let text: String
    let source: String?
    let note: NoteItem
    var prompt: String? = nil

    func body(content: Content) -> some View {
        content.contextMenu {
            if let place {
                Button {
                    place.ask(FosforAsk(quote: text, source: source, prompt: prompt), course: note.courseId, note: note.id)
                } label: {
                    Label(prompt == nil ? "Anlamadım, Fosfor'a sor" : "Fosfor'a sor", systemImage: "questionmark.bubble")
                }
                if prompt == nil {
                    Button {
                        place.ask(FosforAsk(quote: text, source: source, mode: .example), course: note.courseId, note: note.id)
                    } label: {
                        Label("Örnekle anlat", systemImage: "lightbulb")
                    }
                    Button {
                        place.ask(FosforAsk(quote: text, source: source, mode: .step_by_step), course: note.courseId, note: note.id)
                    } label: {
                        Label("Adım adım anlat", systemImage: "list.number")
                    }
                }
                Divider()
            }
            Button {
                UIPasteboard.general.string = text
            } label: {
                Label("Kopyala", systemImage: "doc.on.doc")
            }
        }
    }
}

extension View {
    /// Long press anywhere on this to send `text` to Fosfor (or copy it).
    func askFosfor(_ text: String, source: String?, note: NoteItem, prompt: String? = nil) -> some View {
        modifier(AskFosforMenu(text: text, source: source, note: note, prompt: prompt))
    }
}

// MARK: - Selectable text

/// Note text the student can select freely; the edit menu gets "Fosfor'a sor" first. Formulas are
/// drawn the same way as MathText (TeX → Unicode), **bold** stays bold.
struct SelectableNoteText: UIViewRepresentable {
    let text: String
    var style: UIFont.TextStyle = .body
    /// Long text (Kaynak metin) scrolls inside the view; summary paragraphs size to fit instead.
    var scrolls = false
    let onAsk: (String) -> Void

    @Environment(\.dynamicTypeSize) private var dynamicType

    func makeCoordinator() -> Coordinator { Coordinator(onAsk: onAsk) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = scrolls
        view.backgroundColor = .clear
        view.textContainerInset = scrolls ? UIEdgeInsets(top: 8, left: 16, bottom: 40, right: 16) : .zero
        view.textContainer.lineFragmentPadding = 0
        view.adjustsFontForContentSizeCategory = true
        view.tintColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xFFE14D) : UIColor(hex: 0x1B2250) }
        view.delegate = context.coordinator
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.onAsk = onAsk
        let rendered = Self.attributed(text, style: style)
        if view.attributedText != rendered { view.attributedText = rendered }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard !scrolls else { return nil }
        let width = proposal.width ?? UIScreen.main.bounds.width - 32
        let size = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(size.height))
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var onAsk: (String) -> Void
        init(onAsk: @escaping (String) -> Void) { self.onAsk = onAsk }

        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            guard range.length > 0 else { return UIMenu(children: suggestedActions) }
            let picked = (textView.text as NSString).substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !picked.isEmpty else { return UIMenu(children: suggestedActions) }
            let ask = UIAction(title: "Fosfor'a sor", image: UIImage(systemName: "questionmark.bubble")) { [weak self, weak textView] _ in
                textView?.selectedTextRange = nil
                self?.onAsk(String(picked.prefix(1_200)))
            }
            return UIMenu(children: [ask] + suggestedActions)
        }
    }

    /// MathText's rendering as an attributed string for UIKit.
    static func attributed(_ text: String, style: UIFont.TextStyle) -> NSAttributedString {
        let base = UIFont.preferredFont(forTextStyle: style)
        let bold = UIFont(descriptor: base.fontDescriptor.withSymbolicTraits(.traitBold) ?? base.fontDescriptor, size: 0)
        let serif = UIFont(descriptor: base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor, size: 0)
        let ink = UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: 0xF4F3EA) : UIColor(hex: 0x1B2250) }
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 3
        let attrs: [NSAttributedString.Key: Any] = [.font: base, .foregroundColor: ink, .paragraphStyle: paragraph]

        let out = NSMutableAttributedString()
        for part in TeX.split(text) {
            switch part {
            case let .text(value):
                let options = AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
                guard let parsed = try? AttributedString(markdown: value, options: options) else {
                    out.append(NSAttributedString(string: value, attributes: attrs))
                    continue
                }
                for run in parsed.runs {
                    var runAttrs = attrs
                    if let intent = run.inlinePresentationIntent, intent.contains(.stronglyEmphasized) { runAttrs[.font] = bold }
                    out.append(NSAttributedString(string: String(parsed[run.range].characters), attributes: runAttrs))
                }
            case let .math(value, display):
                var mathAttrs = attrs
                mathAttrs[.font] = serif
                let formula = TeX.toUnicode(value)
                out.append(NSAttributedString(string: display ? "\n\(formula)\n" : formula, attributes: mathAttrs))
            }
        }
        return out
    }
}
