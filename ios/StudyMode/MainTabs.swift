import SwiftUI

/// The signed-in app: Dersler, Tekrar, Hesap.
struct MainTabs: View {
    @Environment(AuthModel.self) private var auth
    @State private var store = StudyStore()

    var body: some View {
        TabView {
            CoursesView()
                .tabItem { Label("Dersler", systemImage: "books.vertical") }
            ReviewTab()
                .tabItem { Label("Tekrar", systemImage: "rectangle.stack") }
                .badge(store.dueCount())
            AccountView()
                .tabItem { Label("Hesap", systemImage: "person.crop.circle") }
        }
        .environment(store)
        .task {
            store.audience = Exams.audience(forLevel: auth.educationLevel)
            await store.load()
        }
    }
}

struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(StudyStore.self) private var store

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(auth.displayName.isEmpty ? "Hesabın" : auth.displayName)
                                .font(Theme.display(.title2))
                                .foregroundStyle(Theme.text)
                            Text(auth.email)
                                .font(.subheadline)
                                .foregroundStyle(Theme.text2)
                            Text("Site ve uygulama aynı hesabı kullanır; notların ikisinde de görünür.")
                                .font(.footnote)
                                .foregroundStyle(Theme.text3)
                                .padding(.top, 6)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .focusCard()

                        Link(destination: Config.siteURL) {
                            Label("studymode.fun'u aç", systemImage: "safari")
                        }
                        .buttonStyle(SecondaryButtonStyle())

                        Button(role: .destructive) {
                            Task {
                                await auth.signOut()
                                store.reset()
                            }
                        } label: {
                            Text("Çıkış yap").foregroundStyle(Theme.danger)
                        }
                        .buttonStyle(SecondaryButtonStyle())
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Hesap")
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}
