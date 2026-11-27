import PDFKit
import UIKit

/// Turning photos and PDFs into note text, as the site's importNote.ts does: a PDF's own text is read
/// on the phone; photos and scanned pages are read by the AI ("transcribe": 1-2 pages a request,
/// three requests at a time, never counted against the daily quota).
enum NoteImport {
    struct Progress: Equatable {
        var done: Int
        var total: Int
    }

    private struct TranscribeInput: Encodable {
        struct Image: Encodable { let mimeType: String; let data: String }
        let images: [Image]
    }

    private struct TranscribeOutput: Decodable { let text: String }

    /// A page shorter than this (after trimming) is treated as scanned and read by the AI.
    static let scannedBelow = 40

    // MARK: Photos

    /// Longest side ~1600 px, JPEG: readable for the AI and well under the server's request size.
    static func jpegBase64(_ image: UIImage, maxSide: CGFloat = 1600) -> String? {
        let size = image.size
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return resized.jpegData(compressionQuality: 0.72)?.base64EncodedString()
    }

    /// Reads pages with the AI, two per request, three requests at a time; text comes back in page
    /// order. A request that fails is tried again page by page; a page that still fails is marked.
    static func transcribe(_ pages: [UIImage], progress: @escaping @MainActor (Progress) -> Void) async throws -> String {
        let results = try await transcribePages(pages, progress: progress)
        let text = results.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
        let unreadable = results.allSatisfy { $0.hasPrefix("[Sayfa ") || $0.isEmpty }
        if unreadable {
            throw AIClient.Failure(message: "Sayfalar okunamadı. Daha net bir fotoğrafla ya da metni yapıştırarak dene.", code: nil)
        }
        return text
    }

    /// One text per page. Two pages go in one request only when `pairs(i)` says page i and i+1 sit
    /// next to each other; then the first carries both and the second is empty. A page that could not
    /// be read is "[Sayfa N okunamadı]".
    static func transcribePages(_ pages: [UIImage], pairs: (Int) -> Bool = { _ in true }, progress: @escaping @MainActor (Progress) -> Void) async throws -> [String] {
        let encoded = pages.map { jpegBase64($0) }
        var batches: [[Int]] = []
        var i = 0
        while i < encoded.count {
            if i + 1 < encoded.count && pairs(i) { batches.append([i, i + 1]); i += 2 } else { batches.append([i]); i += 1 }
        }
        var results = [String](repeating: "", count: pages.count)
        let counter = Counter(total: pages.count)
        await progress(Progress(done: 0, total: pages.count))

        try await withThrowingTaskGroup(of: [(Int, String)].self) { group in
            var next = 0
            func add() {
                guard next < batches.count else { return }
                let batch = batches[next]
                next += 1
                group.addTask { await read(batch, encoded: encoded) }
            }
            for _ in 0..<min(3, batches.count) { add() }
            while let finished = try await group.next() {
                for (i, text) in finished { results[i] = text }
                let done = await counter.add(finished.count)
                await progress(Progress(done: done, total: pages.count))
                add()
            }
        }
        return results
    }

    /// One request for 1-2 pages; on failure, each page alone once.
    private static func read(_ batch: [Int], encoded: [String?]) async -> [(Int, String)] {
        func request(_ indices: [Int]) async throws -> String {
            let images = indices.compactMap { encoded[$0] }.map { TranscribeInput.Image(mimeType: "image/jpeg", data: $0) }
            guard !images.isEmpty else { throw AIClient.Failure(message: "Görüntü hazırlanamadı.", code: nil) }
            return try await AIClient.run("transcribe", TranscribeInput(images: images), as: TranscribeOutput.self).text
        }
        if let text = try? await request(batch) {
            // Two pages come back as one text; the first index carries it, the second stays empty.
            return [(batch[0], text)] + batch.dropFirst().map { ($0, "") }
        }
        var out: [(Int, String)] = []
        for i in batch {
            if let text = try? await request([i]) { out.append((i, text)) }
            else { out.append((i, "[Sayfa \(i + 1) okunamadı]")) }
        }
        return out
    }

    private actor Counter {
        var done = 0
        let total: Int
        init(total: Int) { self.total = total }
        func add(_ n: Int) -> Int { done += n; return done }
    }

    // MARK: PDF

    struct PDFResult {
        let text: String
        let pageCount: Int
        let scannedPages: Int
    }

    /// The PDF's own text, page by page. Pages read as pictures by the AI instead (the site's rule,
    /// MathPages): pages without text (scanned), pages whose text breaks the math, and in a
    /// math-heavy document pages with figures.
    static func readPDF(_ url: URL, progress: @escaping @MainActor (Progress) -> Void) async throws -> PDFResult {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let document = PDFDocument(url: url) else {
            throw AIClient.Failure(message: "PDF açılamadı. Dosya bozuk ya da şifreli olabilir.", code: nil)
        }
        if document.isLocked {
            throw AIClient.Failure(message: "Bu PDF şifreli. Şifresiz bir kopyasını ekle.", code: nil)
        }
        // Each page's own text; almost-empty pages count as scanned.
        var texts = (0..<document.pageCount).map { i -> String in
            let text = (document.page(at: i)?.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return text.count >= scannedBelow ? text : ""
        }
        // The formula check needs the page's visual lines (pdf.js gives them on the site); PDFKit's
        // `string` sometimes runs a whole page into one line.
        let lines = texts.indices.map { i -> String in
            guard !texts[i].isEmpty, let page = document.page(at: i) else { return texts[i] }
            return MathPages.lines(of: page) ?? texts[i]
        }
        let heavy = MathPages.mathHeavy(lines)
        let figures: [Int?] = heavy ? (0..<document.pageCount).map { i in document.page(at: i)?.pageRef.flatMap(MathPages.figureCount) } : []
        let pictures = MathPages.pagesToReadAsPictures(lines, figures: figures)

        if !pictures.isEmpty {
            let images = pictures.map { i -> UIImage in
                guard let page = document.page(at: i) else { return UIImage() }
                let bounds = page.bounds(for: .mediaBox)
                let scale = 1600 / max(bounds.width, bounds.height, 1)
                return page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)
            }
            // Two pages share a request only when they follow each other, so the text stays in page order.
            let read = try await transcribePages(images, pairs: { pictures[$0] + 1 == pictures[$0 + 1] }, progress: progress)
            var anyRead = false
            for (k, index) in pictures.enumerated() {
                let text = read[k].trimmingCharacters(in: .whitespacesAndNewlines)
                if text.hasPrefix("[Sayfa ") {
                    // Not read: a page with its own text keeps it (formulas imperfect, but not lost).
                    if texts[index].isEmpty { texts[index] = "[Sayfa \(index + 1) okunamadı]" }
                } else if !text.isEmpty {
                    texts[index] = text
                    anyRead = true
                } else if k > 0, pictures[k - 1] + 1 == index, !read[k - 1].hasPrefix("[Sayfa ") {
                    // Read together with the page before it: that page's text already holds this one.
                    texts[index] = ""
                }
            }
            let ownText = texts.contains { !$0.isEmpty && !$0.hasPrefix("[Sayfa ") }
            if !anyRead && !ownText {
                throw AIClient.Failure(message: "Sayfalar okunamadı. Daha net bir dosyayla ya da metni yapıştırarak dene.", code: nil)
            }
        }
        let joined = texts.filter { !$0.isEmpty }.joined(separator: "\n\n")
        let text = heavy ? MathPages.fixSymbolFont(joined) : joined
        guard !text.isEmpty else { throw AIClient.Failure(message: "Bu PDF'ten metin çıkarılamadı.", code: nil) }
        return PDFResult(text: text, pageCount: document.pageCount, scannedPages: pictures.count)
    }
}
