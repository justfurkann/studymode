import AVFoundation
import Foundation
import MediaPlayer
import UIKit

// MARK: - Podcast Data Models (matches src/lib/podcastTools.ts)

enum PodcastSpeaker: String, Codable, Hashable {
    case deniz = "Deniz"
    case mert = "Mert"
}

struct PodcastLine: Identifiable, Codable, Hashable {
    let id: String
    let speaker: PodcastSpeaker
    let role: String
    let text: String
    let highlight: String
}

struct PodcastScript: Codable, Hashable {
    enum Source: String, Codable {
        case ai
        case local
    }

    let title: String
    let summary: String
    let lines: [PodcastLine]
    let durationEstimateSec: Int
    let source: Source
}

// MARK: - Local Script Builder, Chunking & Line Progress

enum PodcastLogic {
    static func buildLocalScript(note: NoteItem, summary: NoteSummary?, content: String = "") -> PodcastScript {
        let title = note.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Ders Notu" : note.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let overview = summary?.overview.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? content.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.first { $0.count > 30 }
            ?? "\(title) konusunun temel kavramlarını inceliyoruz."

        let keyTerms = summary?.keyTerms ?? []
        let points = summary?.points ?? []
        var lines: [PodcastLine] = []

        func push(_ speaker: PodcastSpeaker, _ text: String, highlight: String = "") {
            let cleaned = text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { return }
            lines.append(
                PodcastLine(
                    id: "line-\(lines.count + 1)",
                    speaker: speaker,
                    role: speaker == .deniz ? "host" : "student",
                    text: cleaned,
                    highlight: highlight.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
        }

        push(.deniz, "Selam Mert! Bugün seninle “\(title)” notunun sınavda en çok işine yarayacak noktalarını hızlıca konuşacağız. Hazır mısın?", highlight: title)
        push(.mert, "Selam Deniz! Tam da bu konuyu tekrar ediyordum. Genel çerçeveyi tek cümlede nasıl özetleriz?")
        push(.deniz, overview, highlight: keyTerms.first?.term ?? "")

        for (idx, item) in keyTerms.prefix(4).enumerated() {
            if idx == 0 {
                push(.mert, "Peki burada ilk karşımıza çıkan “\(item.term)” kavramını sınavda görsek nasıl hatırlayalım?", highlight: item.term)
                push(.deniz, "\(item.term) kısaca şu: \(item.definition)", highlight: item.term)
            } else if idx == 1 {
                push(.mert, "Anladım. Bir de notta “\(item.term)” geçiyor, onu diğerlerinden ayıran özellik ne?", highlight: item.term)
                push(.deniz, "Çok iyi soru! \(item.term) için şunu aklında tut: \(item.definition)", highlight: item.term)
            } else {
                push(.mert, "Süper. Peki “\(item.term)” hakkında ne bilmemiz şart?", highlight: item.term)
                push(.deniz, "\(item.term): \(item.definition)", highlight: item.term)
            }
        }

        for (idx, pt) in points.prefix(2).enumerated() {
            push(.mert, idx == 0 ? "Hocalar test veya klasik soruda başka hangi detayı yoklamayı sever?" : "Son olarak gözden kaçırmamamız gereken kritik bir nokta var mı?")
            push(.deniz, pt)
        }

        push(.mert, "Harika bir özet oldu Deniz, şimdi kartlara ve teste geçip pekiştirebilirim!")
        push(.deniz, "Aynen öyle! Kısa bir test çözüp yanlışlarını karta çevirirsen bu konu sınavda garanti.")

        let words = lines.reduce(0) { $0 + $1.text.split(whereSeparator: \.isWhitespace).count }
        let duration = max(30, Int((Double(words) / 135.0 * 60.0).rounded()))

        return PodcastScript(
            title: "\(title) · Sesli Özeti",
            summary: overview,
            lines: lines,
            durationEstimateSec: duration,
            source: .local
        )
    }

    /// Splits lines into chunks of at most `maxChars` (default 600, matching the site's TTS split).
    static func splitForTts(_ lines: [PodcastLine], maxChars: Int = 600) -> [[PodcastLine]] {
        var chunks: [[PodcastLine]] = []
        var current: [PodcastLine] = []
        var currentLen = 0

        for line in lines {
            let lineLen = line.speaker.rawValue.count + 2 + line.text.count
            // The server reads at most 16 lines per request (api/generate tts), so a chunk never has more.
            if !current.isEmpty && (currentLen + lineLen > maxChars || current.count >= 16) {
                chunks.append(current)
                current = [line]
                currentLen = lineLen
            } else {
                current.append(line)
                currentLen += lineLen
            }
        }
        if !current.isEmpty { chunks.append(current) }
        return chunks
    }

    static func lineAtFraction(_ lines: [PodcastLine], fraction: Double) -> Int {
        guard !lines.isEmpty else { return 0 }
        let weights = lines.map { max(1, $0.text.count) }
        let total = Double(weights.reduce(0, +))
        let target = max(0, min(1, fraction)) * total
        var sum = 0.0
        for (idx, w) in weights.enumerated() {
            sum += Double(w)
            if target < sum { return idx }
        }
        return lines.count - 1
    }

    static func cardPayload(line: PodcastLine, prevLine: PodcastLine?) -> (front: String, back: String, source: String?) {
        let front: String
        if let prevLine, prevLine.speaker == .mert {
            front = prevLine.text
        } else if !line.highlight.isEmpty {
            front = "“\(line.highlight)” kavramının temel özelliği nedir?"
        } else {
            front = "Sesli not özetindeki bu kritik bilgi nedir?"
        }
        return (front, line.text, line.highlight.isEmpty ? nil : line.highlight)
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - WAV / PCM Codec & M4A Export

enum PodcastAudioCodec {
    /// Ensures audio bytes start with a valid 44-byte RIFF WAV header (handles raw Gemini PCM `audio/L16`).
    static func ensureWav(_ data: Data, mimeType: String?) -> Data {
        if data.count >= 4,
           data[0] == 0x52, data[1] == 0x49, data[2] == 0x46, data[3] == 0x46 {
            return data
        }
        let sampleRate = parseSampleRate(from: mimeType) ?? 24_000
        return wrapPcmAsWav(pcm: data, sampleRate: sampleRate, channels: 1, bitsPerSample: 16)
    }

    static func parseSampleRate(from mimeType: String?) -> UInt32? {
        guard let mimeType else { return nil }
        let parts = mimeType.lowercased().components(separatedBy: ";")
        for part in parts {
            let trimmed = part.trimmingCharacters(in: .whitespaces)
            if trimmed.hasPrefix("rate="), let rate = UInt32(trimmed.dropFirst(5)) {
                return rate
            }
        }
        return nil
    }

    static func wrapPcmAsWav(pcm: Data, sampleRate: UInt32, channels: UInt16, bitsPerSample: UInt16) -> Data {
        let dataSize = UInt32(pcm.count)
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        var header = Data(capacity: 44)
        header.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
        header.appendLittleEndian(36 + dataSize)
        header.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"
        header.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
        header.appendLittleEndian(UInt32(16))
        header.appendLittleEndian(UInt16(1)) // PCM
        header.appendLittleEndian(channels)
        header.appendLittleEndian(sampleRate)
        header.appendLittleEndian(byteRate)
        header.appendLittleEndian(blockAlign)
        header.appendLittleEndian(bitsPerSample)
        header.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        header.appendLittleEndian(dataSize)
        var out = Data(capacity: 44 + pcm.count)
        out.append(header)
        out.append(pcm)
        return out
    }

    /// Concatenates multiple WAV clips by stripping the 44-byte header from clips after the first.
    static func concatenateWav(_ clips: [Data]) -> Data {
        let valid = clips.filter { $0.count > 44 }
        guard let first = valid.first else { return clips.first ?? Data() }
        if valid.count == 1 { return first }

        let totalPcm = valid.reduce(0) { $0 + ($1.count - 44) }
        var combined = Data(capacity: 44 + totalPcm)
        combined.append(first.prefix(44))
        for clip in valid {
            combined.append(clip.dropFirst(44))
        }

        if combined.count >= 44,
           combined[0] == 0x52, combined[1] == 0x49, combined[2] == 0x46, combined[3] == 0x46 {
            combined.replaceLittleEndian(at: 4, value: UInt32(36 + totalPcm))
            combined.replaceLittleEndian(at: 40, value: UInt32(totalPcm))
        }
        return combined
    }

    /// Compresses a combined WAV file into an AAC `.m4a` cached file (~5x smaller).
    static func exportToM4A(wavURL: URL, destination m4aURL: URL) async throws {
        try? FileManager.default.removeItem(at: m4aURL)
        let asset = AVURLAsset(url: wavURL)
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            throw AIClient.Failure(message: "Ses dosyası dönüştürülemedi.", code: "export")
        }
        session.outputURL = m4aURL
        session.outputFileType = .m4a
        await session.export()
        if session.status != .completed {
            throw session.error ?? AIClient.Failure(message: "Ses önbelleğe kaydedilemedi.", code: "export")
        }
    }
}

private extension Data {
    mutating func appendLittleEndian<T: FixedWidthInteger>(_ value: T) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }

    mutating func replaceLittleEndian(at offset: Int, value: UInt32) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { bytes in
            replaceSubrange(offset..<(offset + 4), with: bytes)
        }
    }
}

// MARK: - On-Device Script & Audio Cache

enum PodcastStorage {
    static func scriptURL(user: UUID?, note: UUID) -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let userDir = user?.uuidString.lowercased() ?? "guest"
        let dir = base.appending(path: "StudyMode", directoryHint: .isDirectory)
            .appending(path: userDir, directoryHint: .isDirectory)
            .appending(path: "podcast", directoryHint: .isDirectory)
            .appending(path: note.uuidString.lowercased(), directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "script.json")
    }

    static func audioCacheURL(user: UUID?, note: UUID) -> URL {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let userDir = user?.uuidString.lowercased() ?? "guest"
        let dir = base.appending(path: "StudyMode", directoryHint: .isDirectory)
            .appending(path: userDir, directoryHint: .isDirectory)
            .appending(path: "podcast", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "\(note.uuidString.lowercased()).m4a")
    }

    static func loadScript(user: UUID?, note: UUID) -> PodcastScript? {
        let url = scriptURL(user: user, note: note)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(PodcastScript.self, from: data)
    }

    static func saveScript(_ script: PodcastScript, user: UUID?, note: UUID) {
        guard let data = try? JSONEncoder().encode(script) else { return }
        try? data.write(to: scriptURL(user: user, note: note), options: .atomic)
    }

    static func hasCachedAudio(user: UUID?, note: UUID) -> Bool {
        FileManager.default.fileExists(atPath: audioCacheURL(user: user, note: note).path)
    }

    static func clearCachedAudio(user: UUID?, note: UUID) {
        let url = audioCacheURL(user: user, note: note)
        try? FileManager.default.removeItem(at: url)
        // The WAV kept when the M4A export fails (NotePodcastView) goes with it.
        try? FileManager.default.removeItem(at: url.deletingPathExtension().appendingPathExtension("wav"))
    }
}

// MARK: - AI Podcast & TTS Client

enum PodcastAI {
    private struct ScriptInput: Encodable {
        let title: String
        let text: String
    }

    private struct ScriptOutput: Decodable {
        struct Line: Decodable {
            let speaker: String?
            let role: String?
            let text: String?
            let highlight: String?
        }
        let title: String?
        let summary: String?
        let lines: [Line]?
    }

    private struct TtsInput: Encodable {
        struct Line: Encodable {
            let speaker: String
            let text: String
        }
        let lines: [Line]
    }

    private struct TtsOutput: Decodable {
        let audioBase64: String?
        let mimeType: String?
    }

    static func generateScript(title: String, content: String) async throws -> PodcastScript {
        let trimmed = String(content.prefix(16_000))
        let out = try await AIClient.run("podcast", ScriptInput(title: title, text: trimmed), as: ScriptOutput.self)
        let rawLines = out.lines ?? []
        var lines: [PodcastLine] = []
        for l in rawLines {
            let text = (l.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let speaker: PodcastSpeaker = (l.speaker == "Mert") ? .mert : .deniz
            lines.append(
                PodcastLine(
                    id: "line-\(lines.count + 1)",
                    speaker: speaker,
                    role: speaker == .deniz ? "host" : "student",
                    text: text,
                    highlight: (l.highlight ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                )
            )
        }
        guard !lines.isEmpty else {
            throw AIClient.Failure(message: "Podcast senaryosu oluşturulamadı. Bir kez daha dene.", code: "empty")
        }
        let words = lines.reduce(0) { $0 + $1.text.split(whereSeparator: \.isWhitespace).count }
        let duration = max(30, Int((Double(words) / 135.0 * 60.0).rounded()))
        return PodcastScript(
            title: (out.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "\(title) · Sesli Özeti",
            summary: (out.summary ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
            lines: lines,
            durationEstimateSec: duration,
            source: .ai
        )
    }

    static func synthesizeChunk(_ lines: [PodcastLine]) async throws -> Data {
        let payload = TtsInput(lines: lines.map { .init(speaker: $0.speaker.rawValue, text: String($0.text.prefix(600))) })
        let out = try await AIClient.run("tts", payload, as: TtsOutput.self)
        guard let b64 = out.audioBase64?.trimmingCharacters(in: .whitespacesAndNewlines), !b64.isEmpty else {
            throw AIClient.Failure(message: "Stüdyo sesi üretilemedi.", code: "empty")
        }
        let cleanB64 = b64.components(separatedBy: "base64,").last ?? b64
        guard let raw = Data(base64Encoded: cleanB64, options: .ignoreUnknownCharacters), !raw.isEmpty else {
            throw AIClient.Failure(message: "Ses verisi çözümlenemedi.", code: "bad_output")
        }
        return PodcastAudioCodec.ensureWav(raw, mimeType: out.mimeType)
    }
}

// MARK: - Studio + Device Audio Player (with Lock Screen Controls)

@MainActor
@Observable
final class PodcastPlayer: NSObject {
    enum Mode {
        case idle
        case studio
        case device
    }

    private(set) var mode: Mode = .idle
    private(set) var isPlaying = false
    private(set) var currentTime: Double = 0
    private(set) var duration: Double = 0
    private(set) var activeLineIndex: Int = 0
    private(set) var rate: Float = 1.0
    private(set) var cachedAudioURL: URL?

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var lines: [PodcastLine] = []
    private var trackTitle: String = "Sesli Not"

    // Device speech synthesizer (free mode)
    private let synthesizer = AVSpeechSynthesizer()
    private var speakingDeviceIndex = 0
    private var deviceActive = false

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func configure(title: String, lines: [PodcastLine], cachedURL: URL?) {
        self.trackTitle = title
        self.lines = lines
        self.cachedAudioURL = (cachedURL.map { FileManager.default.fileExists(atPath: $0.path) } ?? false) ? cachedURL : nil
    }

    func loadAndPlayStudio(url: URL, title: String, lines: [PodcastLine]) {
        stopDeviceSpeech()
        self.trackTitle = title
        self.lines = lines
        self.cachedAudioURL = url
        self.mode = .studio

        activateAudioSession()
        installRemoteCommands()
        tearDownAVPlayer()

        let item = AVPlayerItem(url: url)
        let av = AVPlayer(playerItem: item)
        self.player = av

        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = av.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            Task { @MainActor in
                guard let self else { return }
                let sec = time.seconds
                if sec.isFinite && sec >= 0 { self.currentTime = sec }
                let dur = self.player?.currentItem?.duration.seconds ?? 0
                if dur.isFinite && dur > 0 {
                    self.duration = dur
                    self.activeLineIndex = PodcastLogic.lineAtFraction(self.lines, fraction: sec / dur)
                }
                self.updateNowPlaying()
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.isPlaying = false
                self.currentTime = self.duration
                self.updateNowPlaying()
            }
        }

        av.playImmediately(atRate: rate)
        isPlaying = true
        updateNowPlaying()
    }

    func togglePlayPause() {
        switch mode {
        case .studio:
            guard let player else { return }
            if isPlaying {
                player.pause()
                isPlaying = false
            } else {
                if duration > 0 && currentTime >= duration - 0.3 {
                    player.seek(to: .zero)
                    currentTime = 0
                }
                activateAudioSession()
                player.playImmediately(atRate: rate)
                isPlaying = true
            }
            updateNowPlaying()
        case .device:
            if synthesizer.isPaused {
                synthesizer.continueSpeaking()
                isPlaying = true
            } else if synthesizer.isSpeaking {
                synthesizer.pauseSpeaking(at: .word)
                isPlaying = false
            } else {
                startDeviceSpeech(from: activeLineIndex)
            }
        case .idle:
            if let url = cachedAudioURL {
                loadAndPlayStudio(url: url, title: trackTitle, lines: lines)
            }
        }
    }

    func seek(to seconds: Double) {
        guard mode == .studio, let player else { return }
        let clamped = max(0, min(duration, seconds))
        player.seek(to: CMTime(seconds: clamped, preferredTimescale: 600))
        currentTime = clamped
        if duration > 0 {
            activeLineIndex = PodcastLogic.lineAtFraction(lines, fraction: clamped / duration)
        }
        updateNowPlaying()
    }

    func skip(by delta: Double) {
        seek(to: currentTime + delta)
    }

    func setRate(_ newRate: Float) {
        rate = newRate
        if mode == .studio, isPlaying {
            player?.rate = newRate
        }
        updateNowPlaying()
    }

    // MARK: - Free Device Speech (AVSpeechSynthesizer)

    func startDeviceSpeech(from index: Int = 0) {
        tearDownAVPlayer()
        stopDeviceSpeech()
        guard !lines.isEmpty else { return }
        activateAudioSession()
        mode = .device
        deviceActive = true
        speakingDeviceIndex = max(0, min(index, lines.count - 1))
        speakNextDeviceLine()
    }

    private func speakNextDeviceLine() {
        guard deviceActive, speakingDeviceIndex < lines.count else {
            deviceActive = false
            isPlaying = false
            return
        }
        activeLineIndex = speakingDeviceIndex
        let line = lines[speakingDeviceIndex]
        let utterance = AVSpeechUtterance(string: line.text)
        utterance.voice = AVSpeechSynthesisVoice(language: "tr-TR")
        utterance.pitchMultiplier = line.speaker == .deniz ? 1.06 : 0.90
        let baseRate = AVSpeechUtteranceDefaultSpeechRate
        utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate, baseRate * (0.94 + (rate - 1.0) * 0.35))
        utterance.postUtteranceDelay = 0.25
        isPlaying = true
        synthesizer.speak(utterance)
    }

    func stopDeviceSpeech() {
        deviceActive = false
        if synthesizer.isSpeaking || synthesizer.isPaused {
            synthesizer.stopSpeaking(at: .immediate)
        }
        if mode == .device {
            isPlaying = false
        }
    }

    func stopAll() {
        stopDeviceSpeech()
        tearDownAVPlayer()
        isPlaying = false
        mode = .idle
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    private func tearDownAVPlayer() {
        if let obs = timeObserver, let player {
            player.removeTimeObserver(obs)
        }
        timeObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        player?.pause()
        player = nil
    }

    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.allowBluetoothA2DP])
        try? session.setActive(true)
    }

    private func installRemoteCommands() {
        let cc = MPRemoteCommandCenter.shared()
        cc.playCommand.removeTarget(nil)
        cc.pauseCommand.removeTarget(nil)
        cc.togglePlayPauseCommand.removeTarget(nil)
        cc.skipForwardCommand.removeTarget(nil)
        cc.skipBackwardCommand.removeTarget(nil)
        cc.changePlaybackPositionCommand.removeTarget(nil)

        cc.playCommand.isEnabled = true
        cc.playCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                if let self, !self.isPlaying { self.togglePlayPause() }
            }
            return .success
        }
        cc.pauseCommand.isEnabled = true
        cc.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in
                if let self, self.isPlaying { self.togglePlayPause() }
            }
            return .success
        }
        cc.togglePlayPauseCommand.isEnabled = true
        cc.togglePlayPauseCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.togglePlayPause() }
            return .success
        }
        cc.skipForwardCommand.isEnabled = true
        cc.skipForwardCommand.preferredIntervals = [15]
        cc.skipForwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(by: 15) }
            return .success
        }
        cc.skipBackwardCommand.isEnabled = true
        cc.skipBackwardCommand.preferredIntervals = [15]
        cc.skipBackwardCommand.addTarget { [weak self] _ in
            Task { @MainActor in self?.skip(by: -15) }
            return .success
        }
        cc.changePlaybackPositionCommand.isEnabled = true
        cc.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let pos = (event as? MPChangePlaybackPositionCommandEvent)?.positionTime else { return .commandFailed }
            Task { @MainActor in self?.seek(to: pos) }
            return .success
        }
    }

    private func updateNowPlaying() {
        guard mode == .studio else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: trackTitle,
            MPMediaItemPropertyArtist: "StudyMode · Deniz & Mert",
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? rate : 0.0
        ]
    }
}

extension PodcastPlayer: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            guard self.deviceActive else { return }
            self.speakingDeviceIndex += 1
            self.speakNextDeviceLine()
        }
    }
}
