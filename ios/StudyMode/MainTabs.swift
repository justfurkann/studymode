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
        // The level from the intro reaches the account a moment after sign-in.
        .onChange(of: auth.educationLevel) { _, level in store.audience = Exams.audience(forLevel: level) }
    }
}

struct AccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(StudyStore.self) private var store
    @State private var showDelete = false

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
                            Text(auth.displayEmail)
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
        }
    }
}
