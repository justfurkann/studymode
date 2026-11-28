import SwiftUI

/// Note → "Sesli not": Deniz & Mert conversational study podcast.
/// Free users get the instant offline script + Turkish device speech (AVSpeechSynthesizer).
/// Premium users get AI podcast script (`podcast`) + 2-speaker Studio Voice (`tts`), cached locally as `.m4a`
/// with background playback and Lock Screen controls.
struct NotePodcastView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(PremiumStore.self) private var premium

    let note: NoteItem
    let summary: NoteSummary?

    @State private var script: PodcastScript?
    @State private var player = PodcastPlayer()
    @State private var loadingStage: String?
    @State private var error: String?
    @State private var toast: String?
    @State private var addedCardIDs: Set<String> = []

    private var userId: UUID? { auth.session?.user.id }
    private var cacheURL: URL { PodcastStorage.audioCacheURL(user: userId, note: note.id) }
    private var hasCachedStudio: Bool { FileManager.default.fileExists(atPath: cacheURL.path) }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollViewReader { reader in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        if let toast {
                            Message(text: toast, kind: .info)
                        }
                        if let error {
                            Message(text: error, kind: .error)
                        }

                        playerCard
                            .staggeredAppear(0)

                        if let script {
                            scriptSection(script)
                                .staggeredAppear(1)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 40)
                }
                .onChange(of: player.activeLineIndex) { _, idx in
                    guard player.isPlaying, let script, idx < script.lines.count else { return }
                    withAnimation(.easeInOut(duration: 0.3)) {
                        reader.scrollTo(script.lines[idx].id, anchor: .center)
                    }
                }
            }
        }
        .navigationTitle("Sesli not")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .onAppear {
            loadInitialScript()
        }
        .onDisappear {
            player.stopAll()
        }
    }

    // MARK: - Player & Studio Controls Card

    private var playerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: "waveform.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.prem1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(script?.title ?? "\(note.title) · Sesli Özeti")
                        .font(Theme.display(.headline))
                        .foregroundStyle(Theme.text)
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        Text(script?.source == .ai ? "Yapay zekâ senaryosu" : "Hızlı yerel özet")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(script?.source == .ai ? Theme.prem1 : Theme.text2)
                        if let sec = script?.durationEstimateSec {
                            Text("· ~\(max(1, Int((Double(sec) / 60.0).rounded()))) dk")
                                .font(.caption)
                                .foregroundStyle(Theme.text3)
                        }
                    }
                }
                Spacer()
                if !premium.isPremium {
                    Text("PREMIUM")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.prem1, in: Capsule())
                }
            }

            if let loadingStage {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(loadingStage)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.bg, in: RoundedRectangle(cornerRadius: 12))
            }

            // Active Studio or Device player bar
            if player.mode == .studio || hasCachedStudio {
                studioTransportBar
            }

            // Primary action buttons
            VStack(spacing: 10) {
                if premium.isPremium {
                    if hasCachedStudio && player.mode != .studio {
                        Button {
                            if let script {
                                player.loadAndPlayStudio(url: cacheURL, title: script.title, lines: script.lines)
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "play.fill")
                                Text("Stüdyo sesini dinle (hazır)")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    } else if !hasCachedStudio {
                        Button {
                            Task { await generateAndPlayStudio() }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "sparkles")
                                Text(loadingStage != nil ? "Hazırlanıyor…" : "Stüdyo sesiyle dinle")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(loadingStage != nil)
                    }
                } else {
                    NavigationLink {
                        PremiumView()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "crown.fill")
                            Text("Stüdyo sesi (Deniz & Mert) için Premium’u aç")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }

                // Free device voice + regenerate row
                HStack(spacing: 10) {
                    Button {
                        OnboardingHaptics.medium()
                        if player.mode == .device && player.isPlaying {
                            player.stopDeviceSpeech()
                        } else {
                            player.startDeviceSpeech(from: player.activeLineIndex)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: player.mode == .device && player.isPlaying ? "stop.fill" : "speaker.wave.2.fill")
                            Text(player.mode == .device && player.isPlaying ? "Cihaz sesini durdur" : "Hızlı önizleme (cihaz sesi)")
                        }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    .disabled(loadingStage != nil)

                    if premium.isPremium && hasCachedStudio {
                        ShareLink(item: cacheURL) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text)
                                .padding(12)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                        }
                        .accessibilityLabel("Sesi paylaş")
                    }
                }

                if premium.isPremium && (script?.source == .ai || hasCachedStudio) {
                    Button {
                        Task { await regenerateStudio() }
                    } label: {
                        Label("Senaryoyu ve stüdyo sesini yenile", systemImage: "arrow.clockwise")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                    }
                    .buttonStyle(.plain)
                    .disabled(loadingStage != nil)
                }
            }
        }
        .focusCard()
    }

    private var studioTransportBar: some View {
        VStack(spacing: 10) {
            if player.duration > 0 {
                Slider(
                    value: Binding(
                        get: { player.currentTime },
                        set: { player.seek(to: $0) }
                    ),
                    in: 0...max(1, player.duration)
                )
                .tint(Theme.prem1)

                HStack {
                    Text(formatTime(player.currentTime))
                    Spacer()
                    if let total = script?.lines.count, total > 0 {
                        Text("Replik \(min(player.activeLineIndex + 1, total))/\(total)")
                            .fontWeight(.semibold)
                            .foregroundStyle(Theme.text2)
                    }
                    Spacer()
                    Text(formatTime(player.duration))
                }
                .font(.caption2.monospacedDigit())
                .foregroundStyle(Theme.text3)
            }

            HStack(spacing: 18) {
                // Speed toggle
                Button {
                    OnboardingHaptics.selection()
                    let next: Float = player.rate == 1.0 ? 1.25 : (player.rate == 1.25 ? 1.5 : 1.0)
                    player.setRate(next)
                } label: {
                    Text(player.rate == 1.0 ? "1×" : (player.rate == 1.25 ? "1,25×" : "1,5×"))
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Theme.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Theme.bg, in: Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    OnboardingHaptics.light()
                    player.skip(by: -15)
                } label: {
                    Image(systemName: "gobackward.15")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                }
                .buttonStyle(.plain)

                Button {
                    OnboardingHaptics.medium()
                    if player.mode != .studio, let script, hasCachedStudio {
                        player.loadAndPlayStudio(url: cacheURL, title: script.title, lines: script.lines)
                    } else {
                        player.togglePlayPause()
                    }
                } label: {
                    Image(systemName: player.isPlaying && player.mode == .studio ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(Theme.prem1)
                }
                .buttonStyle(.plain)

                Button {
                    OnboardingHaptics.light()
                    player.skip(by: 15)
                } label: {
                    Image(systemName: "goforward.15")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                }
                .buttonStyle(.plain)

                Spacer()

                // Balance spacing
                Color.clear.frame(width: 44, height: 1)
            }
        }
        .padding(12)
        .background(Theme.bg, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Chat Bubble Dialogue Script

    private func scriptSection(_ script: PodcastScript) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Konuşma metni")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text("\(script.lines.count) replik")
                    .font(.caption)
                    .foregroundStyle(Theme.text3)
            }

            VStack(spacing: 10) {
                ForEach(Array(script.lines.enumerated()), id: \.element.id) { idx, line in
                    let isDeniz = line.speaker == .deniz
                    let isActive = player.isPlaying && player.activeLineIndex == idx
                    let prevLine = idx > 0 ? script.lines[idx - 1] : nil

                    HStack {
                        if !isDeniz { Spacer(minLength: 28) }
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 6) {
                                Text(isDeniz ? "Deniz · Asistan" : "Mert · Öğrenci")
                                    .font(.caption2.weight(.heavy))
                                    .foregroundStyle(isDeniz ? Theme.prem1 : Theme.text2)
                                if !line.highlight.isEmpty {
                                    Text(line.highlight)
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Theme.onHi)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Theme.hi, in: Capsule())
                                        .lineLimit(1)
                                }
                                Spacer()
                                if isActive {
                                    Image(systemName: "waveform")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Theme.prem1)
                                }
                            }

                            Text(line.text)
                                .font(.subheadline)
                                .foregroundStyle(Theme.text)
                                .fixedSize(horizontal: false, vertical: true)

                            HStack {
                                Spacer()
                                Button {
                                    Task { await addCard(line: line, prev: prevLine) }
                                } label: {
                                    Label(
                                        addedCardIDs.contains(line.id) ? "Karta eklendi" : "Karta çevir",
                                        systemImage: addedCardIDs.contains(line.id) ? "checkmark" : "rectangle.stack.badge.plus"
                                    )
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(addedCardIDs.contains(line.id) ? Theme.success : Theme.text3)
                                }
                                .buttonStyle(.plain)
                                .disabled(addedCardIDs.contains(line.id))
                            }
                        }
                        .padding(12)
                        .background(
                            isActive ? Theme.hi.opacity(0.22) : (isDeniz ? Theme.surface : Theme.bg),
                            in: RoundedRectangle(cornerRadius: 14)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(isActive ? Theme.cardLine : Theme.border, lineWidth: isActive ? 1.8 : 1)
                        )
                        if isDeniz { Spacer(minLength: 28) }
                    }
                    .id(line.id)
                }
            }
        }
    }

    // MARK: - Actions

    private func loadInitialScript() {
        let loaded = PodcastStorage.loadScript(user: userId, note: note.id)
            ?? PodcastLogic.buildLocalScript(note: note, summary: summary)
        script = loaded
        player.configure(title: loaded.title, lines: loaded.lines, cachedURL: cacheURL)
    }

    private func regenerateStudio() async {
        player.stopAll()
        PodcastStorage.clearCachedAudio(user: userId, note: note.id)
        script = PodcastLogic.buildLocalScript(note: note, summary: summary)
        await generateAndPlayStudio(forceNewScript: true)
    }

    private func generateAndPlayStudio(forceNewScript: Bool = false) async {
        OnboardingHaptics.medium()
        error = nil
        toast = nil
        player.stopAll()

        let bgTask = UIApplication.shared.beginBackgroundTask(withName: "StudyModePodcast")
        UIApplication.shared.isIdleTimerDisabled = true
        defer {
            UIApplication.shared.isIdleTimerDisabled = false
            loadingStage = nil
            if bgTask != .invalid { UIApplication.shared.endBackgroundTask(bgTask) }
        }

        do {
            // 1. Ensure AI script
            var activeScript = script ?? PodcastLogic.buildLocalScript(note: note, summary: summary)
            if forceNewScript || activeScript.source == .local {
                loadingStage = "Deniz ve Mert senaryoyu hazırlıyor…"
                let content = (try? await store.noteContent(note.id)) ?? summary?.overview ?? note.title
                activeScript = try await PodcastAI.generateScript(title: note.title, content: content)
                script = activeScript
                PodcastStorage.saveScript(activeScript, user: userId, note: note.id)
            }

            // 2. Synthesize 600-char TTS chunks sequentially
            let chunks = PodcastLogic.splitForTts(activeScript.lines, maxChars: 600)
            var wavClips: [Data] = []
            for (idx, chunk) in chunks.enumerated() {
                loadingStage = "Stüdyo sesi kaydediliyor · \(idx + 1)/\(chunks.count)…"
                let wav = try await PodcastAI.synthesizeChunk(chunk)
                wavClips.append(wav)
            }

            // 3. Concatenate WAV & export compressed M4A to cache
            loadingStage = "Ses birleştiriliyor…"
            let fullWav = PodcastAudioCodec.concatenateWav(wavClips)
            let tempWav = FileManager.default.temporaryDirectory.appending(path: "sm-podcast-\(UUID().uuidString).wav")
            try fullWav.write(to: tempWav, options: .atomic)
            defer { try? FileManager.default.removeItem(at: tempWav) }

            do {
                try await PodcastAudioCodec.exportToM4A(wavURL: tempWav, destination: cacheURL)
                player.loadAndPlayStudio(url: cacheURL, title: activeScript.title, lines: activeScript.lines)
            } catch {
                // Fallback: save WAV directly if M4A export fails
                let wavFallback = cacheURL.deletingPathExtension().appendingPathExtension("wav")
                try fullWav.write(to: wavFallback, options: .atomic)
                player.loadAndPlayStudio(url: wavFallback, title: activeScript.title, lines: activeScript.lines)
            }

            store.recordActivity()
            OnboardingHaptics.success()
            toast = "Stüdyo sesi hazır ve bu cihaza kaydedildi (tekrar dinlemede hak yemez)."
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Stüdyo sesi hazırlanamadı. Tekrar dene."
        }
    }

    private func addCard(line: PodcastLine, prev: PodcastLine?) async {
        let payload = PodcastLogic.cardPayload(line: line, prevLine: prev)
        do {
            try await store.addToolCard(
                course: note.courseId,
                note: note.id,
                front: payload.front,
                back: payload.back,
                source: payload.source
            )
            addedCardIDs.insert(line.id)
            OnboardingHaptics.success()
            toast = "Replik karta çevrildi."
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol et."
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        let s = max(0, Int(seconds.rounded()))
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
