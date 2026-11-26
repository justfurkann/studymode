import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// "Not ekle": text, photos or a PDF → the note's text (checkable) → "Notu hazırla", which saves the
/// note first and then prepares summary, cards and questions part by part, like the site.
struct AddNoteView: View {
    @Environment(StudyStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    /// Called with the new note's id when it is ready (or saved unprepared).
    let onDone: (Course, UUID) -> Void

    enum Source: Hashable { case text, photo, pdf }
    enum Phase: Equatable { case editing, reading(NoteImport.Progress), saving, preparing(done: Int, total: Int), failed(String) }

    @State private var courseId: UUID?
    @State private var title = ""
    @State private var source: Source = .text
    @State private var text = ""
    @State private var phase: Phase = .editing
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var photos: [UIImage] = []
    @State private var showCamera = false
    @State private var showPDF = false
    @State private var newCourse = false
    @State private var newCourseName = ""
    @State private var savedNoteId: UUID?
    @State private var info: String?
    @State private var work: Task<Void, Never>?

    init(course: Course? = nil, onDone: @escaping (Course, UUID) -> Void) {
        _courseId = State(initialValue: course?.id)
        self.onDone = onDone
    }

    private var course: Course? { store.courses.first { $0.id == courseId } }
    private var busy: Bool {
        switch phase {
        case .reading, .saving, .preparing: true
        default: false
        }
    }
    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var parts: Int { max(1, StudySetMaker.split(trimmed).count) }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        courseField
                        TextField("Not başlığı (ör. Hafta 3 · Hücre zarı)", text: $title)
                            .field()
                            .disabled(busy)
                        Picker("Kaynak", selection: $source) {
                            Text("Metin").tag(Source.text)
                            Text("Fotoğraf").tag(Source.photo)
                            Text("PDF").tag(Source.pdf)
                        }
                        .pickerStyle(.segmented)
                        .disabled(busy)

                        switch source {
                        case .text: textEditor(placeholder: "Ders notunu buraya yapıştır ya da yaz.")
                        case .photo: photoSection
                        case .pdf: pdfSection
                        }

                        if let info { Message(text: info, kind: .info) }
                        status
                    }
                    .padding(16)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .navigationTitle("Not ekle")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Vazgeç") { work?.cancel(); dismiss() }
                        .disabled(phase == .saving)
                }
            }
            .safeAreaInset(edge: .bottom) { bottomButton }
            .interactiveDismissDisabled(busy)
            .alert("Yeni ders", isPresented: $newCourse) {
                TextField("Ders adı", text: $newCourseName)
                Button("Vazgeç", role: .cancel) { newCourseName = "" }
                Button("Ekle") { addCourse() }
            }
            .sheet(isPresented: $showCamera) {
                CameraPicker { image in photos.append(image) }.ignoresSafeArea()
            }
            .fileImporter(isPresented: $showPDF, allowedContentTypes: [.pdf]) { result in
                if case let .success(url) = result { readPDF(url) }
            }
            .onChange(of: photoItems) { _, items in loadPhotos(items) }
        }
        .onAppear { if courseId == nil { courseId = store.sortedCourses.first?.id } }
        .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    // MARK: Fields

    private var courseField: some View {
        Menu {
            ForEach(store.sortedCourses) { c in
                Button { courseId = c.id } label: { Text(c.name) }
            }
            Divider()
            Button { newCourse = true } label: { Label("Yeni ders…", systemImage: "plus") }
        } label: {
            HStack {
                if let course { Circle().fill(course.tint).frame(width: 10, height: 10) }
                Text(course?.name ?? "Ders seç")
                    .foregroundStyle(course == nil ? Theme.text3 : Theme.text)
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.footnote).foregroundStyle(Theme.text3)
            }
            .field()
        }
        .disabled(busy)
    }

    private func textEditor(placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(placeholder)
                        .foregroundStyle(Theme.text3)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 16)
                }
                TextEditor(text: $text)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .frame(minHeight: 220)
                    .disabled(busy)
            }
            .background(Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
            if !trimmed.isEmpty {
                Text(trimmed.count > NoteLimits.maxContent
                     ? "Not çok uzun (\(trimmed.count.formatted()) karakter). En fazla \(NoteLimits.maxContent.formatted()) karakter; ikiye bölüp ayrı not olarak ekle."
                     : "\(trimmed.count.formatted()) karakter · \(parts == 1 ? "tek seferde" : "yaklaşık \(parts) bölümde") hazırlanır")
                    .font(.footnote)
                    .foregroundStyle(trimmed.count > NoteLimits.maxContent ? Theme.danger : Theme.text3)
            }
        }
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ders notunun, kitabın ya da tahtanın fotoğrafını çek. Sayfalar yapay zekâyla okunur; okunan metni hazırlamadan önce kontrol edebilirsin.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button { showCamera = true } label: { Label("Fotoğraf çek", systemImage: "camera") }
                        .buttonStyle(SecondaryButtonStyle())
                }
                PhotosPicker(selection: $photoItems, maxSelectionCount: 30, matching: .images) {
                    Label("Galeriden seç", systemImage: "photo.on.rectangle")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                }
            }
            .disabled(busy)
            if !photos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(photos.enumerated()), id: \.offset) { i, image in
                            Image(uiImage: image).resizable().scaledToFill()
                                .frame(width: 72, height: 96).clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(alignment: .topTrailing) {
                                    if !busy {
                                        Button { photos.remove(at: i) } label: {
                                            Image(systemName: "xmark.circle.fill").foregroundStyle(.white, .black.opacity(0.6))
                                        }
                                        .padding(3)
                                        .accessibilityLabel("Fotoğrafı çıkar")
                                    }
                                }
                        }
                    }
                }
                if text.isEmpty {
                    Button { readPhotos() } label: { Label("\(photos.count) sayfayı oku", systemImage: "text.viewfinder") }
                        .buttonStyle(SecondaryButtonStyle())
                        .disabled(busy)
                }
            }
            if !text.isEmpty { textEditor(placeholder: "") }
        }
    }

    private var pdfSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PDF'in yazısı telefonda okunur. Taranmış (resim) sayfalar yapay zekâyla okunur.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            Button { showPDF = true } label: { Label(text.isEmpty ? "PDF seç" : "Başka PDF seç", systemImage: "doc.richtext") }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(busy)
            if !text.isEmpty { textEditor(placeholder: "") }
        }
    }

    @ViewBuilder
    private var status: some View {
        switch phase {
        case let .reading(p):
            ProgressRow(text: "Sayfalar okunuyor · \(p.done)/\(p.total)", value: Double(p.done), total: Double(max(p.total, 1)))
        case .saving:
            ProgressRow(text: "Not kaydediliyor…", value: nil, total: 1)
        case let .preparing(done, total):
            ProgressRow(text: total > 1 ? "Hazırlanıyor · bölüm \(done)/\(total)" : "Özet, kartlar ve sorular hazırlanıyor…", value: total > 1 ? Double(done) : nil, total: Double(max(total, 1)))
            Text("Bu birkaç dakika sürebilir. Uygulamayı kapatma; ekran açık kalacak.")
                .font(.footnote)
                .foregroundStyle(Theme.text3)
        case let .failed(message):
            Message(text: message, kind: .error)
        case .editing:
            EmptyView()
        }
    }

    @ViewBuilder
    private var bottomButton: some View {
        VStack(spacing: 8) {
            if case .failed = phase, savedNoteId != nil {
                Button("Tekrar dene") { prepare() }
                    .buttonStyle(PrimaryButtonStyle())
                Button("Sonra hazırla") { finish(noteId: savedNoteId!) }
                    .buttonStyle(SecondaryButtonStyle())
            } else {
                Button { prepare() } label: {
                    HStack(spacing: 6) { Text("Notu hazırla"); Image(systemName: "sparkles") }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(busy || course == nil || trimmed.count < 30 || trimmed.count > NoteLimits.maxContent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
        .background(Theme.bg.opacity(0.96))
    }

    // MARK: Actions

    private func addCourse() {
        let name = newCourseName.trimmingCharacters(in: .whitespaces)
        newCourseName = ""
        guard !name.isEmpty else { return }
        Task {
            do { courseId = try await store.createCourse(name: name).id }
            catch { phase = .failed("Ders eklenemedi. Bağlantını kontrol edip tekrar dene.") }
        }
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) {
        guard !items.isEmpty else { return }
        Task {
            for item in items {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    photos.append(image)
                }
            }
            photoItems = []
        }
    }

    private func readPhotos() {
        let pages = photos
        phase = .reading(.init(done: 0, total: pages.count))
        UIApplication.shared.isIdleTimerDisabled = true
        work = Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false }
            do {
                text = try await NoteImport.transcribe(pages) { phase = .reading($0) }
                if title.isEmpty { title = "Fotoğraf notu · \(Dates.short(.now))" }
                phase = .editing
                info = "Sayfalar okundu. Metni kontrol et, sonra \"Notu hazırla\"ya bas."
            } catch is CancellationError {
                phase = .editing
            } catch {
                phase = .failed(error.localizedDescription)
            }
        }
    }

    private func readPDF(_ url: URL) {
        phase = .reading(.init(done: 0, total: 0))
        info = nil
        UIApplication.shared.isIdleTimerDisabled = true
        work = Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false }
            do {
                let result = try await NoteImport.readPDF(url) { phase = .reading($0) }
                text = result.text
                if title.isEmpty { title = url.deletingPathExtension().lastPathComponent }
                phase = .editing
                info = result.scannedPages > 0
                    ? "\(result.pageCount) sayfa okundu (\(result.scannedPages) taranmış sayfa yapay zekâyla). Metni kontrol et, sonra \"Notu hazırla\"ya bas."
                    : "\(result.pageCount) sayfa okundu. Metni kontrol et, sonra \"Notu hazırla\"ya bas."
            } catch is CancellationError {
                phase = .editing
            } catch {
                phase = .failed(error.localizedDescription)
            }
        }
    }

    private func prepare() {
        guard let course else { return }
        let content = trimmed
        let noteTitle = title.trimmingCharacters(in: .whitespaces).isEmpty ? "Not · \(Dates.short(.now))" : title
        info = nil
        UIApplication.shared.isIdleTimerDisabled = true
        work = Task {
            defer { UIApplication.shared.isIdleTimerDisabled = false }
            do {
                let noteId: UUID
                if let savedNoteId {
                    noteId = savedNoteId
                } else {
                    phase = .saving
                    noteId = try await store.createNote(course: course, title: noteTitle, content: content)
                    savedNoteId = noteId
                }
                phase = .preparing(done: 0, total: parts)
                let set = try await StudySetMaker.make(title: noteTitle, text: content) { done, total in
                    phase = .preparing(done: done, total: total)
                }
                try await store.applyStudySet(set, noteId: noteId, courseId: course.id)
                if set.failedParts > 0 {
                    store.saveError = "Notun \(set.totalParts) bölümünden \(set.failedParts) tanesi hazırlanamadı; kalanlar hazır."
                }
                finish(noteId: noteId)
            } catch is CancellationError {
                phase = .editing
            } catch {
                phase = .failed(savedNoteId == nil
                    ? "Not kaydedilemedi: \(error.localizedDescription)"
                    : "Not kaydedildi ama hazırlanamadı. \(error.localizedDescription)")
            }
        }
    }

    private func finish(noteId: UUID) {
        Task {
            await store.load()
            if let course { onDone(course, noteId) }
            dismiss()
        }
    }
}

private struct ProgressRow: View {
    let text: String
    let value: Double?
    let total: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text)
            if let value {
                ProgressView(value: value, total: total).tint(Theme.accent)
            } else {
                ProgressView().tint(Theme.text2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.hiSoft, in: RoundedRectangle(cornerRadius: 14))
    }
}

/// The camera, for "Fotoğraf çek".
struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage { parent.onImage(image) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}
