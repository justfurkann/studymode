import Compression
import Foundation

/// Text of Office files, the same rules as the site's src/lib/officeText.ts: a .docx is one paragraph
/// per line; a .pptx is "Slayt N" and the slide's text, then its speaker notes. Excel (.xlsx) is extra
/// in the app: each sheet's rows, cells separated by " · ".
/// Office files are zip archives; this reads only the parts it needs and refuses huge ones.
enum OfficeText {
    struct Failure: LocalizedError {
        let errorDescription: String?
        init(_ text: String) { errorDescription = text }
    }

    static let maxUnpackedBytes = 60 * 1024 * 1024

    static func read(_ url: URL) throws -> String {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        switch url.pathExtension.lowercased() {
        case "docx": return try docx(data)
        case "pptx": return try pptx(data)
        case "xlsx": return try xlsx(data)
        default: throw Failure("Bu dosya türü okunamıyor.")
        }
    }

    // MARK: Word

    static func docx(_ data: Data) throws -> String {
        let files = try Zip.entries(data) { $0 == "word/document.xml" }
        guard let xml = files["word/document.xml"] else {
            throw Failure("Bu bir Word (.docx) belgesine benzemiyor. Dosyayı Word’de açıp .docx ya da PDF olarak yeniden kaydet.")
        }
        return paragraphs(String(decoding: xml, as: UTF8.self), ns: "w").joined(separator: "\n")
    }

    // MARK: PowerPoint

    static func pptx(_ data: Data) throws -> String {
        let files = try Zip.entries(data) { $0.range(of: #"^ppt/(slides|notesSlides)/(_rels/)?\w+\d+\.xml(\.rels)?$"#, options: .regularExpression) != nil }
        let slides = files.keys
            .filter { $0.range(of: #"^ppt/slides/slide\d+\.xml$"#, options: .regularExpression) != nil }
            .sorted { number($0) < number($1) }
        guard !slides.isEmpty else {
            throw Failure("Bu bir PowerPoint (.pptx) sunumuna benzemiyor. Dosyayı .pptx ya da PDF olarak yeniden kaydet.")
        }
        return slides.enumerated().compactMap { index, name -> String? in
            let lines = paragraphs(String(decoding: files[name]!, as: UTF8.self), ns: "a")
            // Notes are linked from the slide's relationship file, not by number.
            let relsName = name.replacingOccurrences(of: "slides/", with: "slides/_rels/") + ".rels"
            var notes: [String] = []
            if let rels = files[relsName].map({ String(decoding: $0, as: UTF8.self) }),
               let match = rels.range(of: #"Target="\.\./notesSlides/(notesSlide\d+\.xml)""#, options: .regularExpression) {
                let target = rels[match].replacingOccurrences(of: #"Target="../notesSlides/"#, with: "").dropLast()
                if let xml = files["ppt/notesSlides/\(target)"] {
                    // Notes pages repeat the slide number as a placeholder; drop bare numbers.
                    notes = paragraphs(String(decoding: xml, as: UTF8.self), ns: "a").filter { Int($0) == nil }
                }
            }
            var parts = ["Slayt \(index + 1)"] + lines
            if !notes.isEmpty { parts.append("Konuşmacı notları: " + notes.joined(separator: " ")) }
            return parts.count > 1 ? parts.joined(separator: "\n") : nil
        }
        .joined(separator: "\n\n")
    }

    // MARK: Excel

    static func xlsx(_ data: Data) throws -> String {
        let files = try Zip.entries(data) {
            $0 == "xl/sharedStrings.xml" || $0 == "xl/workbook.xml" || $0.range(of: #"^xl/worksheets/sheet\d+\.xml$"#, options: .regularExpression) != nil
        }
        let sheets = files.keys.filter { $0.hasPrefix("xl/worksheets/") }.sorted { number($0) < number($1) }
        guard !sheets.isEmpty else {
            throw Failure("Bu bir Excel (.xlsx) dosyasına benzemiyor. Dosyayı .xlsx ya da PDF olarak yeniden kaydet.")
        }
        let shared: [String] = files["xl/sharedStrings.xml"].map { xml in
            String(decoding: xml, as: UTF8.self).components(separatedBy: "</si>").dropLast().map { item in
                matches(#"<t(?:\s[^>]*)?>([^<]*)</t>"#, in: item).joined()
            }
        } ?? []
        let names = files["xl/workbook.xml"].map { matches(#"<sheet [^>]*name="([^"]*)""#, in: String(decoding: $0, as: UTF8.self)) } ?? []

        return sheets.enumerated().compactMap { index, name -> String? in
            let xml = String(decoding: files[name]!, as: UTF8.self)
            let rows = xml.components(separatedBy: "</row>").compactMap { row -> String? in
                let cells = row.components(separatedBy: "</c>").compactMap { cell -> String? in
                    guard let open = cell.range(of: "<c ") ?? cell.range(of: "<c>") else { return nil }
                    let c = String(cell[open.lowerBound...])
                    let type = matches(#"<c [^>]*t="(\w+)""#, in: c).first
                    let value: String
                    if type == "inlineStr" {
                        value = matches(#"<t(?:\s[^>]*)?>([^<]*)</t>"#, in: c).joined()
                    } else if let v = matches(#"<v>([^<]*)</v>"#, in: c).first {
                        value = type == "s" ? (Int(v).flatMap { shared.indices.contains($0) ? shared[$0] : nil } ?? "") : v
                    } else {
                        return nil
                    }
                    let text = decode(value).trimmingCharacters(in: .whitespacesAndNewlines)
                    return text.isEmpty ? nil : text
                }
                return cells.isEmpty ? nil : cells.joined(separator: " · ")
            }
            guard !rows.isEmpty else { return nil }
            let title = names.indices.contains(index) ? decode(names[index]) : "Sayfa \(index + 1)"
            return ([title] + rows).joined(separator: "\n")
        }
        .joined(separator: "\n\n")
    }

    // MARK: XML helpers

    /// Text of each paragraph (`<w:p>` / `<a:p>`), keeping tabs and line breaks inside it.
    static func paragraphs(_ xml: String, ns: String) -> [String] {
        let pattern = "<\(ns):t(?:\\s[^>]*)?>([^<]*)</\(ns):t>|<\(ns):tab/>|<\(ns):br(?:\\s[^>]*)?/>"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        return xml.components(separatedBy: "</\(ns):p>").compactMap { chunk in
            var line = ""
            let range = NSRange(chunk.startIndex..., in: chunk)
            for match in regex.matches(in: chunk, range: range) {
                if let r = Range(match.range(at: 1), in: chunk) {
                    line += decode(String(chunk[r]))
                } else if let r = Range(match.range, in: chunk) {
                    line += chunk[r].contains(":tab") ? "\t" : "\n"
                }
            }
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        }
    }

    static func decode(_ text: String) -> String {
        var s = text
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&apos;", with: "'")
        for (pattern, radix) in [(#"&#x([0-9a-fA-F]+);"#, 16), (#"&#(\d+);"#, 10)] {
            while let r = s.range(of: pattern, options: .regularExpression) {
                let digits = s[r].dropFirst(radix == 16 ? 3 : 2).dropLast()
                let scalar = UInt32(digits, radix: radix).flatMap(Unicode.Scalar.init).map(String.init) ?? ""
                s.replaceSubrange(r, with: scalar)
            }
        }
        return s.replacingOccurrences(of: "&amp;", with: "&")
    }

    private static func matches(_ pattern: String, in text: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        return regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap {
            Range($0.range(at: 1), in: text).map { String(text[$0]) }
        }
    }

    private static func number(_ name: String) -> Int {
        Int(name.replacingOccurrences(of: #"^.*?(\d+)\.xml$"#, with: "$1", options: .regularExpression)) ?? 0
    }
}

/// Minimal ZIP reader: the central directory, then stored or deflated entries (all Office files use these).
private enum Zip {
    static func entries(_ data: Data, wanted: (String) -> Bool) throws -> [String: Data] {
        let bytes = [UInt8](data)
        func u16(_ i: Int) -> Int { i + 1 < bytes.count ? Int(bytes[i]) | Int(bytes[i + 1]) << 8 : 0 }
        func u32(_ i: Int) -> Int { u16(i) | u16(i + 2) << 16 }
        let broken = OfficeText.Failure("Dosya açılamadı. Bozuk olmadığını kontrol et ya da PDF olarak kaydedip yükle.")

        // End of central directory: signature 0x06054b50 within the last 64 KB.
        guard bytes.count > 22 else { throw broken }
        var end = -1
        for i in stride(from: bytes.count - 22, through: max(0, bytes.count - 65_557), by: -1) where u32(i) == 0x0605_4b50 {
            end = i
            break
        }
        guard end >= 0 else { throw broken }
        let count = u16(end + 10)
        var at = u32(end + 16)
        var out: [String: Data] = [:]
        var unpacked = 0

        for _ in 0..<count {
            guard u32(at) == 0x0201_4b50 else { throw broken }
            let method = u16(at + 10)
            let packed = u32(at + 20)
            let size = u32(at + 24)
            let nameLength = u16(at + 28), extra = u16(at + 30), comment = u16(at + 32)
            let local = u32(at + 42)
            guard at + 46 + nameLength <= bytes.count else { throw broken }
            let name = String(decoding: bytes[(at + 46)..<(at + 46 + nameLength)], as: UTF8.self)
            at += 46 + nameLength + extra + comment

            guard wanted(name) else { continue }
            unpacked += size
            if unpacked > OfficeText.maxUnpackedBytes {
                throw OfficeText.Failure("Dosyanın içeriği çok büyük. Daha küçük bir bölümünü yükle.")
            }
            guard u32(local) == 0x0403_4b50 else { throw broken }
            let start = local + 30 + u16(local + 26) + u16(local + 28)
            guard start + packed <= bytes.count else { throw broken }
            let body = Array(bytes[start..<(start + packed)])
            switch method {
            case 0: out[name] = Data(body)
            case 8: out[name] = try inflate(body, size: size, broken: broken)
            default: throw broken
            }
        }
        return out
    }

    /// Raw DEFLATE (what ZIP stores); Apple's COMPRESSION_ZLIB is raw deflate without a header.
    private static func inflate(_ input: [UInt8], size: Int, broken: Error) throws -> Data {
        guard size > 0 else { return Data() }
        guard !input.isEmpty else { throw broken }
        var output = [UInt8](repeating: 0, count: size)
        let written = input.withUnsafeBufferPointer { src in
            output.withUnsafeMutableBufferPointer { dst in
                compression_decode_buffer(dst.baseAddress!, size, src.baseAddress!, input.count, nil, COMPRESSION_ZLIB)
            }
        }
        guard written == size else { throw broken }
        return Data(output)
    }
}
