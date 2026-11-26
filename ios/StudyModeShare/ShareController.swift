import SwiftUI
import UniformTypeIdentifiers

final class ShareController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let context = extensionContext else { return }
        let host = UIHostingController(rootView: SharePDF(context: context))
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }
}

private struct SharePDF: View {
    let context: NSExtensionContext
    @State private var catalog = PDFInbox.catalog()
    @State private var course: UUID?
    @State private var saving = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                if let catalog {
                    Picker("Ders", selection: $course) {
                        Text("Uygulamada seç").tag(nil as UUID?)
                        ForEach(catalog.courses) { Text($0.name).tag(Optional($0.id)) }
                    }
                    Text("PDF, StudyMode’u açtığında çalışma masanda hazır olacak.")
                    Button("StudyMode’a ekle") { save(catalog) }.disabled(saving)
                } else {
                    Text("Önce StudyMode’u açıp hesabına giriş yap, ardından PDF’yi yeniden paylaş.")
                }
                if saving { ProgressView() }
                if let message { Text(message) }
            }
            .navigationTitle("PDF paylaş")
            .toolbar { Button("Vazgeç") { context.cancelRequest(withError: CocoaError(.userCancelled)) }.disabled(saving) }
        }
    }

    private func save(_ catalog: PDFInbox.Catalog) {
        let pdf = UTType.pdf.identifier
        let providers = (context.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        guard let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(pdf) }) else {
            message = "Bir PDF dosyası seç."; return
        }
        saving = true
        let selected = course
        provider.loadFileRepresentation(forTypeIdentifier: pdf) { url, _ in
            do {
                guard let url else { throw CocoaError(.fileReadUnknown) }
                let title = (provider.suggestedName ?? url.lastPathComponent) as NSString
                try PDFInbox.enqueue(url, title: title.deletingPathExtension, user: catalog.user, course: selected)
                DispatchQueue.main.async { context.completeRequest(returningItems: nil) }
            } catch {
                DispatchQueue.main.async { saving = false; message = "PDF kaydedilemedi. StudyMode’u açıp tekrar dene." }
            }
        }
    }
}
