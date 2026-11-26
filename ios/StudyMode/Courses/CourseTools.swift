import CoreImage.CIFilterBuiltins
import SwiftUI

// MARK: - Dersi düzenle

/// Name and color (the site's CourseForm; exams have their own editor in the app).
struct CourseEditSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let course: Course

    @State private var name = ""
    @State private var color = CourseColors.all[0]
    @State private var saving = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Ders adı") {
                    TextField("Örn. Fizyoloji I", text: $name)
                        .onChange(of: name) { _, n in if n.count > 120 { name = String(n.prefix(120)) } }
                }
                Section("Renk") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 14) {
                        ForEach(CourseColors.all, id: \.self) { hex in
                            Button {
                                OnboardingHaptics.selection()
                                color = hex
                            } label: {
                                Circle()
                                    .fill(Color(hexString: hex) ?? Theme.accent)
                                    .frame(width: 40, height: 40)
                                    .overlay {
                                        if color.lowercased() == hex {
                                            Image(systemName: "checkmark").font(.headline.weight(.heavy)).foregroundStyle(.white)
                                        }
                                    }
                                    .overlay(Circle().stroke(Theme.cardLine, lineWidth: color.lowercased() == hex ? 2.5 : 0))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Renk \(hex)")
                            .accessibilityAddTraits(color.lowercased() == hex ? .isSelected : [])
                        }
                    }
                    .padding(.vertical, 6)
                }
                if let error { Section { Text(error).foregroundStyle(Theme.danger) } }
            }
            .navigationTitle("Dersi düzenle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Vazgeç") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Kaydediliyor…" : "Kaydet") { Task { await save() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
            .onAppear {
                name = course.name
                color = course.color.lowercased()
            }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            try await store.editCourse(course, name: name.trimmingCharacters(in: .whitespacesAndNewlines), color: color)
            OnboardingHaptics.success()
            dismiss()
        } catch {
            self.error = "Ders kaydedilemedi. Bağlantını kontrol edip tekrar dene."
        }
    }
}

// MARK: - Dersi paylaş

/// One link (and QR code) per course; a friend copies the course into their own account (ShareCourse.tsx).
struct CourseShareSheet: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(\.dismiss) private var dismiss
    let course: Course

    @State private var share: CourseShare?
    @State private var counts: (notes: Int, cards: Int, questions: Int, exams: Int)?
    @State private var loading = true
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Arkadaşın bu dersin notlarını, özetlerini, kartlarını, sorularını ve yaklaşan sınav tarihlerini kendi hesabına kopyalar. Senin ilerlemen, yazılı cevapların ve puanların paylaşılmaz.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                    if let counts {
                        Text("Paylaşılacak: \(counts.notes) not · \(counts.cards) kart · \(counts.questions) soru\(counts.exams > 0 ? " · \(counts.exams) sınav tarihi" : "")")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.text2)
                    }

                    if loading {
                        ProgressView("Paylaşım bilgisi yükleniyor…").frame(maxWidth: .infinity)
                    } else if let share {
                        linkPanel(share)
                    } else {
                        Message(text: "Bağlantıya sahip olan herkes bu dersi görebilir. Hocanın materyallerini yalnızca güvendiğin kişilerle paylaş; istediğin an kapatabilirsin.", kind: .warning)
                        Button {
                            Task { await create() }
                        } label: {
                            HStack(spacing: 6) {
                                if busy { ProgressView() } else { Image(systemName: "link") }
                                Text("Bağlantı oluştur")
                            }
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(busy || (counts?.notes ?? 0) == 0)
                        if (counts?.notes ?? 0) == 0 {
                            Text("Paylaşmak için derste en az bir not olmalı.").font(.caption).foregroundStyle(Theme.text2)
                        }
                    }
                    if let info { Message(text: info, kind: .info) }
                    if let error { Message(text: error, kind: .error) }
                }
                .padding(16)
            }
            .background(GridPaper())
            .navigationTitle("Dersi paylaş")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Kapat") { dismiss() } } }
            .task { await loadShare() }
        }
    }

    @ViewBuilder
    private func linkPanel(_ share: CourseShare) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(share.url.absoluteString)
                .font(.footnote.monospaced())
                .foregroundStyle(Theme.text)
                .textSelection(.enabled)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))

            ShareLink(item: share.url, subject: Text(course.name), message: Text("\(course.name) dersimi StudyMode'da seninle paylaştım:")) {
                Label("WhatsApp, Instagram… ile paylaş", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(PrimaryButtonStyle())

            Button {
                UIPasteboard.general.url = share.url
                OnboardingHaptics.success()
                info = "Bağlantı kopyalandı."
            } label: {
                Label("Bağlantıyı kopyala", systemImage: "doc.on.doc")
            }
            .buttonStyle(SecondaryButtonStyle())

            if let qr = QRImage.make(share.url.absoluteString) {
                VStack(spacing: 8) {
                    Image(uiImage: qr)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 200, height: 200)
                        .padding(10)
                        .background(Theme.hi, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardLine, lineWidth: 1.5))
                        .accessibilityLabel("Paylaşım bağlantısının QR kodu")
                    Text("Yanındaysa telefon kamerasıyla okutsun.")
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                }
                .frame(maxWidth: .infinity)
            }

            if let date = Dates.parse(share.updatedAt) {
                Text("Son güncelleme: \(date.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).hour().minute())). Derse sonradan eklediklerin, bağlantıyı güncelleyene kadar paylaşılmaz.")
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
            }

            Button {
                Task { await refresh(share) }
            } label: {
                Label("Dersin şimdiki hâliyle güncelle", systemImage: "arrow.clockwise")
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(busy)

            Button(role: .destructive) {
                Task { await close(share) }
            } label: {
                Label("Paylaşımı kapat", systemImage: "trash").foregroundStyle(Theme.danger)
            }
            .buttonStyle(SecondaryButtonStyle())
            .disabled(busy)
        }
    }

    /// The name a friend sees on the link: never the email address.
    private var ownerName: String? {
        let name = auth.displayName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty || name.contains("@") ? nil : name
    }

    private func loadShare() async {
        defer { loading = false }
        do {
            async let current = store.currentShare(of: course)
            async let snap = store.shareSnapshot(of: course)
            share = try await current
            let s = try await snap
            counts = (s.notes, s.cards, s.questions, s.exams)
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Paylaşım bilgisi yüklenemedi."
        }
    }

    private func run(_ work: () async throws -> Void) async {
        busy = true
        error = nil
        info = nil
        defer { busy = false }
        do { try await work() } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Bir sorun oluştu. Yeniden dene."
        }
    }

    private func create() async {
        await run {
            let s = try await store.shareSnapshot(of: course)
            share = try await store.createShare(of: course, snapshot: s.snapshot, ownerName: ownerName)
            OnboardingHaptics.success()
        }
    }

    private func refresh(_ current: CourseShare) async {
        await run {
            let s = try await store.shareSnapshot(of: course)
            counts = (s.notes, s.cards, s.questions, s.exams)
            share = try await store.updateShare(current, course: course, snapshot: s.snapshot)
            info = "Bağlantı güncellendi."
        }
    }

    private func close(_ current: CourseShare) async {
        await run {
            try await store.deleteShare(current)
            share = nil
            info = "Paylaşım kapatıldı; bağlantı artık çalışmaz."
        }
    }
}

enum QRImage {
    /// Ink on transparent, scaled up so it stays sharp.
    static func make(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)) else { return nil }
        let colored = output.applyingFilter("CIFalseColor", parameters: [
            "inputColor0": CIColor(red: 0.106, green: 0.133, blue: 0.314),
            "inputColor1": CIColor(red: 1, green: 0.882, blue: 0.302),
        ])
        guard let cg = CIContext().createCGImage(colored, from: colored.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}
