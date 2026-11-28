import Foundation
import Supabase
import UIKit

// MARK: - Concept Map (matches src/lib/visualTools.ts)

struct ConceptNode: Identifiable, Hashable {
    let id: String
    let label: String
    let detail: String
    let relation: String
}

struct ConceptDiagram {
    let title: String
    let centralTopic: String
    let centralSummary: String
    let nodes: [ConceptNode]

    static func build(note: NoteItem, summary: NoteSummary?, content: String = "") -> ConceptDiagram {
        let centralTopic = note.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Ana Konu" : note.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let rawSummary = summary?.overview.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? summary?.points.first?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? "Notun temel kavramları ve birbirleriyle ilişkisi."
        let centralSummary = String(rawSummary.prefix(140))

        var raw: [(label: String, detail: String, relation: String)] = []

        for kt in (summary?.keyTerms ?? []).prefix(6) {
            raw.append((kt.term, kt.definition, "Temel kavram"))
        }

        if raw.count < 4 {
            for pt in (summary?.points ?? []).prefix(6 - raw.count) {
                let words = pt.split(whereSeparator: \.isWhitespace).prefix(3).joined(separator: " ")
                    .trimmingCharacters(in: CharacterSet(charactersIn: ".,:;!?"))
                raw.append((words.isEmpty ? "Madde \(raw.count + 1)" : words, pt, "Ana nokta"))
            }
        }

        if raw.isEmpty, !content.isEmpty {
            let lines = content.components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { $0.count > 10 }
                .prefix(5)
            for (idx, line) in lines.enumerated() {
                if let colon = line.firstIndex(of: ":"), line.distance(from: line.startIndex, to: colon) > 0, line.distance(from: line.startIndex, to: colon) < 30 {
                    let k = String(line[..<colon]).trimmingCharacters(in: .whitespaces)
                    let v = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
                    raw.append((k, v.isEmpty ? line : v, "Adım \(idx + 1)"))
                } else {
                    raw.append(("Kavram \(idx + 1)", line, "Adım \(idx + 1)"))
                }
            }
        }

        let nodes = raw.prefix(6).enumerated().map { idx, item in
            let clipped = item.label.count > 28 ? String(item.label.prefix(26)) + "…" : item.label
            return ConceptNode(id: "node-\(idx + 1)", label: clipped, detail: item.detail, relation: item.relation)
        }

        return ConceptDiagram(
            title: "\(centralTopic) · Kavram Haritası",
            centralTopic: centralTopic,
            centralSummary: centralSummary,
            nodes: nodes
        )
    }
}

// MARK: - Stored Visual Items (Application Support/<userId>/visuals/<noteId>/)

enum VisualAspectRatio: String, CaseIterable, Identifiable {
    case widescreen = "16:9"
    case standard = "4:3"
    case square = "1:1"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .widescreen: "16:9 Yatay"
        case .standard: "4:3 Klasik"
        case .square: "1:1 Kare"
        }
    }
}

struct GeneratedVisual: Identifiable, Codable, Hashable {
    enum Kind: String, Codable {
        case aiImage = "ai_image"
        case poster = "poster"
    }

    let id: String
    let title: String
    let prompt: String
    let caption: String
    let kind: Kind
    let fileName: String
    let createdAt: String
}

enum VisualStorage {
    static let maxPerNote = 8

    static func directory(user: UUID?, note: UUID) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let userDir = user?.uuidString.lowercased() ?? "guest"
        let dir = base.appending(path: "StudyMode", directoryHint: .isDirectory)
            .appending(path: userDir, directoryHint: .isDirectory)
            .appending(path: "visuals", directoryHint: .isDirectory)
            .appending(path: note.uuidString.lowercased(), directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func fileURL(for item: GeneratedVisual, user: UUID?, note: UUID) -> URL {
        directory(user: user, note: note).appending(path: item.fileName)
    }

    static func load(user: UUID?, note: UUID) -> [GeneratedVisual] {
        let indexURL = directory(user: user, note: note).appending(path: "index.json")
        guard let data = try? Data(contentsOf: indexURL),
              let items = try? JSONDecoder().decode([GeneratedVisual].self, from: data) else {
            return []
        }
        return items.filter { FileManager.default.fileExists(atPath: fileURL(for: $0, user: user, note: note).path) }
    }

    static func image(for item: GeneratedVisual, user: UUID?, note: UUID) -> UIImage? {
        let url = fileURL(for: item, user: user, note: note)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    @discardableResult
    static func append(
        title: String,
        prompt: String,
        caption: String,
        kind: GeneratedVisual.Kind,
        jpegData: Data,
        user: UUID?,
        note: UUID
    ) -> [GeneratedVisual] {
        let dir = directory(user: user, note: note)
        let id = UUID().uuidString.lowercased()
        let fileName = "\(id).jpg"
        let fileURL = dir.appending(path: fileName)
        try? jpegData.write(to: fileURL, options: .atomic)

        var list = load(user: user, note: note)
        let item = GeneratedVisual(
            id: id,
            title: title,
            prompt: prompt,
            caption: caption,
            kind: kind,
            fileName: fileName,
            createdAt: ISO.string(.now)
        )
        list.insert(item, at: 0)

        if list.count > maxPerNote {
            for dropped in list.dropFirst(maxPerNote) {
                try? FileManager.default.removeItem(at: dir.appending(path: dropped.fileName))
            }
            list = Array(list.prefix(maxPerNote))
        }

        saveIndex(list, in: dir)
        return list
    }

    static func delete(_ item: GeneratedVisual, user: UUID?, note: UUID) -> [GeneratedVisual] {
        let dir = directory(user: user, note: note)
        try? FileManager.default.removeItem(at: dir.appending(path: item.fileName))
        let list = load(user: user, note: note).filter { $0.id != item.id }
        saveIndex(list, in: dir)
        return list
    }

    private static func saveIndex(_ items: [GeneratedVisual], in dir: URL) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: dir.appending(path: "index.json"), options: .atomic)
    }
}

// MARK: - AI Image Client + Watermark + Offline Fosforlu Poster Renderer

enum VisualAI {
    private struct ImageInput: Encodable {
        let title: String
        let topic: String
        let context: String
        let aspectRatio: String
    }

    private struct ImageOutput: Decodable {
        let imageBase64: String?
        let mimeType: String?
        let caption: String?
    }

    static func generate(
        title: String,
        topic: String,
        context: String,
        aspectRatio: VisualAspectRatio
    ) async throws -> (jpegData: Data, caption: String) {
        let input = ImageInput(
            title: title,
            topic: topic,
            context: NoteAI.contextAround(context, topic: topic, budget: 2_000),
            aspectRatio: aspectRatio.rawValue
        )
        let output = try await AIClient.run("image", input, as: ImageOutput.self)
        guard let b64 = output.imageBase64?.trimmingCharacters(in: .whitespacesAndNewlines),
              !b64.isEmpty else {
            throw AIClient.Failure(message: "Yapay zekâ görsel üretemedi. Konuyu biraz daha net yazıp tekrar dene.", code: "empty")
        }
        let cleanB64 = b64.components(separatedBy: "base64,").last ?? b64
        guard let rawData = Data(base64Encoded: cleanB64, options: .ignoreUnknownCharacters),
              let uiImage = UIImage(data: rawData),
              let jpeg = VisualRenderer.finishAIImage(uiImage) else {
            throw AIClient.Failure(message: "Üretilen görsel işlenemedi. Bir kez daha dene.", code: "bad_output")
        }
        let caption = (output.caption ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return (jpeg, caption.isEmpty ? "\(topic) için hazırlanan görsel şema." : caption)
    }
}

enum VisualRenderer {
    static let maxSide: CGFloat = 1280
    static let jpegQuality: CGFloat = 0.86

    /// Resizes an AI image to at most 1280 px, puts it on cream/white paper, stamps the
    /// bottom-right `studymode.fun` pill watermark (matching `imageStore.ts`), and encodes JPEG 0.86.
    static func finishAIImage(_ source: UIImage) -> Data? {
        let origW = source.size.width * source.scale
        let origH = source.size.height * source.scale
        guard origW > 0, origH > 0 else { return nil }

        let scale = min(1.0, maxSide / max(origW, origH))
        let size = CGSize(width: max(1, (origW * scale).rounded()), height: max(1, (origH * scale).rounded()))

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true

        let rendered = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            source.draw(in: CGRect(origin: .zero, size: size))
            drawWatermark(in: ctx.cgContext, size: size)
        }
        return rendered.jpegData(compressionQuality: jpegQuality)
    }

    /// Draws the dark translucent `S studymode.fun` pill in the bottom-right corner (`imageStore.ts:37-60`).
    static func drawWatermark(in cg: CGContext, size: CGSize) {
        let fontSize = max(14, (min(size.width, size.height) * 0.028).rounded())
        let pad = (fontSize * 0.55).rounded()
        let badgeSize = (fontSize * 1.28).rounded()
        let gap = (pad * 0.65).rounded()

        let text = "studymode.fun" as NSString
        let attrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: fontSize, weight: .bold),
            .foregroundColor: UIColor.white
        ]
        let textSize = text.size(withAttributes: attrs)

        let pillW = pad + badgeSize + gap + textSize.width + pad
        let pillH = max(badgeSize, textSize.height) + pad * 1.05
        let margin = (fontSize * 0.7).rounded()
        let pillRect = CGRect(x: size.width - pillW - margin, y: size.height - pillH - margin, width: pillW, height: pillH)

        cg.saveGState()
        let pillPath = UIBezierPath(roundedRect: pillRect, cornerRadius: pillH / 2)
        UIColor(red: 17 / 255, green: 20 / 255, blue: 42 / 255, alpha: 0.76).setFill()
        pillPath.fill()

        // Yellow "S" brand mark circle/rounded square
        let markRect = CGRect(x: pillRect.minX + pad, y: pillRect.midY - badgeSize / 2, width: badgeSize, height: badgeSize)
        let markPath = UIBezierPath(roundedRect: markRect, cornerRadius: badgeSize * 0.28)
        UIColor(red: 1.0, green: 225 / 255, blue: 77 / 255, alpha: 1.0).setFill()
        markPath.fill()

        let sAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: fontSize * 0.88, weight: .black),
            .foregroundColor: UIColor(red: 27 / 255, green: 34 / 255, blue: 80 / 255, alpha: 1.0)
        ]
        let sStr = "S" as NSString
        let sSize = sStr.size(withAttributes: sAttrs)
        sStr.draw(at: CGPoint(x: markRect.midX - sSize.width / 2, y: markRect.midY - sSize.height / 2), withAttributes: sAttrs)

        let textOrigin = CGPoint(x: markRect.maxX + gap, y: pillRect.midY - textSize.height / 2)
        text.draw(at: textOrigin, withAttributes: attrs)
        cg.restoreGState()
    }

    /// Renders the offline "Fosforlu" educational poster JPEG (matching `renderEducationalPosterDataUrl` in `visualTools.ts`).
    static func renderPoster(
        title: String,
        subtitle: String,
        items: [(key: String, meaning: String)],
        footer: String = "Görsel Çalışma Kartı"
    ) -> Data? {
        let rows = Array(items.prefix(5))
        let width: CGFloat = 1000
        let rowHeight: CGFloat = 82
        let rowGap: CGFloat = 14
        let headerBottom: CGFloat = 186
        let height: CGFloat = max(560, headerBottom + CGFloat(rows.count) * (rowHeight + rowGap) + 96)
        let size = CGSize(width: width, height: height)

        let navy = UIColor(red: 27 / 255, green: 34 / 255, blue: 80 / 255, alpha: 1)
        let yellow = UIColor(red: 1.0, green: 225 / 255, blue: 77 / 255, alpha: 1)
        let cream = UIColor(red: 250 / 255, green: 250 / 255, blue: 246 / 255, alpha: 1)
        let grid = UIColor(red: 229 / 255, green: 228 / 255, blue: 220 / 255, alpha: 1)
        let inkMuted = UIColor(red: 82 / 255, green: 88 / 255, blue: 122 / 255, alpha: 1)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true

        let image = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let cg = ctx.cgContext

            // Cream paper background + 28px grid
            cream.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            grid.setStroke()
            cg.setLineWidth(1)
            for x in stride(from: CGFloat(0), through: width, by: 28) {
                cg.move(to: CGPoint(x: x, y: 0))
                cg.addLine(to: CGPoint(x: x, y: height))
            }
            for y in stride(from: CGFloat(0), through: height, by: 28) {
                cg.move(to: CGPoint(x: 0, y: y))
                cg.addLine(to: CGPoint(x: width, y: y))
            }
            cg.strokePath()

            // Outer navy frame
            let outer = UIBezierPath(roundedRect: CGRect(x: 22, y: 22, width: width - 44, height: height - 44), cornerRadius: 20)
            navy.setStroke()
            outer.lineWidth = 4
            outer.stroke()

            // Header banner
            let headerRect = CGRect(x: 44, y: 44, width: width - 88, height: 112)
            let headerPath = UIBezierPath(roundedRect: headerRect, cornerRadius: 16)
            navy.setFill()
            headerPath.fill()

            // Yellow "GÖRSEL ÖZET" badge
            let badgeRect = CGRect(x: 64, y: 62, width: 136, height: 28)
            let badgePath = UIBezierPath(roundedRect: badgeRect, cornerRadius: 7)
            yellow.setFill()
            badgePath.fill()
            let badgeAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 13, weight: .heavy),
                .foregroundColor: navy
            ]
            let badgeText = "GÖRSEL ÖZET" as NSString
            let bSize = badgeText.size(withAttributes: badgeAttrs)
            badgeText.draw(at: CGPoint(x: badgeRect.midX - bSize.width / 2, y: badgeRect.midY - bSize.height / 2), withAttributes: badgeAttrs)

            // Subtitle on right
            let subPara = NSMutableParagraphStyle()
            subPara.alignment = .right
            subPara.lineBreakMode = .byTruncatingTail
            (subtitle as NSString).draw(
                in: CGRect(x: 220, y: 66, width: width - 284, height: 26),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 15, weight: .semibold),
                    .foregroundColor: yellow,
                    .paragraphStyle: subPara
                ]
            )

            // Main title
            let titlePara = NSMutableParagraphStyle()
            titlePara.lineBreakMode = .byTruncatingTail
            ((title.isEmpty ? "Kavram Şeması" : title) as NSString).draw(
                in: CGRect(x: 64, y: 100, width: width - 128, height: 42),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 28, weight: .heavy),
                    .foregroundColor: UIColor.white,
                    .paragraphStyle: titlePara
                ]
            )

            // Rows
            for (idx, item) in rows.enumerated() {
                let y = headerBottom + CGFloat(idx) * (rowHeight + rowGap)
                let cardRect = CGRect(x: 44, y: y, width: width - 88, height: rowHeight)
                let cardPath = UIBezierPath(roundedRect: cardRect, cornerRadius: 12)
                UIColor.white.setFill()
                cardPath.fill()
                navy.setStroke()
                cardPath.lineWidth = 2.5
                cardPath.stroke()

                // Left yellow term box
                let keyRect = CGRect(x: cardRect.minX + 12, y: cardRect.minY + 12, width: 220, height: rowHeight - 24)
                let keyPath = UIBezierPath(roundedRect: keyRect, cornerRadius: 8)
                yellow.setFill()
                keyPath.fill()
                navy.setStroke()
                keyPath.lineWidth = 1.8
                keyPath.stroke()

                let keyPara = NSMutableParagraphStyle()
                keyPara.alignment = .center
                keyPara.lineBreakMode = .byTruncatingTail
                let keyStr = item.key as NSString
                let keyAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 16, weight: .heavy),
                    .foregroundColor: navy,
                    .paragraphStyle: keyPara
                ]
                let keyH = min(keyRect.height - 8, keyStr.boundingRect(with: CGSize(width: keyRect.width - 16, height: keyRect.height - 8), options: [.usesLineFragmentOrigin], attributes: keyAttrs, context: nil).height)
                keyStr.draw(in: CGRect(x: keyRect.minX + 8, y: keyRect.midY - keyH / 2, width: keyRect.width - 16, height: keyH + 4), withAttributes: keyAttrs)

                // Right meaning
                let defPara = NSMutableParagraphStyle()
                defPara.lineBreakMode = .byTruncatingTail
                let defAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 16, weight: .semibold),
                    .foregroundColor: navy,
                    .paragraphStyle: defPara
                ]
                let defRect = CGRect(x: keyRect.maxX + 18, y: cardRect.minY + 14, width: cardRect.maxX - keyRect.maxX - 34, height: rowHeight - 28)
                (item.meaning as NSString).draw(in: defRect, withAttributes: defAttrs)
            }

            // Footer + watermark
            (footer as NSString).draw(
                at: CGPoint(x: 56, y: height - 62),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 15, weight: .bold),
                    .foregroundColor: inkMuted
                ]
            )
            drawWatermark(in: cg, size: size)
        }
        return image.jpegData(compressionQuality: 0.90)
    }
}

// MARK: - Flashcard helper for Visuals & Podcast

private struct NewToolCard: Encodable {
    let id: UUID
    let course_id: UUID
    let note_id: UUID?
    let front: String
    let back: String
    let source: String?
    let due: String
    let interval: Double
    let ease: Double
    let reps: Int
    let lapses: Int
    let created_at: String
    let updated_at: String
}

extension StudyStore {
    /// Creates a flashcard from a visual, concept node, or podcast line (matching `visualToCard` & `podcastLineToCard`).
    func addToolCard(course: UUID, note: UUID?, front: String, back: String, source: String?) async throws {
        var cleanFront = front.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        if cleanFront.count > 220 { cleanFront = String(cleanFront.prefix(217)) + "…" }
        let cleanBack = String(back.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1_200))
        let stamp = ISO.string(.now)
        let row = NewToolCard(
            id: UUID(),
            course_id: course,
            note_id: note,
            front: cleanFront,
            back: cleanBack,
            source: source?.isEmpty == true ? nil : source,
            due: stamp,
            interval: 0,
            ease: 2.5,
            reps: 0,
            lapses: 0,
            created_at: stamp,
            updated_at: stamp
        )
        try await supabase.from("cards").insert(row).execute()
        addCardsLocally([
            Card(
                id: row.id,
                courseId: course,
                noteId: note,
                front: cleanFront,
                back: cleanBack,
                source: row.source,
                due: stamp,
                interval: 0,
                ease: 2.5,
                reps: 0,
                lapses: 0
            )
        ])
    }
}
