import SwiftUI

@main
struct StudyModeApp: App {
    @State private var auth = AuthModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .tint(Theme.accent)
        }
    }
}

struct RootView: View {
    @Environment(AuthModel.self) private var auth

    var body: some View {
        Group {
            switch auth.state {
            case .loading:
                ZStack {
                    GridPaper()
                    Image("Logo").resizable().scaledToFit().frame(height: 40)
                }
            case .signedOut:
                LoginView()
            case .signedIn:
                MainTabs()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.state)
    }
}
