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
        let encoded = pages.map { jpegBase64($0) }
        let batches = stride(from: 0, to: encoded.count, by: 2).map { Array($0..<min($0 + 2, encoded.count)) }
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
        let text = results.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
        let unreadable = results.allSatisfy { $0.hasPrefix("[Sayfa ") || $0.isEmpty }
        if unreadable {
            throw AIClient.Failure(message: "Sayfalar okunamadı. Daha net bir fotoğrafla ya da metni yapıştırarak dene.", code: nil)
        }
        return text
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

    /// The PDF's own text, page by page; pages without text are drawn as images and read by the AI.
    static func readPDF(_ url: URL, progress: @escaping @MainActor (Progress) -> Void) async throws -> PDFResult {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let document = PDFDocument(url: url) else {
            throw AIClient.Failure(message: "PDF açılamadı. Dosya bozuk ya da şifreli olabilir.", code: nil)
        }
        if document.isLocked {
            throw AIClient.Failure(message: "Bu PDF şifreli. Şifresiz bir kopyasını ekle.", code: nil)
        }
        var texts = [String](repeating: "", count: document.pageCount)
        var scanned: [(index: Int, image: UIImage)] = []
        for i in 0..<document.pageCount {
            guard let page = document.page(at: i) else { continue }
            let text = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if text.count >= scannedBelow {
                texts[i] = text
            } else {
                let bounds = page.bounds(for: .mediaBox)
                let scale = 1600 / max(bounds.width, bounds.height, 1)
                scanned.append((i, page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)))
            }
        }
        if !scanned.isEmpty {
            // Scanned pages are read in their own order, then put back in place.
            let read = try await transcribe(scanned.map(\.image), progress: progress)
            let parts = read.components(separatedBy: "\n\n")
            if parts.count == scanned.count {
                for (k, item) in scanned.enumerated() { texts[item.index] = parts[k] }
            } else {
                texts[scanned[0].index] = read
            }
        }
        let text = texts.filter { !$0.isEmpty }.joined(separator: "\n\n")
        guard !text.isEmpty else { throw AIClient.Failure(message: "Bu PDF'ten metin çıkarılamadı.", code: nil) }
        return PDFResult(text: text, pageCount: document.pageCount, scannedPages: scanned.count)
    }
}
