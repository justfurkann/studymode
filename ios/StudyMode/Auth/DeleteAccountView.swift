import SwiftUI

/// Hesap → "Hesabı sil": same wording and the same "SİL" check as the site (src/components/DeleteAccount.tsx).
struct DeleteAccountView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var word = ""
    @State private var busy = false
    @State private var error: String?
    @State private var premiumUntil: String?
    @State private var premiumOK = false

    /// "SİL" in any case, also without the dotted İ (deleteWordOk on the site).
    private var wordOK: Bool {
        let w = word.trimmingCharacters(in: .whitespaces).uppercased(with: Locale(identifier: "tr_TR"))
        return w == "SİL" || w == "SIL"
    }

    private var canDelete: Bool { wordOK && !busy && (premiumUntil == nil || premiumOK) }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        (Text(auth.email.isEmpty ? "Hesabın" : emailLabel(auth.email)).bold()
                         + Text(" hesabı ve içindeki her şey kalıcı olarak silinecek. ")
                         + Text("Bu geri alınamaz.").bold())
                            .font(.body)
                            .foregroundStyle(Theme.text)
                            .fixedSize(horizontal: false, vertical: true)

                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(["Dersler ve notlar", "Kartlar ve tekrar geçmişi", "Test ve sınav sonuçları", "Seri ve çalışma günleri", "Paylaşım bağlantıları"], id: \.self) { item in
                                Label(item, systemImage: "minus.circle")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text2)
                            }
                            Text(auth.isAppleAccount
                                 ? "Site ve uygulama aynı hesabı kullandığı için ikisinden de silinir. Apple ile girdiğin için Apple bir kez daha onay isteyecek."
                                 : "Site ve uygulama aynı hesabı kullandığı için ikisinden de silinir.")
                                .font(.footnote)
                                .foregroundStyle(Theme.text3)
                                .padding(.top, 4)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))

                        if let premiumUntil {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Premium süren \(AccountDeletion.dateText(premiumUntil)) tarihine kadar devam ediyor. Hesabı silersen kalan süre kaybolur, iade edilmez ve başka hesaba taşınamaz.")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text)
                                    .fixedSize(horizontal: false, vertical: true)
                                Toggle("Anladım, Premium süremden vazgeçiyorum", isOn: $premiumOK)
                                    .font(.subheadline.weight(.semibold))
                                    .tint(Theme.danger)
                            }
                            .padding(14)
                            .background(Theme.dangerSoft, in: RoundedRectangle(cornerRadius: 14))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Onaylamak için SİL yaz")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.text)
                            TextField("SİL", text: $word)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .field()
                        }

                        if let error { Message(text: error, kind: .error) }

                        Button(action: delete) {
                            HStack(spacing: 8) {
                                if busy { ProgressView().tint(.white) } else { Image(systemName: "trash") }
                                Text("Hesabımı kalıcı olarak sil")
                            }
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(Theme.danger, in: RoundedRectangle(cornerRadius: 14))
                            .opacity(canDelete ? 1 : 0.45)
                        }
                        .disabled(!canDelete)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Hesabı sil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { dismiss() }.disabled(busy)
                }
            }
            .interactiveDismissDisabled(busy)
        }
    }

    /// Apple's private relay addresses read as noise; show what they are.
    private func emailLabel(_ email: String) -> String {
        email.lowercased().hasSuffix("@privaterelay.appleid.com") ? "Apple (gizli e-posta)" : email
    }

    private func delete() {
        error = nil
        busy = true
        Task {
            // An Apple account: Apple is asked once more so the site can revoke its token.
            let appleCode = auth.isAppleAccount ? await AppleSignIn.freshAuthorizationCode() : nil
            let outcome = await AccountDeletion.delete(premiumOK: premiumOK, appleAuthorizationCode: appleCode)
            busy = false
            switch outcome {
            case .deleted:
                store.reset()
                await auth.signOutLocally()
            case let .premiumActive(until):
                premiumUntil = until
                premiumOK = false
            case let .failed(message):
                error = message
            }
        }
    }
}
