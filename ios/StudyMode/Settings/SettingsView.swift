import Supabase
import SwiftUI

/// "Görünüm": the site's theme setting (system / light / dark), kept on this device.
enum AppTheme: String, CaseIterable, Identifiable {
    case system, light, dark
    static let key = "studymode.theme"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .system: "Sistem"
        case .light: "Açık"
        case .dark: "Koyu"
        }
    }
    var icon: String {
        switch self {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max"
        case .dark: "moon"
        }
    }
    var scheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}

/// Ayarlar, the parts of the site's Settings page that belong in the app: the daily card goal,
/// school level, theme, feedback and about. AI keys and Premium codes stay on the site.
struct SettingsView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @AppStorage(AppTheme.key) private var theme = AppTheme.system.rawValue

    @State private var goalText = ""
    @State private var levelError: String?
    @State private var savingLevel = false
    @State private var feedback = false

    private var currentLevel: StudentLevel? { auth.educationLevel.flatMap(StudentLevel.init(rawValue:)) }

    var body: some View {
        @Bindable var store = store
        Form {
            Section {
                Stepper(value: $store.dailyGoal, in: 1...500, step: store.dailyGoal < 30 ? 5 : 10) {
                    HStack {
                        Text("Günlük kart hedefi")
                        Spacer()
                        Text("\(store.dailyGoal) kart").monospacedDigit().foregroundStyle(Theme.text2)
                    }
                }
                Button("Varsayılana dön (\(ReviewRules.defaultDailyGoal))") { store.dailyGoal = ReviewRules.defaultDailyGoal }
                    .disabled(store.dailyGoal == ReviewRules.defaultDailyGoal)
            } header: {
                Text("Çalışma hedefi")
            } footer: {
                Text("Bugünkü tekrar bu hedefe göre gösterilir. En az 1 kart tekrarı veya 1 test tamamlamak günlük serini korur. Bu ayar bu cihazda tutulur.")
            }

            Section {
                Picker("Seviyen", selection: Binding(get: { currentLevel }, set: { level in
                    guard let level else { return }
                    Task { await saveLevel(level) }
                })) {
                    if currentLevel == nil { Text("Seçilmedi").tag(StudentLevel?.none) }
                    ForEach(StudentLevel.allCases) { level in
                        Text(level.label).tag(Optional(level))
                    }
                }
                .disabled(savingLevel)
                if let levelError { Text(levelError).foregroundStyle(Theme.danger).font(.footnote) }
            } header: {
                Text("Okulun")
            } footer: {
                Text("Ortaokul ve lisede sınavlar “yazılı” olarak adlandırılır, Bugün'de LGS/YKS geri sayımı çıkar. Site ve uygulama aynı bilgiyi kullanır.")
            }

            Section("Görünüm") {
                Picker("Tema", selection: $theme) {
                    ForEach(AppTheme.allCases) { t in
                        Label(t.label, systemImage: t.icon).tag(t.rawValue)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section {
                Button {
                    feedback = true
                } label: {
                    Label("Geri bildirim gönder", systemImage: "lightbulb")
                }
            } header: {
                Text("Fikrin mi var, hata mı buldun?")
            } footer: {
                Text("Yaz, doğrudan uygulamayı yapan kişiye gitsin. Her mesaj okunuyor.")
            }

            Section("Hakkında") {
                LabeledContent("Sürüm", value: Self.version)
                Link(destination: Config.siteURL.appending(path: "gizlilik")) { Label("Gizlilik", systemImage: "hand.raised") }
                Link(destination: Config.siteURL.appending(path: "kullanim-kosullari")) { Label("Kullanım koşulları", systemImage: "doc.text") }
                Link(destination: Config.siteURL.appending(path: "ayarlar")) { Label("Diğer ayarlar sitede", systemImage: "safari") }
            }
        }
        .scrollContentBackground(.hidden)
        .background(GridPaper())
        .navigationTitle("Ayarlar")
        .sheet(isPresented: $feedback) { FeedbackSheet().environment(auth) }
    }

    static var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "?"
        let b = info?["CFBundleVersion"] as? String ?? "?"
        return "\(v) (\(b))"
    }

    private func saveLevel(_ level: StudentLevel) async {
        guard level != currentLevel else { return }
        savingLevel = true
        levelError = nil
        defer { savingLevel = false }
        do {
            try await auth.setEducationLevel(level)
            store.audience = Exams.audience(forLevel: level.rawValue)
            OnboardingHaptics.success()
        } catch {
            levelError = "Kaydedilemedi. Bağlantını kontrol edip tekrar dene."
        }
    }
}

/// The site's FeedbackDialog: an idea, a bug or anything else, straight to the maker (public.feedback).
struct FeedbackSheet: View {
    @Environment(\.dismiss) private var dismiss

    enum Kind: String, CaseIterable, Identifiable {
        case fikir, hata, diger
        var id: String { rawValue }
        var label: String {
            switch self {
            case .fikir: "Fikir"
            case .hata: "Hata"
            case .diger: "Diğer"
            }
        }
        var placeholder: String {
            switch self {
            case .fikir: "Şu olsa çok iyi olurdu…"
            case .hata: "Ne yapıyordun, ne oldu? Hangi ekrandaydın?"
            case .diger: "Aklında ne varsa…"
            }
        }
    }

    private struct Row: Encodable { let kind: String; let message: String; let contact: String?; let page: String; let device: String }
    private static let lastSentKey = "studymode.feedbackSentAt"

    @State private var kind: Kind = .fikir
    @State private var message = ""
    @State private var sending = false
    @State private var sent = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if sent {
                    VStack(spacing: 16) {
                        FosforMascotView(size: 56, mood: .cheering)
                        Text("Teşekkürler! Mesajın doğrudan Furkan'a ulaştı; hepsini tek tek okuyor.")
                            .font(.headline)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.text)
                        Button("Kapat") { dismiss() }.buttonStyle(PrimaryButtonStyle())
                    }
                    .padding(24)
                } else {
                    Form {
                        Picker("Tür", selection: $kind) {
                            ForEach(Kind.allCases) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        Section {
                            TextField(kind.placeholder, text: $message, axis: .vertical)
                                .lineLimit(5...12)
                                .onChange(of: message) { _, m in if m.count > 2000 { message = String(m.prefix(2000)) } }
                        } footer: {
                            Text("Hesabınla birlikte gönderilir; gerekirse sana dönebiliriz. Notlarının içeriği gönderilmez.")
                        }
                        if let error { Text(error).foregroundStyle(Theme.danger) }
                    }
                }
            }
            .navigationTitle("Geri bildirim")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !sent {
                    ToolbarItem(placement: .cancellationAction) { Button("Vazgeç") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(sending ? "Gönderiliyor…" : "Gönder") { Task { await send() } }
                            .disabled(sending || message.trimmingCharacters(in: .whitespacesAndNewlines).count < 3)
                    }
                }
            }
        }
    }

    private func send() async {
        let text = message.trimmingCharacters(in: .whitespacesAndNewlines)
        // A short pause between two messages, against accidental double sends (FEEDBACK_COOLDOWN_MS).
        let last = UserDefaults.standard.double(forKey: Self.lastSentKey)
        if Date.now.timeIntervalSince1970 - last < 20 {
            error = "Az önce gönderdin; birkaç saniye bekleyip yeniden dene."
            return
        }
        sending = true
        error = nil
        defer { sending = false }
        let device = "iOS uygulaması \(SettingsView.version) · \(UIDevice.current.model) · iOS \(UIDevice.current.systemVersion)"
        do {
            try await supabase.from("feedback").insert(Row(kind: kind.rawValue, message: text, contact: nil, page: "ios-app/ayarlar", device: String(device.prefix(300)))).execute()
            UserDefaults.standard.set(Date.now.timeIntervalSince1970, forKey: Self.lastSentKey)
            OnboardingHaptics.success()
            withAnimation { sent = true }
        } catch {
            self.error = "Gönderilemedi. İnternet bağlantını kontrol edip yeniden dene."
        }
    }
}
