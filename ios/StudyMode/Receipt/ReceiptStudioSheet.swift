import Photos
import SwiftUI
import UIKit

// MARK: - Interactive Çalışma Fişi Studio Sheet

struct ReceiptStudioSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var period: ReceiptPeriod = .gun
    @State private var prefs = ReceiptPrefs()
    @State private var loadedPrefs = false
    @State private var editingDetails = false

    // Thermal printer & stamp choreography
    @State private var feedProgress: CGFloat = 0
    @State private var isPrinting = false
    @State private var stampSlammed = false
    @State private var stampPulse: CGFloat = 0
    @State private var stampMotion: ReceiptStampMotion = .hidden
    @State private var studioWidth: CGFloat = 390
    @State private var printTask: Task<Void, Never>?

    // Interactive 3D tilt, specular glint & tear-to-share gesture
    @State private var tiltPitch: Double = 0
    @State private var tiltRoll: Double = 0
    @State private var glintOffset: CGFloat = -0.35
    @State private var tearOffset: CGFloat = 0
    @State private var lastTearTickBucket: Int = 0

    // Share & Photo save state
    @State private var sharePayload: ShareImagePayload?
    @State private var statusBanner: StudioBanner?
    @State private var unlockedAchievementBanner = false

    private let tearThreshold: CGFloat = 68

    private var stats: ReceiptStats {
        ReceiptBuilder.build(store: store, period: period)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 16) {
                        if unlockedAchievementBanner {
                            achievementBanner
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        if let banner = statusBanner {
                            feedbackBanner(banner)
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        periodSelector
                        printerAndPaperStage
                        themeSwatchStrip
                        personalizeCard
                        actionDock
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 28)
                }
                .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.size.width
                } action: { width in
                    studioWidth = width
                }
            }
            .navigationTitle("Çalışma fişi")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        OnboardingHaptics.light()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .accessibilityLabel("Kapat")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        triggerPrintSequence()
                    } label: {
                        Label("Yeniden kes", systemImage: "printer.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                    .disabled(isPrinting)
                    .accessibilityLabel("Fişi yeniden yazdır")
                }
            }
            .sheet(isPresented: $editingDetails) {
                ReceiptIdentityEditorSheet(prefs: $prefs)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .sheet(item: $sharePayload) { payload in
                ReceiptActivitySheet(image: payload.image)
                    .ignoresSafeArea()
            }
        }
        .onAppear {
            if !loadedPrefs {
                prefs = ReceiptPrefs.load(
                    defaultName: auth.displayName,
                    defaultTag: auth.educationSubtitle
                )
                loadedPrefs = true
            }
            triggerPrintSequence()
            Task { await unlockReceiptAchievementIfNeeded() }
        }
        .onChange(of: prefs) { _, updated in
            guard loadedPrefs else { return }
            updated.save()
        }
        .onChange(of: reduceMotion) { _, enabled in
            if enabled && isPrinting { triggerPrintSequence() }
        }
        .onDisappear {
            printTask?.cancel()
        }
    }

    // MARK: - 1. Period Switcher

    private var periodSelector: some View {
        FosforSegmentedBar(
            segments: ReceiptPeriod.allCases.map { p in
                .init(
                    value: p,
                    title: p.segmentTitle,
                    icon: p == .gun ? "sun.max.fill" : "calendar"
                )
            },
            selection: Binding(
                get: { period },
                set: { next in
                    guard next != period else { return }
                    period = next
                    triggerPrintSequence()
                }
            )
        )
    }

    // MARK: - 2. Thermal Printer Slot + Interactive 3D Paper Stage

    private var printerAndPaperStage: some View {
        let tearProgress = min(1.0, max(0, tearOffset / tearThreshold))
        let stageWidth = min(408, max(1, studioWidth - 32))
        let printerWidth = stageWidth - min(20, stageWidth * 0.06)
        let paperWidth = min(336, printerWidth * 0.96)
        let paperScale = paperWidth / 336
        let printerStatus: ReceiptPrinterView.Status = !isPrinting ? .ready
            : feedProgress < 1 ? .feeding : .stamping

        return VStack(spacing: 0) {
            ReceiptPrinterView(width: printerWidth, status: printerStatus)
                .zIndex(3)

            // Tear tension indicator pill when pulling down
            if tearProgress > 0.12 {
                HStack(spacing: 6) {
                    Image(systemName: tearProgress >= 1.0 ? "checkmark.circle.fill" : "scissors")
                        .font(.caption.weight(.bold))
                    Text(tearProgress >= 1.0 ? "Bırak · Story paylaşımı hazır!" : "Fişi koparmak için aşağı çek")
                        .font(.caption.weight(.bold))
                }
                .foregroundStyle(tearProgress >= 1.0 ? Theme.onHi : Theme.text)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(tearProgress >= 1.0 ? Theme.hi : Theme.surface, in: Capsule())
                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1.5))
                .padding(.top, 8)
                .transition(.scale.combined(with: .opacity))
                .zIndex(2)
            }

            // Extruding 3D Receipt Paper
            ZStack(alignment: .top) {
                ReceiptPaperView(
                    stats: stats,
                    prefs: prefs,
                    scale: paperScale,
                    flatTopEdge: tearProgress < 0.85,
                    stampSlammed: stampSlammed,
                    stampPulse: stampPulse,
                    glintOffset: glintOffset,
                    stampMotion: stampMotion
                )
                .overlay(alignment: .top) {
                    if tearOffset < 10 {
                        LinearGradient(
                            colors: [Color.black.opacity(0.27), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: 15)
                        .allowsHitTesting(false)
                    }
                }
                .clipShape(ReceiptFeedClipShape(progress: feedProgress, scale: paperScale))
                .offset(y: tearOffset + stampPulse * 2)
                .accessibilityHidden(feedProgress < 1)
                .rotation3DEffect(
                    .degrees(tiltPitch),
                    axis: (x: 1, y: 0, z: 0),
                    perspective: 0.55
                )
                .rotation3DEffect(
                    .degrees(tiltRoll),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.55
                )
                .rotationEffect(.degrees(Double(tearProgress) * -1.8))
                .shadow(
                    color: Color.black.opacity(prefs.theme == .gece ? 0.38 : 0.16),
                    radius: 18,
                    x: CGFloat(-tiltRoll * 0.8),
                    y: 12 + tearOffset * 0.2
                )
                .gesture(receiptInteractionGesture)
                .onTapGesture(count: 2) {
                    // Double-tap receipt to re-slam the ink stamp with a satisfying thud
                    slamStampAgain()
                }
            }
            .padding(.top, -2)

            Text("Fişi aşağı çekerek paylaş")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.78))
                .padding(.top, 12)
                .opacity(isPrinting || reduceMotion ? 0 : 1)
                .accessibilityHidden(isPrinting || reduceMotion)
        }
        .padding(.top, 6)
        .padding(.bottom, 12)
        .frame(width: stageWidth)
        .background { ReceiptPrinterDesk() }
    }

    private var receiptInteractionGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard !reduceMotion, !isPrinting else { return }
                let dx = value.translation.width
                let dy = value.translation.height

                tiltRoll = Double((dx / 150.0).clamped(to: -1...1)) * 10.5
                tiltPitch = Double((-dy / 220.0).clamped(to: -1...1)) * 7.5
                glintOffset = CGFloat((dx + dy * 0.6) / 180.0).clamped(to: -1.1...1.1)

                // Downward tear-off tension
                if dy > 14 && abs(dx) < 95 {
                    let damped = (dy - 14) * 0.62
                    tearOffset = min(96, damped)
                    let bucket = Int(tearOffset / 18)
                    if bucket > lastTearTickBucket {
                        lastTearTickBucket = bucket
                        if tearOffset >= tearThreshold {
                            OnboardingHaptics.medium()
                        } else {
                            OnboardingHaptics.selection()
                        }
                    }
                } else {
                    tearOffset = 0
                    lastTearTickBucket = 0
                }
            }
            .onEnded { _ in
                guard !reduceMotion, !isPrinting else { return }
                let shouldTearShare = tearOffset >= tearThreshold
                lastTearTickBucket = 0
                withAnimation(.spring(response: 0.42, dampingFraction: 0.74)) {
                    tiltPitch = 0
                    tiltRoll = 0
                    tearOffset = 0
                    glintOffset = 0.22
                }
                if shouldTearShare {
                    OnboardingHaptics.success()
                    openShareSheet()
                }
            }
    }

    // MARK: - 3. Theme Swatches

    private var themeSwatchStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("KAĞIT VE MÜREKKEP")
                    .font(.caption.weight(.heavy))
                    .tracking(0.6)
                    .foregroundStyle(Theme.text2)
                Spacer()
                Text(prefs.theme.subtitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.text3)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ReceiptThemeId.allCases) { themeId in
                        let selected = prefs.theme == themeId
                        let p = themeId.palette
                        Button {
                            guard prefs.theme != themeId else { return }
                            OnboardingHaptics.selection()
                            withAnimation(.spring(response: 0.34, dampingFraction: 0.80)) {
                                prefs.theme = themeId
                                glintOffset = -0.85
                            }
                            if !reduceMotion {
                                withAnimation(.easeOut(duration: 0.65)) {
                                    glintOffset = 0.35
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                ZStack {
                                    Circle()
                                        .fill(p.paper)
                                        .frame(width: 22, height: 22)
                                        .overlay(Circle().stroke(p.ink.opacity(0.35), lineWidth: 1.2))
                                    Circle()
                                        .fill(p.hi)
                                        .frame(width: 9, height: 9)
                                        .offset(x: 4, y: 4)
                                }
                                Text(themeId.label)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(selected ? Theme.onHi : Theme.text)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .background(
                                selected ? Theme.hi : Theme.surface,
                                in: RoundedRectangle(cornerRadius: 13)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 13)
                                    .stroke(selected ? Theme.cardLine : Theme.border, lineWidth: selected ? 2 : 1)
                            )
                        }
                        .buttonStyle(TactileCardButtonStyle())
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    // MARK: - 4. Personalization Card (Name, Tag & Quick Motto Chips)

    private var personalizeCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Fiş üstü imza ve not")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Theme.text)
                    Text("Not içerikleri asla yazılmaz; yalnızca seçtiğin kimlik ve sayısal özet görünür.")
                        .font(.caption)
                        .foregroundStyle(Theme.text3)
                }
                Spacer(minLength: 8)
                Button {
                    OnboardingHaptics.light()
                    editingDetails = true
                } label: {
                    Label("Düzenle", systemImage: "slider.horizontal.3")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(Theme.surface2, in: Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            // 1-tap mood preset chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(ReceiptPrefs.moodPresets, id: \.self) { preset in
                        let active = prefs.motto == preset
                        Button {
                            OnboardingHaptics.selection()
                            withAnimation(.snappy(duration: 0.22)) {
                                prefs.motto = active ? "" : preset
                            }
                        } label: {
                            Text(preset)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(active ? Theme.onHi : Theme.text2)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(active ? Theme.hi : Theme.surface2, in: Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(active ? Theme.cardLine : Theme.border, lineWidth: active ? 1.5 : 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - 5. Share & Save Action Dock

    private var actionDock: some View {
        VStack(spacing: 10) {
            Button {
                OnboardingHaptics.medium()
                openShareSheet()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "square.and.arrow.up")
                    Text("Story olarak paylaş (1080×1920)")
                }
            }
            .buttonStyle(PrimaryButtonStyle())

            Button {
                OnboardingHaptics.light()
                Task { await saveToPhotoLibrary() }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "arrow.down.to.line")
                    Text("Fotoğraflara kaydet")
                }
            }
            .buttonStyle(SecondaryButtonStyle())
        }
    }

    // MARK: - Banners

    private var achievementBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "receipt")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.onHi)
                .frame(width: 34, height: 34)
                .background(Theme.hi, in: Circle())
                .overlay(Circle().stroke(Theme.cardLine, lineWidth: 1.2))

            VStack(alignment: .leading, spacing: 1) {
                Text("Yeni başarım · Yaygın")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.text2)
                Text("Kasadan Geçti · İlk çalışma fişini kestin")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.text)
            }
            Spacer()
            Text("+20 XP")
                .font(.caption.weight(.heavy).monospacedDigit())
                .foregroundStyle(Theme.onHi)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Theme.hi, in: Capsule())
        }
        .padding(12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Theme.cardLine, lineWidth: 1.5))
    }

    private func feedbackBanner(_ banner: StudioBanner) -> some View {
        HStack(spacing: 8) {
            Image(systemName: banner.isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .foregroundStyle(banner.isError ? Theme.danger : Theme.success)
            Text(banner.message)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.text)
            Spacer()
        }
        .padding(12)
        .background(banner.isError ? Theme.dangerSoft : Theme.hiSoft, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Print Choreography & Actions

    private func triggerPrintSequence() {
        printTask?.cancel()
        printTask = nil
        tiltPitch = 0
        tiltRoll = 0
        tearOffset = 0
        lastTearTickBucket = 0
        stampPulse = 0
        stampMotion = .hidden

        if reduceMotion {
            feedProgress = 1
            stampSlammed = true
            isPrinting = false
            glintOffset = 0.2
            return
        }

        feedProgress = 0
        stampSlammed = false
        glintOffset = -1.1
        isPrinting = true
        printTask = Task { @MainActor in
            do {
                OnboardingHaptics.light()
                for progress in [0.23, 0.48, 0.74, 1.0] {
                    try await Task.sleep(for: .milliseconds(35))
                    withAnimation(.easeOut(duration: 0.16)) { feedProgress = progress }
                    OnboardingHaptics.selection()
                    try await Task.sleep(for: .milliseconds(155))
                }
                try await animateStamp()
                isPrinting = false
                printTask = nil
            } catch {
                // A new print, Reduce Motion or closing the studio cancels this sequence.
            }
        }
    }

    private func animateStamp() async throws {
        withAnimation(.easeOut(duration: 0.24)) { stampMotion = .hovering }
        try await Task.sleep(for: .milliseconds(240))

        withAnimation(.easeIn(duration: 0.13)) { stampMotion = .contact }
        try await Task.sleep(for: .milliseconds(130))

        OnboardingHaptics.medium()
        withAnimation(.spring(response: 0.25, dampingFraction: 0.68)) {
            stampSlammed = true
            stampPulse = 1
        }
        withAnimation(.easeOut(duration: 0.55)) { glintOffset = 0.28 }
        try await Task.sleep(for: .milliseconds(80))

        withAnimation(.easeOut(duration: 0.27)) { stampMotion = .retreating }
        withAnimation(.spring(response: 0.26, dampingFraction: 0.76)) { stampPulse = 0 }
        try await Task.sleep(for: .milliseconds(270))
        stampMotion = .hidden
    }

    private func slamStampAgain() {
        guard !reduceMotion, !isPrinting else { return }
        stampSlammed = false
        stampPulse = 0
        isPrinting = true
        printTask = Task { @MainActor in
            do {
                try await animateStamp()
                isPrinting = false
                printTask = nil
            } catch {
                // A restarted print or closing the studio owns the next state.
            }
        }
    }

    private func openShareSheet() {
        guard let img = ReceiptExporter.renderStoryImage(stats: stats, prefs: prefs) else {
            showBanner("Görsel hazırlanamadı, tekrar dene.", isError: true)
            return
        }
        sharePayload = ShareImagePayload(image: img)
    }

    private func saveToPhotoLibrary() async {
        guard let img = ReceiptExporter.renderStoryImage(stats: stats, prefs: prefs) else {
            showBanner("Görsel hazırlanamadı.", isError: true)
            return
        }
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            showBanner("Fotoğraflara kaydetmek için Ayarlar'dan izin ver veya Paylaş menüsünü kullan.", isError: true)
            return
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: img)
            }
            OnboardingHaptics.success()
            showBanner("1080×1920 Story fişin Fotoğraflar'a kaydedildi.", isError: false)
        } catch {
            showBanner("Kaydedilemedi. Paylaş düğmesinden kaydedebilirsin.", isError: true)
        }
    }

    private func showBanner(_ message: String, isError: Bool) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
            statusBanner = StudioBanner(message: message, isError: isError)
        }
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3.2))
            withAnimation {
                statusBanner = nil
            }
        }
    }

    private func unlockReceiptAchievementIfNeeded() async {
        guard auth.session != nil else { return }
        let current = auth.unlockedAchievements
        let held = auth.heldAchievements
        guard current["fis"] == nil, !held.contains("fis") else { return }

        var toUnlock = ["fis"]
        if current.count + 1 >= 10, current["koleksiyoncu"] == nil, !held.contains("koleksiyoncu") {
            toUnlock.append("koleksiyoncu")
        }
        do {
            try await auth.addAchievements(toUnlock)
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                unlockedAchievementBanner = true
            }
            try? await Task.sleep(for: .seconds(4))
            withAnimation {
                unlockedAchievementBanner = false
            }
        } catch {
            // Will retry next time receipt opens.
        }
    }
}

// MARK: - Identity & Motto Editor Sheet

private struct ReceiptIdentityEditorSheet: View {
    @Binding var prefs: ReceiptPrefs
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("İsim ve bölümü fişte göster", isOn: $prefs.showIdentity)
                    if prefs.showIdentity {
                        TextField("İsmin (isteğe bağlı)", text: $prefs.studentName)
                            .onChange(of: prefs.studentName) { _, v in
                                if v.count > 34 { prefs.studentName = String(v.prefix(34)) }
                            }
                        TextField("Okul / Bölüm / Hedef (ör. İTÜ · Bilgisayar)", text: $prefs.studentTag)
                            .onChange(of: prefs.studentTag) { _, v in
                                if v.count > 42 { prefs.studentTag = String(v.prefix(42)) }
                            }
                    }
                } header: {
                    Text("Kimlik satırları")
                } footer: {
                    Text("Story paylaşırken adını gizlemek istersen anahtarı kapatman yeterli.")
                }

                Section {
                    TextField("Fişin altındaki kısa cümle…", text: $prefs.motto, axis: .vertical)
                        .lineLimit(1...3)
                        .onChange(of: prefs.motto) { _, v in
                            if v.count > 72 { prefs.motto = String(v.prefix(72)) }
                        }
                    if !prefs.motto.isEmpty {
                        Button("Fiş notunu temizle", role: .destructive) {
                            prefs.motto = ""
                        }
                    }
                } header: {
                    Text("Fiş alt notu")
                }
            }
            .scrollContentBackground(.hidden)
            .background(GridPaper())
            .navigationTitle("Fişi kişiselleştir")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Tamam") { dismiss() }
                        .fontWeight(.bold)
                }
            }
        }
    }
}

// MARK: - Helpers & UIActivityViewController Wrapper

private struct ShareImagePayload: Identifiable {
    let id = UUID()
    let image: UIImage
}

private struct StudioBanner: Equatable {
    let message: String
    let isError: Bool
}

private struct ReceiptFeedClipShape: Shape {
    var progress: CGFloat
    let scale: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        if progress >= 1 { return Path(rect) }
        guard progress > 0 else { return Path() }

        let height = rect.height * progress
        return SerratedReceiptShape(
            toothWidth: 10.5 * scale,
            toothHeight: min(6.5 * scale, height * 0.4),
            flatTop: true
        ).path(in: CGRect(origin: rect.origin, size: CGSize(width: rect.width, height: height)))
    }
}

private struct ReceiptActivitySheet: UIViewControllerRepresentable {
    let image: UIImage

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [image], applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private extension Comparable {
    func clamped(to limits: ClosedRange<Self>) -> Self {
        min(max(self, limits.lowerBound), limits.upperBound)
    }
}
