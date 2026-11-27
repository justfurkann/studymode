import SwiftUI

/// The signed-in app: Dersler, Tekrar, Hesap.
struct MainTabs: View {
    @Environment(AuthModel.self) private var auth
    @State private var store = StudyStore()
    @State private var place = AssistantPlace()
    @State private var premium = PremiumStore()
    @State private var keyboardUp = false

    private var shareCatalog: PDFInbox.Catalog? {
        guard store.status == .ready, let user = auth.session?.user.id else { return nil }
        let courses = store.sortedCourses.map { PDFInbox.CourseChoice(id: $0.id, name: $0.name) }
        return PDFInbox.Catalog(user: user, courses: courses)
    }

    var body: some View {
        TabView {
            CoursesView()
                .tabItem { Label("Dersler", systemImage: "books.vertical") }
            ReviewTab()
                .tabItem { Label("Tekrar", systemImage: "rectangle.stack") }
                .badge(store.status == .ready ? min(store.goalLeft, store.todayQueue.count) : 0)
            ExamsHubTab()
                .tabItem { Label("Sınavlar", systemImage: "calendar.badge.clock") }
            AccountView()
                .tabItem { Label("Hesap", systemImage: "person.crop.circle") }
        }
        .overlay(alignment: .bottomTrailing) {
            if store.status == .ready && !place.open && !keyboardUp && place.courseId != nil {
                AssistantButton()
                    .padding(.trailing, 12)
                    .padding(.bottom, 86)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: place.open)
        .animation(.spring(response: 0.35, dampingFraction: 0.8), value: place.courseId)
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardUp = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardUp = false }
        .sheet(isPresented: Binding(get: { place.open }, set: { place.open = $0 })) {
            AssistantSheet()
                .environment(store)
                .environment(place)
                .presentationDetents([.medium, .large], selection: Binding(get: { place.detent }, set: { place.detent = $0 }))
                // Half height: the note underneath can still be read, scrolled and long-pressed.
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationCornerRadius(28)
                .presentationDragIndicator(.visible)
                .presentationBackground(Theme.bg)
        }
        .modifier(AchievementWatcher())
        .environment(store)
        .environment(place)
        .environment(premium)
        .task(id: auth.session?.user.id) {
            if let user = auth.session?.user.id { premium.start(user: user) } else { premium.stop() }
        }
        .onChange(of: shareCatalog, initial: true) { _, catalog in try? PDFInbox.publish(catalog) }
        .task {
            store.audience = Exams.audience(forLevel: auth.educationLevel)
            await store.load()
        }
        // The level from the intro reaches the account a moment after sign-in.
        .onChange(of: auth.educationLevel) { _, level in store.audience = Exams.audience(forLevel: level) }
    }
}

struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(StudyStore.self) private var store
    @Environment(PremiumStore.self) private var premium
    @Environment(CaptchaController.self) private var captcha
    @State private var showDelete = false
    @State private var replayIntro = false

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        TalkingFosfor(screen: .account, size: 52, mood: .proud) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(auth.displayName.isEmpty ? "Hesabın" : auth.displayName)
                                    .font(Theme.display(.title2))
                                    .foregroundStyle(Theme.text)
                                Text(auth.displayEmail)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text2)
                                if store.streak > 0 {
                                    Label("Seri: \(store.streak) gün", systemImage: "flame.fill")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(Theme.onHi)
                                        .padding(.horizontal, 9)
                                        .padding(.vertical, 4)
                                        .background(Theme.hi, in: Capsule())
                                        .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                                        .padding(.top, 4)
                                }
                                Text("Site ve uygulama aynı hesabı kullanır; notların ikisinde de görünür.")
                                    .font(.footnote)
                                    .foregroundStyle(Theme.text3)
                                    .padding(.top, 6)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .focusCard()
                        .staggeredAppear(0)

                        Button {
                            OnboardingHaptics.light()
                            replayIntro = true
                        } label: {
                            Label("Açılış tanıtımını gör", systemImage: "sparkles.rectangle.stack")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .staggeredAppear(1)

                        NavigationLink {
                            PremiumView()
                        } label: {
                            HStack(spacing: 13) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(.white.opacity(0.18))
                                        .frame(width: 40, height: 40)
                                    Image(systemName: premium.isPremium ? "checkmark.seal.fill" : "crown.fill")
                                        .font(.body.weight(.bold))
                                        .foregroundStyle(Theme.hi)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text("StudyMode Premium")
                                            .font(Theme.display(.headline, weight: .heavy))
                                            .foregroundStyle(.white)
                                        if premium.isPremium {
                                            Text("AÇIK")
                                                .font(.system(size: 10, weight: .heavy, design: .rounded))
                                                .foregroundStyle(Theme.onHi)
                                                .padding(.horizontal, 7)
                                                .padding(.vertical, 2)
                                                .background(Theme.hi, in: Capsule())
                                        }
                                    }
                                    Text(premium.isPremium
                                         ? "Sesli not, akıllı arama, görseller ve Free+ aktif."
                                         : "Sesli not, akıllı arama, görseller ve günde 150 istek")
                                        .font(.caption)
                                        .foregroundStyle(.white.opacity(0.86))
                                        .lineLimit(1)
                                }
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.white.opacity(0.75))
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                LinearGradient(
                                    colors: [Theme.premDeep, Theme.prem1, Theme.prem2],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .stroke(.white.opacity(0.22), lineWidth: 1)
                            )
                            .shadow(color: Theme.prem1.opacity(0.32), radius: 12, y: 6)
                        }
                        .buttonStyle(TactileCardButtonStyle(scale: 0.98))
                        .staggeredAppear(1)

                        NavigationLink {
                            AchievementsView()
                        } label: {
                            Label("Başarımlar ve seviye", systemImage: "trophy")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .staggeredAppear(1)

                        NavigationLink {
                            SettingsView()
                        } label: {
                            Label("Ayarlar", systemImage: "gearshape")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .staggeredAppear(1)

                        Link(destination: Config.siteURL) {
                            Label("studymode.fun'u aç", systemImage: "safari")
                        }
                        .buttonStyle(SecondaryButtonStyle())
                        .staggeredAppear(2)

                        Button(role: .destructive) {
                            Task {
                                await auth.signOut()
                                store.reset()
                                Assistant.clearAll()
                            }
                        } label: {
                            Text("Çıkış yap").foregroundStyle(Theme.danger)
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Hesabı sil")
                                .font(.headline)
                                .foregroundStyle(Theme.text)
                            Text("Hesabını ve içindeki her şeyi kalıcı olarak siler. Site ve uygulama aynı hesabı kullanır.")
                                .font(.footnote)
                                .foregroundStyle(Theme.text2)
                                .fixedSize(horizontal: false, vertical: true)
                            Button("Hesabı sil…") { showDelete = true }
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.danger)
                                .padding(.top, 2)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.danger.opacity(0.35), lineWidth: 1))
                        .padding(.top, 28)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Hesap")
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $showDelete) {
                DeleteAccountView()
                    .environment(auth)
                    .environment(store)
            }
            .fullScreenCover(isPresented: $replayIntro) {
                OnboardingView { _ in
                    replayIntro = false
                }
                .environment(captcha)
            }
        }
    }
}
