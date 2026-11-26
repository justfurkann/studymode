import SwiftUI

/// Sign in, sign up and forgot password on one card, with the same wording as the site (/giris).
struct LoginView: View {
    enum Mode { case signIn, signUp, forgot }

    @Environment(AuthModel.self) private var auth
    @State private var mode: Mode = .signIn
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var repeatPassword = ""
    @State private var showPassword = false
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?
    @State private var captcha = CaptchaController()
    @FocusState private var focus: Field?

    enum Field { case first, last, email, password, repeatPassword }

    private var title: String {
        switch mode {
        case .signIn: "Giriş yap"
        case .signUp: "Hesap oluştur"
        case .forgot: "Şifremi unuttum"
        }
    }

    private var mismatch: Bool {
        mode == .signUp && !repeatPassword.isEmpty && !password.hasPrefix(repeatPassword)
    }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(spacing: 28) {
                    header
                    card
                    legal
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var header: some View {
        VStack(spacing: 14) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(height: 40)
                .accessibilityLabel("StudyMode")
            VStack(spacing: 2) {
                Text("Notunu yükle,")
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
                HStack(spacing: 6) {
                    Highlighted(text: "önemlisini", font: Theme.display(.title))
                    Text("biz")
                        .font(Theme.display(.title))
                        .foregroundStyle(Theme.text)
                }
                Text("işaretleyelim.")
                    .font(Theme.display(.title))
                    .foregroundStyle(Theme.text)
            }
            .multilineTextAlignment(.center)
        }
        .padding(.top, 8)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.text)
                Text(mode == .forgot
                     ? "E-posta adresini yaz, sana yeni şifre belirleyebileceğin bir bağlantı gönderelim."
                     : "Hesapla notların, kartların ve ilerlemen tüm cihazlarında senkronize olur.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if mode == .signUp {
                HStack(spacing: 10) {
                    TextField("Ad", text: $firstName)
                        .textContentType(.givenName)
                        .focused($focus, equals: .first)
                        .submitLabel(.next)
                        .onSubmit { focus = .last }
                        .field()
                    TextField("Soyad", text: $lastName)
                        .textContentType(.familyName)
                        .focused($focus, equals: .last)
                        .submitLabel(.next)
                        .onSubmit { focus = .email }
                        .field()
                }
            }

            TextField("E-posta", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: .email)
                .submitLabel(mode == .forgot ? .send : .next)
                .onSubmit { mode == .forgot ? submit() : (focus = .password) }
                .field()

            if mode != .forgot {
                passwordField("Şifre", text: $password, field: .password, content: mode == .signUp ? .newPassword : .password)
                if mode == .signUp {
                    passwordField("Şifre (tekrar)", text: $repeatPassword, field: .repeatPassword, content: .newPassword)
                    if mismatch {
                        Text("Şifreler aynı değil.")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.danger)
                    }
                }
                HStack {
                    Toggle(isOn: $showPassword) {
                        Text("Şifreyi göster").font(.footnote).foregroundStyle(Theme.text2)
                    }
                    .toggleStyle(CheckboxStyle())
                    Spacer()
                    if mode == .signIn {
                        Button("Şifremi unuttum") { switchMode(.forgot) }
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.text)
                            .underline()
                    }
                }
            }

            TurnstileView(controller: captcha)
                .frame(height: 68)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Bot doğrulaması")

            if let error {
                Message(text: error, kind: .error)
            }
            if let info {
                Message(text: info, kind: .info)
            }

            Button(action: submit) {
                HStack(spacing: 8) {
                    if busy { ProgressView().tint(Theme.onHi) }
                    Text(mode == .forgot ? "Yenileme bağlantısı gönder" : title)
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(busy)
            .padding(.top, 4)

            HStack(spacing: 4) {
                Text(mode == .signUp ? "Zaten hesabın var mı?" : mode == .forgot ? "Şifreni hatırladın mı?" : "Hesabın yok mu?")
                    .foregroundStyle(Theme.text2)
                Button(mode == .signIn ? "Hesap oluştur" : "Giriş yap") {
                    switchMode(mode == .signIn ? .signUp : .signIn)
                }
                .fontWeight(.semibold)
                .foregroundStyle(Theme.text)
                .underline()
            }
            .font(.subheadline)
            .frame(maxWidth: .infinity)
            .padding(.top, 4)
        }
        .focusCard()
    }

    private var legal: some View {
        (Text("Devam ederek ")
         + Text("[kullanım koşullarını](https://studymode.fun/kullanim-kosullari)").underline()
         + Text(" kabul etmiş ve ")
         + Text("[gizlilik politikasını](https://studymode.fun/gizlilik)").underline()
         + Text(" okumuş olursun."))
            .font(.footnote)
            .foregroundStyle(Theme.text3)
            .tint(Theme.text2)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 12)
    }

    private func passwordField(_ label: String, text: Binding<String>, field: Field, content: UITextContentType) -> some View {
        Group {
            if showPassword {
                TextField(label, text: text)
            } else {
                SecureField(label, text: text)
            }
        }
        .textContentType(content)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .focused($focus, equals: field)
        .submitLabel(field == .repeatPassword || mode == .signIn ? .go : .next)
        .onSubmit {
            if mode == .signUp && field == .password { focus = .repeatPassword } else { submit() }
        }
        .field()
    }

    private func switchMode(_ next: Mode) {
        withAnimation(.snappy(duration: 0.25)) {
            mode = next
            error = nil
            info = nil
        }
    }

    private func submit() {
        error = nil
        info = nil
        let mail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard mail.contains("@") else { return error = "Geçerli bir e-posta adresi yaz." }
        if mode == .signUp {
            if firstName.trimmingCharacters(in: .whitespaces).isEmpty || lastName.trimmingCharacters(in: .whitespaces).isEmpty {
                return error = "Adını ve soyadını yaz."
            }
            if password.count < 6 { return error = "Şifre en az 6 karakter olmalı." }
            if password != repeatPassword { return error = "Şifreler aynı değil." }
        } else if mode == .signIn, password.isEmpty {
            return error = "Şifreni yaz."
        }
        guard let token = captcha.take() else {
            return error = "Bot doğrulamasının bitmesini bekle; kutu birkaç saniyede kendiliğinden işaretlenir."
        }
        focus = nil
        busy = true
        Task {
            defer { busy = false }
            do {
                switch mode {
                case .signIn:
                    try await auth.signIn(email: mail, password: password, captcha: token)
                case .signUp:
                    let name = "\(firstName.trimmingCharacters(in: .whitespaces)) \(lastName.trimmingCharacters(in: .whitespaces))"
                    let needsConfirm = try await auth.signUp(name: name, email: mail, password: password, captcha: token)
                    if needsConfirm {
                        info = "Hesabın oluşturuldu. \(mail) adresine bir onay bağlantısı gönderdik; ona dokunduktan sonra buradan giriş yap."
                        mode = .signIn
                        password = ""
                        repeatPassword = ""
                    }
                case .forgot:
                    try await auth.resetPassword(email: mail, captcha: token)
                    info = "Bu e-postayla bir hesap varsa şifre yenileme bağlantısı gönderdik. Gelen kutunu (ve gereksiz klasörünü) kontrol et."
                }
            } catch {
                self.error = authMessage(error)
            }
        }
    }
}

private struct CheckboxStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle() } label: {
            HStack(spacing: 6) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .foregroundStyle(configuration.isOn ? Theme.accent : Theme.text3)
                configuration.label
            }
        }
        .buttonStyle(.plain)
    }
}

struct Message: View {
    enum Kind { case error, info }
    let text: String
    let kind: Kind

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: kind == .error ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                .foregroundStyle(kind == .error ? Theme.danger : Theme.success)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(kind == .error ? Theme.dangerSoft : Theme.hiSoft, in: RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    LoginView().environment(AuthModel())
}
