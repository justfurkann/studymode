import SwiftUI
import VisionKit

/// A shared course link that reached the app (an opened link, a pasted link or a scanned QR code).
@MainActor
@Observable
final class SharedLinks {
    static let shared = SharedLinks()
    /// The token to show; CoursesView opens it.
    var pending: String?

    /// https://studymode.fun/paylas/<token> → shows that course. Returns false for other links.
    @discardableResult
    func open(_ url: URL) -> Bool {
        guard url.path.contains("/paylas/"), let token = SharedCourses.token(from: url.absoluteString) else { return false }
        pending = token
        return true
    }
}

/// Paste a friend's link or scan the QR code from their screen.
struct AddSharedCourseSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onToken: (String) -> Void
    @State private var link = ""
    @State private var scanning = false
    @State private var wrong = false

    private var canScan: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Arkadaşın dersi StudyMode'da paylaştıysa bağlantısını yapıştır ya da ekranındaki QR kodu tara. Ders senin hesabına kopyalanır; kartların sıfırdan başlar.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                            .fixedSize(horizontal: false, vertical: true)

                        if canScan {
                            Button { scanning = true } label: { Label("QR kodu tara", systemImage: "qrcode.viewfinder") }
                                .buttonStyle(PrimaryButtonStyle())
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Bağlantı").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            TextField("studymode.fun/paylas/…", text: $link)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.URL)
                                .field()
                                .onSubmit(submit)
                            HStack(spacing: 10) {
                                PasteButton(payloadType: String.self) { strings in
                                    guard let text = strings.first else { return }
                                    link = text
                                    submit()
                                }
                                .labelStyle(.titleAndIcon)
                                .buttonBorderShape(.capsule)
                                Spacer()
                                Button("Aç", action: submit)
                                    .buttonStyle(SecondaryButtonStyle())
                                    .frame(maxWidth: 120)
                                    .disabled(link.trimmingCharacters(in: .whitespaces).isEmpty)
                            }
                        }

                        if wrong {
                            Message(text: "Bu bir StudyMode ders bağlantısına benzemiyor. Bağlantı studymode.fun/paylas/ ile başlar.", kind: .warning)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Paylaşılan ders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Vazgeç") { dismiss() } }
            }
            .sheet(isPresented: $scanning) {
                QRScanner { text in
                    scanning = false
                    link = text
                    submit()
                }
                .ignoresSafeArea()
            }
        }
    }

    private func submit() {
        guard let token = SharedCourses.token(from: link) else { wrong = true; return }
        wrong = false
        onToken(token)
    }
}

/// /paylas/:token in the app: what the friend shared, and "Derslerime ekle".
struct SharedCourseView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let token: String
    let onOpen: (Course) -> Void

    private enum Phase { case loading, missing, failed(String), ready(FetchedShare) }
    @State private var phase: Phase = .loading
    @State private var adding = false
    @State private var addError: String?

    private var existing: Course? {
        SharedCourses.importedCourse(token).flatMap { id in store.courses.first { $0.id == id } }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                content
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() }.disabled(adding) }
            }
            .interactiveDismissDisabled(adding)
        }
        .task(id: token) { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .loading:
            VStack(spacing: 12) {
                ProgressView()
                Text("Paylaşılan ders yükleniyor…").font(.subheadline).foregroundStyle(Theme.text2)
            }
        case .missing:
            VStack(alignment: .leading, spacing: 10) {
                Text("Bu bağlantı çalışmıyor").font(Theme.display(.title3)).foregroundStyle(Theme.text)
                Text("Paylaşım kapatılmış ya da bağlantı eksik kopyalanmış olabilir. Arkadaşından bağlantıyı yeniden göndermesini iste.")
                    .font(.subheadline).foregroundStyle(Theme.text2)
            }
            .padding(20)
            .focusCard()
            .padding(16)
        case let .failed(message):
            VStack(spacing: 12) {
                Message(text: message, kind: .error)
                Button("Tekrar dene") { Task { await load() } }.buttonStyle(SecondaryButtonStyle())
            }
            .padding(20)
        case let .ready(share):
            ready(share)
        }
    }

    private func ready(_ share: FetchedShare) -> some View {
        let s = share.snapshot
        return ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(share.ownerName.map { "\($0) seninle bir ders paylaştı" } ?? "Seninle bir ders paylaşıldı")
                        .font(.subheadline).foregroundStyle(Theme.text2)
                    Text(s.course.name).font(Theme.display(.title)).foregroundStyle(Theme.text)
                }

                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 14) {
                        stat("doc.text", "\(s.notes.count) not")
                        stat("rectangle.stack", "\(s.cards.count) kart")
                        stat("checklist", "\(s.questionCount) soru")
                        if !s.exams.isEmpty { stat("calendar", "\(s.exams.count) sınav") }
                    }
                    Text("Ders senin hesabına kopyalanır; kartların sıfırdan başlar, kendi hızında çalışırsın. Arkadaşın senin ilerlemeni görmez.")
                        .font(.subheadline).foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                    if let addError { Message(text: addError, kind: .error) }
                    if let existing {
                        Button { open(existing) } label: { Text("Derse git") }
                            .buttonStyle(PrimaryButtonStyle())
                        Button { Task { await add(s) } } label: { addLabel("Bir kopya daha ekle") }
                            .buttonStyle(SecondaryButtonStyle())
                            .disabled(adding)
                        Text("Bu dersi daha önce ekledin.").font(.caption).foregroundStyle(Theme.text3)
                    } else {
                        Button { Task { await add(s) } } label: { addLabel("Derslerime ekle") }
                            .buttonStyle(PrimaryButtonStyle())
                            .disabled(adding)
                    }
                }
                .padding(16)
                .focusCard()

                if !s.notes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionTitle("İçindekiler")
                        ForEach(Array(s.notes.enumerated()), id: \.offset) { i, note in
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: "doc.text").foregroundStyle(Color(hexString: s.course.color) ?? Theme.text2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(note.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                                    Text("\(note.summary == nil || note.summary == .null ? "Özet yok" : "Özet hazır") · \(s.cardCount(note: i)) kart · \(note.questions.count) soru")
                                        .font(.caption).foregroundStyle(Theme.text2)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                        }
                    }
                }

                if !s.exams.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionTitle("Sınavlar")
                        ForEach(Array(s.exams.enumerated()), id: \.offset) { _, exam in
                            HStack(spacing: 10) {
                                Image(systemName: "calendar.badge.clock").foregroundStyle(Theme.text2)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(examName(exam)).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                                    if let day = Dates.day(exam.date) {
                                        Text(day.formatted(Date.FormatStyle(locale: Dates.turkish).day().month(.wide).weekday(.wide)))
                                            .font(.caption).foregroundStyle(Theme.text2)
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                        }
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
    }

    private func stat(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.text)
    }

    @ViewBuilder
    private func addLabel(_ title: String) -> some View {
        if adding {
            HStack(spacing: 8) { ProgressView(); Text("Ekleniyor…") }
        } else {
            Text(title)
        }
    }

    private func examName(_ exam: SharedSnapshot.Exam) -> String {
        if let title = exam.title, !title.isEmpty { return title }
        return ["vize": "Vize", "final": "Final", "butunleme": "Bütünleme", "quiz": "Quiz"][exam.kind] ?? "Sınav"
    }

    private func load() async {
        phase = .loading
        do {
            phase = try await SharedCourses.fetch(token).map { .ready($0) } ?? .missing
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func add(_ snapshot: SharedSnapshot) async {
        adding = true
        addError = nil
        defer { adding = false }
        do {
            let course = try await store.importSharedCourse(snapshot)
            SharedCourses.rememberImport(token, course: course.id)
            OnboardingHaptics.success()
            open(course)
        } catch {
            addError = error.localizedDescription
        }
    }

    private func open(_ course: Course) {
        dismiss()
        onOpen(course)
    }
}

/// The camera, reading the QR code of a shared course.
private struct QRScanner: UIViewControllerRepresentable {
    let found: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(found: found) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let found: (String) -> Void
        private var done = false
        init(found: @escaping (String) -> Void) { self.found = found }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !done else { return }
            for item in items {
                if case let .barcode(code) = item, let text = code.payloadStringValue, SharedCourses.token(from: text) != nil {
                    done = true
                    scanner.stopScanning()
                    found(text)
                    return
                }
            }
        }
    }
}
