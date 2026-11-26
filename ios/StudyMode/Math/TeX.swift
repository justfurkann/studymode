import Foundation

/// Study text with LaTeX in it, split the way the site does (src/lib/mathText.ts):
/// $$...$$ or \[...\] on their own line, $...$ or \(...\) inside a sentence. A lone dollar ("5 $") stays text.
enum MathPart: Equatable {
    case text(String)
    case math(String, display: Bool)
}

enum TeX {
    private static let pattern = try! NSRegularExpression(
        pattern: #"\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$"#
    )

    static func hasMath(_ text: String) -> Bool {
        pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    static func split(_ text: String) -> [MathPart] {
        var parts: [MathPart] = []
        var last = text.startIndex
        for match in pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let whole = Range(match.range, in: text) else { continue }
            if whole.lowerBound > last { parts.append(.text(String(text[last..<whole.lowerBound]))) }
            var body = ""
            var group = 0
            for i in 1...4 {
                if let r = Range(match.range(at: i), in: text) { body = String(text[r]); group = i; break }
            }
            let value = repairEscapes(body.trimmingCharacters(in: .whitespacesAndNewlines))
            if !value.isEmpty { parts.append(.math(value, display: group <= 2)) }
            last = whole.upperBound
        }
        if last < text.endIndex { parts.append(.text(String(text[last...]))) }
        return parts
    }

    /// A LaTeX command whose backslash was read as a JSON escape ("\frac" arrives as form feed + "rac").
    static func repairEscapes(_ tex: String) -> String {
        tex.replacingOccurrences(of: "\u{0C}", with: "\\f")
            .replacingOccurrences(of: "\u{08}", with: "\\b")
            .replacingOccurrences(of: "\t", with: "\\t")
            .replacingOccurrences(of: "\r", with: "\\r")
    }

    /// The whole text with every formula turned into readable Unicode.
    static func plain(_ text: String) -> String {
        split(text).map { part in
            switch part {
            case let .text(value): value
            case let .math(value, _): toUnicode(value)
            }
        }.joined()
    }

    // MARK: - LaTeX → Unicode

    /// Draws common school and university math with plain characters: ½-style fractions become a/b,
    /// exponents and indices become ² and ₂ where Unicode has them, \mathbb{R} becomes ℝ.
    /// Anything it does not know is shown without the backslash, so nothing is hidden.
    static func toUnicode(_ tex: String) -> String {
        var parser = Parser(Array(tex))
        return parser.parse(until: nil)
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespaces)
    }

    private struct Parser {
        let chars: [Character]
        var i = 0
        init(_ chars: [Character]) { self.chars = chars }

        mutating func parse(until close: Character?) -> String {
            var out = ""
            while i < chars.count {
                let c = chars[i]
                if let close, c == close { i += 1; return out }
                switch c {
                case "\\":
                    out += command()
                case "{":
                    i += 1
                    out += parse(until: "}")
                case "}":
                    i += 1
                case "^":
                    i += 1
                    out += script(superscripts, fallback: "^")
                case "_":
                    i += 1
                    out += script(subscripts, fallback: "_")
                case "&":
                    i += 1
                    out += " "
                case "~":
                    i += 1
                    out += " "
                default:
                    i += 1
                    out.append(c)
                }
            }
            return out
        }

        /// One argument: {group} or a single character / command.
        mutating func argument() -> String {
            skipSpaces()
            guard i < chars.count else { return "" }
            if chars[i] == "{" { i += 1; return parse(until: "}") }
            if chars[i] == "\\" { return command() }
            defer { i += 1 }
            return String(chars[i])
        }

        mutating func optionalArgument() -> String? {
            skipSpaces()
            guard i < chars.count, chars[i] == "[" else { return nil }
            i += 1
            return parse(until: "]")
        }

        mutating func skipSpaces() {
            while i < chars.count, chars[i] == " " { i += 1 }
        }

        mutating func script(_ table: [Character: Character], fallback: String) -> String {
            let body = argument()
            if body == "\\circ" || body == "∘" { return "°" }
            let mapped = body.compactMap { table[$0] }
            if !body.isEmpty, mapped.count == body.count { return String(mapped) }
            return body.count == 1 ? fallback + body : "\(fallback)(\(body))"
        }

        mutating func command() -> String {
            i += 1 // backslash
            guard i < chars.count else { return "" }
            // \\ line break, \{ \} \% \, \; \! and other one-character commands
            if !chars[i].isLetter {
                let c = chars[i]
                i += 1
                switch c {
                case "\\": return "\n"
                case ",", ";", ":", " ", "!": return c == "!" ? "" : " "
                default: return String(c)
                }
            }
            var name = ""
            while i < chars.count, chars[i].isLetter { name.append(chars[i]); i += 1 }

            switch name {
            case "frac", "dfrac", "tfrac":
                let top = argument(), bottom = argument()
                return "\(wrap(top))/\(wrap(bottom))"
            case "sqrt":
                let index = optionalArgument()
                let body = argument()
                let root = index.map { idx in String(idx.compactMap { superscripts[$0] }) + "√" } ?? "√"
                return root + wrap(body)
            case "mathbb":
                let body = argument()
                return String(body.map { blackboard[$0] ?? $0 })
            case "text", "mathrm", "mathbf", "mathit", "textbf", "textit", "operatorname", "mathcal", "boldsymbol":
                return argument()
            case "overline", "bar":
                return argument().map { "\($0)\u{0305}" }.joined()
            case "vec":
                return argument() + "\u{20D7}"
            case "hat":
                return argument() + "\u{0302}"
            case "left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "limits", "nolimits":
                return ""
            case "begin", "end":
                _ = argument() // environment name; rows still read with & and \\
                return ""
            case "hline", "cline", "quad", "qquad":
                if name == "cline" { _ = argument() }
                return " "
            default:
                if let symbol = symbols[name] { return symbol }
                // \sin, \log… and unknown commands: the name itself (the source's own space follows it).
                return name
            }
        }

        /// a/b needs no brackets; (x+1)/(x-1) does.
        func wrap(_ s: String) -> String {
            let t = s.trimmingCharacters(in: .whitespaces)
            let simple = t.allSatisfy { $0.isLetter || $0.isNumber || $0 == "," || $0 == "." || superscripts.values.contains($0) || subscripts.values.contains($0) }
            return simple ? t : "(\(t))"
        }
    }

    private static let blackboard: [Character: Character] = ["N": "ℕ", "Z": "ℤ", "Q": "ℚ", "R": "ℝ", "C": "ℂ", "P": "ℙ", "I": "𝕀"]

    private static let superscripts: [Character: Character] = [
        "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
        "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ", "x": "ˣ", "y": "ʸ",
        "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "k": "ᵏ", "m": "ᵐ", "t": "ᵗ", "T": "ᵀ", "*": "*", "′": "′", "'": "′",
    ]

    private static let subscripts: [Character: Character] = [
        "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
        "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", "a": "ₐ", "e": "ₑ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ",
        "m": "ₘ", "n": "ₙ", "o": "ₒ", "x": "ₓ", "t": "ₜ", "r": "ᵣ", "s": "ₛ", "p": "ₚ",
    ]

    private static let symbols: [String: String] = [
        // operators and relations
        "cdot": "·", "times": "×", "div": "÷", "pm": "±", "mp": "∓", "ast": "∗",
        "le": "≤", "leq": "≤", "ge": "≥", "geq": "≥", "neq": "≠", "ne": "≠", "approx": "≈", "equiv": "≡",
        "sim": "∼", "simeq": "≃", "cong": "≅", "propto": "∝", "ll": "≪", "gg": "≫",
        "in": "∈", "notin": "∉", "ni": "∋", "subset": "⊂", "subseteq": "⊆", "supset": "⊃", "supseteq": "⊇",
        "cup": "∪", "cap": "∩", "setminus": "∖", "emptyset": "∅", "varnothing": "∅", "forall": "∀", "exists": "∃",
        "neg": "¬", "lnot": "¬", "land": "∧", "wedge": "∧", "lor": "∨", "vee": "∨", "oplus": "⊕",
        "to": "→", "rightarrow": "→", "leftarrow": "←", "Rightarrow": "⇒", "Leftarrow": "⇐", "implies": "⇒",
        "leftrightarrow": "↔", "Leftrightarrow": "⇔", "iff": "⇔", "mapsto": "↦", "uparrow": "↑", "downarrow": "↓",
        "infty": "∞", "partial": "∂", "nabla": "∇", "sum": "Σ", "prod": "Π", "int": "∫", "iint": "∬", "oint": "∮",
        "circ": "∘", "degree": "°", "angle": "∠", "triangle": "△", "perp": "⊥", "parallel": "∥", "mid": "|",
        "ldots": "…", "cdots": "⋯", "dots": "…", "vdots": "⋮", "prime": "′", "lfloor": "⌊", "rfloor": "⌋",
        "lceil": "⌈", "rceil": "⌉", "langle": "⟨", "rangle": "⟩", "vert": "|", "Vert": "‖", "lvert": "|", "rvert": "|",
        "%": "%", "therefore": "∴", "because": "∵", "hbar": "ħ", "ell": "ℓ", "Re": "ℜ", "Im": "ℑ",
        // greek
        "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "epsilon": "ε", "varepsilon": "ε", "zeta": "ζ",
        "eta": "η", "theta": "θ", "vartheta": "ϑ", "iota": "ι", "kappa": "κ", "lambda": "λ", "mu": "μ", "nu": "ν",
        "xi": "ξ", "pi": "π", "rho": "ρ", "sigma": "σ", "tau": "τ", "upsilon": "υ", "phi": "φ", "varphi": "φ",
        "chi": "χ", "psi": "ψ", "omega": "ω", "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Xi": "Ξ",
        "Pi": "Π", "Sigma": "Σ", "Phi": "Φ", "Psi": "Ψ", "Omega": "Ω",
    ]
}
