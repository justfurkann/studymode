import CoreGraphics
import Foundation
import PDFKit

/// The site's src/lib/mathPages.ts, rule for rule.
///
/// PDF pages written with an equation editor (Word, MathType…) have a text layer that breaks the
/// math: ℕ ℤ ℚ ℝ come out as ¥ ¢ ¤ ¡, a fraction a/b comes out as "a" and "b" on separate lines,
/// superscripts are lost (10² becomes "102"). A summary made from that text gets the formulas wrong.
/// Such pages are better read as pictures by the AI, which writes the math properly (LaTeX).
enum MathPages {
    struct Signals: Equatable {
        var garbled = 0
        var symbols = 0
        var lines = 0
        /// Lines with almost nothing on them: a numerator, a denominator, a lone exponent.
        var shortLines = 0
        /// Lines with =, < or >.
        var relationLines = 0
        /// Exponents that fell off their base: "x 3 – y 3", "sin 2 a".
        var lostExponents = 0
    }

    /// Symbol-font letters that stand for ℕ ℤ ℚ ℝ ∈ in these PDFs.
    private static let garbled = Set("¥¢¤¡¿")
    private static let mathSymbols = Set("∈∉≠≤≥±√∑∫∏∪∩⇔⇒→←∞π×÷∀∃⊂⊆∅∆∂αβγθλμσφω")
    private static let lostExponent = try! NSRegularExpression(pattern: #"(?:\b[a-zA-Z]|\))\s[2-9](?=\s*[-–+=)]|\s+[a-z]\b)"#)

    static func signals(_ text: String) -> Signals {
        let lines = text.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        var s = Signals()
        s.garbled = text.filter { garbled.contains($0) }.count
        s.symbols = text.filter { mathSymbols.contains($0) }.count
        s.lines = lines.count
        s.shortLines = lines.filter { line in
            let compact = line.filter { !$0.isWhitespace }
            return !compact.isEmpty && compact.count <= 5 && compact.contains { $0.isASCII && ($0.isLetter || $0.isNumber) }
        }.count
        s.relationLines = lines.filter { $0.contains { "=<>≤≥".contains($0) } }.count
        s.lostExponents = lostExponent.numberOfMatches(in: text, range: NSRange(text.startIndex..., in: text))
        return s
    }

    /// True when the page's own text would lose its math, so the page should be read as a picture.
    static func looksLikeBrokenMath(_ text: String) -> Bool {
        let s = signals(text)
        if s.lines < 3 { return false }
        if s.garbled >= 2 { return true }
        // Stacked fractions leave many very short lines next to equations.
        if s.relationLines >= 3 && s.shortLines >= 3 && Double(s.shortLines) / Double(s.lines) >= 0.12 { return true }
        if s.lostExponents >= 2 && s.relationLines >= 1 { return true }
        // Dense formulas: many math symbols and equations on one page.
        return s.symbols >= 10 && s.relationLines >= 4
    }

    /// True when it is worth counting pictures: the text alone already says the document is math-heavy.
    static func mathHeavy(_ texts: [String]) -> Bool {
        let textPages = texts.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let math = textPages.filter(looksLikeBrokenMath).count
        return math >= 2 && Double(math) >= Double(textPages.count) * 0.3
    }

    /// Which pages to read as pictures (0-based here):
    /// - pages with no text (scanned);
    /// - pages whose text breaks the math;
    /// - in a math-heavy document (at least 30% of its text pages break the math), also pages with
    ///   figures (more pictures than the page's logo), so diagrams and graphs are described.
    /// `figures[i]` is how many pictures page i draws; nil when it was not counted.
    static func pagesToReadAsPictures(_ texts: [String], figures: [Int?] = []) -> [Int] {
        let hasText = texts.map { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        let math = Set(texts.indices.filter { hasText[$0] && looksLikeBrokenMath(texts[$0]) })
        let textPages = hasText.filter { $0 }.count
        let heavy = math.count >= 2 && Double(math.count) >= Double(textPages) * 0.3
        // The fewest pictures on any page is the page furniture (a logo on every page).
        let furniture = figures.compactMap { $0 }.min() ?? 0
        return texts.indices.filter { i in
            if !hasText[i] { return true }
            if math.contains(i) { return true }
            guard heavy, figures.indices.contains(i), let f = figures[i] else { return false }
            return f > furniture
        }
    }

    private static let setLetters: [Character: (latex: String, plain: String)] = [
        "¥": ("N", "ℕ"), "¢": ("Z", "ℤ"), "¤": ("Q", "ℚ"), "¡": ("R", "ℝ"),
    ]

    /// In a math-heavy document, puts ℕ ℤ ℚ ℝ back where the PDF's symbol font left ¥ ¢ ¤ ¡:
    /// \mathbb{N} inside a formula ($…$ or $$…$$), ℕ in plain text.
    static func fixSymbolFont(_ text: String) -> String {
        guard let formula = try? NSRegularExpression(pattern: #"\$\$[\s\S]+?\$\$|\$[^$\n]+?\$"#) else { return text }
        var out = ""
        var last = text.startIndex
        func plain(_ s: Substring) -> String {
            String(s.map { c in setLetters[c].map { Character($0.plain) } ?? c })
        }
        for match in formula.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let r = Range(match.range, in: text) else { continue }
            out += plain(text[last..<r.lowerBound])
            out += text[r].map { c in setLetters[c].map { "\\mathbb{\($0.latex)}" } ?? String(c) }.joined()
            last = r.upperBound
        }
        return out + plain(text[last...])
    }

    /// The page's text one visual line per line, as pdf.js gives it on the site. PDFKit's `string`
    /// and its line selections sometimes run several lines together, so lines are split where the
    /// characters' vertical position jumps. nil when the page has no text.
    static func lines(of page: PDFPage) -> String? {
        guard let text = page.string, !text.isEmpty else { return nil }
        let units = text as NSString
        var lines: [String] = []
        var current = ""
        var lastMid: CGFloat?
        func flush() {
            let line = current.trimmingCharacters(in: .whitespaces)
            if !line.isEmpty { lines.append(line) }
            current = ""
            lastMid = nil
        }
        var i = 0
        while i < units.length {
            let range = units.rangeOfComposedCharacterSequence(at: i)
            let piece = units.substring(with: range)
            i = range.location + range.length
            if piece == "\n" || piece == "\r" || piece == "\r\n" { flush(); continue }
            let box = page.characterBounds(at: range.location)
            if box.height > 0, !piece.allSatisfy(\.isWhitespace) {
                if let lastMid, abs(box.midY - lastMid) > max(box.height * 0.6, 2) { flush() }
                lastMid = box.midY
            }
            current += piece
        }
        flush()
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

    // MARK: Pictures on a page

    /// How many images a PDF page draws (XObject images). nil when the page cannot be scanned.
    static func figureCount(_ page: CGPDFPage) -> Int? {
        guard let table = CGPDFOperatorTableCreate() else { return nil }
        defer { CGPDFOperatorTableRelease(table) }
        CGPDFOperatorTableSetCallback(table, "Do") { scanner, info in
            var name: UnsafePointer<CChar>?
            guard let info, CGPDFScannerPopName(scanner, &name), let name else { return }
            let content = CGPDFScannerGetContentStream(scanner)
            guard let object = CGPDFContentStreamGetResource(content, "XObject", name) else { return }
            var stream: CGPDFStreamRef?
            guard CGPDFObjectGetValue(object, .stream, &stream), let stream,
                  let dictionary = CGPDFStreamGetDictionary(stream) else { return }
            var subtype: UnsafePointer<CChar>?
            if CGPDFDictionaryGetName(dictionary, "Subtype", &subtype), let subtype, String(cString: subtype) == "Image" {
                info.assumingMemoryBound(to: Int.self).pointee += 1
            }
        }
        var count = 0
        let content = CGPDFContentStreamCreateWithPage(page)
        defer { CGPDFContentStreamRelease(content) }
        let ok = withUnsafeMutablePointer(to: &count) { pointer -> Bool in
            let scanner = CGPDFScannerCreate(content, table, pointer)
            defer { CGPDFScannerRelease(scanner) }
            return CGPDFScannerScan(scanner)
        }
        return ok ? count : nil
    }
}
