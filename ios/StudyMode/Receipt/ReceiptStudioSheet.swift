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

        return VStack(spacing: 0) {
            // Physical Thermal Printer Bezel
            HStack(spacing: 10) {
                Circle()
                    .fill(isPrinting ? Theme.hi : Theme.success)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color.black.opacity(0.35), lineWidth: 1))

                Text(isPrinting ? "TERMAL KASA · YAZDIRILIYOR…" : "TERMAL KASA · \(stats.receiptNo)")
                    .font(.system(size: 10.5, weight: .heavy, design: .monospaced))
                    .tracking(0.8)
                    .foregroundStyle(.white.opacity(0.9))

                Spacer()

                Text(tearProgress > 0.15 ? "KOPARMAK İÇİN ÇEK" : "EĞ · AŞAĞI ÇEK PAYLAŞ")
                    .font(.system(size: 9.5, weight: .bold, design: .monospaced))
                    .foregroundStyle(tearProgress > 0.85 ? Theme.hi : .white.opacity(0.62))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(
                LinearGradient(
                    colors: [
                        Color(uiColor: UIColor(hex: 0x22295A)),
                        Color(uiColor: UIColor(hex: 0x151A3B)),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                ),
                in: UnevenRoundedRectangle(
                    topLeadingRadius: 18,
                    bottomLeadingRadius: 6,
                    bottomTrailingRadius: 6,
                    topTrailingRadius: 18
                )
            )
            .overlay(
                UnevenRoundedRectangle(
                    topLeadingRadius: 18,
                    bottomLeadingRadius: 6,
                    bottomTrailingRadius: 6,
                    topTrailingRadius: 18
                )
                .stroke(Theme.cardLine, lineWidth: 2)
            )
            .overlay(alignment: .bottom) {
                // Dark recessed paper exit slot
                Capsule()
                    .fill(Color.black.opacity(0.72))
                    .frame(height: 6)
                    .padding(.horizontal, 12)
                    .offset(y: 2)
            }
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
                    scale: 1.0,
                    flatTopEdge: tearProgress < 0.85,
                    stampSlammed: stampSlammed,
                    stampPulse: stampPulse,
                    glintOffset: glintOffset
                )
                .clipShape(ReceiptFeedClipShape(progress: feedProgress))
                .offset(y: (1.0 - feedProgress) * -64 + tearOffset)
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
                // Top printer lip contact shadow
                .overlay(alignment: .top) {
                    if tearOffset < 10 {
                        LinearGradient(
                            colors: [Color.black.opacity(0.20), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(width: 336, height: 12)
                        .allowsHitTesting(false)
                    }
                }
                .gesture(receiptInteractionGesture)
                .onTapGesture(count: 2) {
                    // Double-tap receipt to re-slam the ink stamp with a satisfying thud
                    slamStampAgain()
                }
            }
            .padding(.top, -2)
            .padding(.bottom, 6)
        }
    }

    private var receiptInteractionGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard !reduceMotion else { return }
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
        if reduceMotion {
            feedProgress = 1.0
            stampSlammed = true
            isPrinting = false
            glintOffset = 0.2
            return
        }

        isPrinting = true
        feedProgress = 0.08
        stampSlammed = false
        stampPulse = 0
        glintOffset = -1.1

        printTask = Task { @MainActor in
            OnboardingHaptics.light()
            withAnimation(.timingCurve(0.18, 0.86, 0.30, 1.0, duration: 0.52)) {
                feedProgress = 1.0
            }

            try? await Task.sleep(for: .milliseconds(130))
            guard !Task.isCancelled else { return }
            OnboardingHaptics.selection()

            try? await Task.sleep(for: .milliseconds(140))
            guard !Task.isCancelled else { return }
            OnboardingHaptics.selection()

            try? await Task.sleep(for: .milliseconds(210))
            guard !Task.isCancelled else { return }

            // Rubber stamp slam!
            OnboardingHaptics.medium()
            withAnimation(.spring(response: 0.28, dampingFraction: 0.62)) {
                stampSlammed = true
                stampPulse = 1.0
            }
            withAnimation(.easeOut(duration: 0.65)) {
                glintOffset = 0.28
            }

            try? await Task.sleep(for: .milliseconds(220))
            guard !Task.isCancelled else { return }
            withAnimation(.spring(response: 0.30, dampingFraction: 0.75)) {
                stampPulse = 0
                isPrinting = false
            }
        }
    }

    private func slamStampAgain() {
        guard !reduceMotion else { return }
        stampSlammed = false
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(40))
            OnboardingHaptics.medium()
            withAnimation(.spring(response: 0.26, dampingFraction: 0.58)) {
                stampSlammed = true
                stampPulse = 1.0
            }
            try? await Task.sleep(for: .milliseconds(200))
            withAnimation(.spring(response: 0.28, dampingFraction: 0.75)) {
                stampPulse = 0
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

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let clamped = min(max(progress, 0.02), 1.0)
        return Path(CGRect(x: 0, y: 0, width: rect.width, height: rect.height * clamped))
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
