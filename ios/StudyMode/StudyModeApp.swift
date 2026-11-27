import SwiftUI

@main
struct StudyModeApp: App {
    @State private var auth = AuthModel()
    /// One bot check for the whole app, started at launch so a token is ready by sign-up.
    @State private var captcha = CaptchaController()
    @Environment(\.colorScheme) private var scheme
    /// Ayarlar → Görünüm: "system", "light" or "dark" (the site's theme setting).
    @AppStorage(AppTheme.key) private var theme = AppTheme.system.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(captcha)
                .tint(Theme.accent)
                .preferredColorScheme(AppTheme(rawValue: theme)?.scheme)
                .onAppear { captcha.start(dark: scheme == .dark) }
        }
    }
}

struct RootView: View {
    @Environment(AuthModel.self) private var auth
    @State private var showIntro = !OnboardingStore.isDone
    @State private var signUpFirst = true

    var body: some View {
        Group {
            switch auth.state {
            case .loading:
                ZStack {
                    GridPaper()
                    Image("Logo").resizable().scaledToFit().frame(height: 40)
                }
            case .signedOut:
                if showIntro {
                    OnboardingView { newAccount in
                        signUpFirst = newAccount
                        withAnimation(.snappy) { showIntro = false }
                    }
                    .transition(.opacity)
                } else {
                    LoginView(initialMode: signUpFirst ? .signUp : .signIn) {
                        withAnimation(.snappy) { showIntro = true }
                    }
                    .id(signUpFirst)
                    .transition(.opacity)
                }
            case .signedIn:
                MainTabs().id(auth.session?.user.id)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.state)
        .onChange(of: auth.state) { _, state in
            // Someone who signs out later goes straight to the sign-in card.
            if state == .signedOut { try? PDFInbox.publish(nil) }
            if state == .signedIn { signUpFirst = false; showIntro = false }
        }
    }
}
