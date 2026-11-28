import SwiftUI

/// Note → "Görsel & Şema": Interactive Concept Map (with "Kör mod"), offline Fosforlu Poster,
/// and Premium AI Concept Image generator (`task: "image"`, stored on device, newest 8).
struct NoteVisualsView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(PremiumStore.self) private var premium

    let note: NoteItem
    let summary: NoteSummary?

    @State private var visuals: [GeneratedVisual] = []
    @State private var topic: String = ""
    @State private var aspect: VisualAspectRatio = .widescreen
    @State private var generating = false
    @State private var error: String?
    @State private var toast: String?

    // Concept map state
    @State private var blindMode = false
    @State private var revealedNodes: Set<String> = []
    @State private var selectedNode: ConceptNode?
    @State private var fullscreenItem: GeneratedVisual?
    @State private var addedCardIDs: Set<String> = []

    private var userId: UUID? { auth.session?.user.id }
    private var diagram: ConceptDiagram { ConceptDiagram.build(note: note, summary: summary) }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let toast {
                        Message(text: toast, kind: .info)
                    }
                    if let error {
                        Message(text: error, kind: .error)
                    }

                    aiGeneratorCard
                        .staggeredAppear(0)

                    if !visuals.isEmpty {
                        gallerySection
                            .staggeredAppear(1)
                    }

                    conceptMapSection
                        .staggeredAppear(2)
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Görsel & Şema")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(item: $fullscreenItem) { item in
            VisualFullscreenSheet(
                item: item,
                image: VisualStorage.image(for: item, user: userId, note: note.id),
                onAddCard: { Task { await addCard(for: item) } },
                onDelete: {
                    visuals = VisualStorage.delete(item, user: userId, note: note.id)
                    fullscreenItem = nil
                }
            )
        }
        .onAppear {
            visuals = VisualStorage.load(user: userId, note: note.id)
            if topic.isEmpty {
                topic = summary?.keyTerms.first?.term ?? note.title
            }
        }
    }

    // MARK: - AI Image Generator + Offline Poster

    private var aiGeneratorCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "photo.on.rectangle.angled")
                    .font(.headline)
                    .foregroundStyle(Theme.prem1)
                Text("Yapay zekâ görseli & poster")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                if !premium.isPremium {
                    Text("PREMIUM")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Theme.prem1, in: Capsule())
                }
            }

            Text("Notundaki bir kavramı ders kitabı şeması olarak çizdir ya da çevrimdışı Fosforlu özet posteri oluştur.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)

            // Quick concept chips
            if let terms = summary?.keyTerms, !terms.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(terms.prefix(6), id: \.term) { item in
                            let picked = topic == item.term
                            Button {
                                OnboardingHaptics.selection()
                                topic = item.term
                            } label: {
                                Text(item.term)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(picked ? Theme.onHi : Theme.text2)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(picked ? Theme.hi : Theme.surface, in: Capsule())
                                    .overlay(Capsule().stroke(picked ? Theme.cardLine : Theme.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }

            // Topic text field
            TextField("Görselleştirilecek kavram veya başlık…", text: $topic)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.bg, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.border, lineWidth: 1))

            // Aspect ratio selector
            HStack(spacing: 8) {
                ForEach(VisualAspectRatio.allCases) { ratio in
                    let active = aspect == ratio
                    Button {
                        OnboardingHaptics.selection()
                        aspect = ratio
                    } label: {
                        Text(ratio.label)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(active ? Theme.onHi : Theme.text2)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(active ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Theme.cardLine : Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            // Action buttons
            VStack(spacing: 10) {
                if premium.isPremium {
                    Button {
                        Task { await generateAIImage() }
                    } label: {
                        HStack(spacing: 8) {
                            if generating {
                                ProgressView().tint(Theme.onHi)
                            } else {
                                Image(systemName: "sparkles")
                            }
                            Text(generating ? "Görsel çiziliyor…" : "Yapay zekâ ile görsel üret")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(generating || topic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } else {
                    NavigationLink {
                        PremiumView()
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "crown.fill")
                            Text("Yapay zekâ görseli için Premium’u aç")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }

                Button {
                    createOfflinePoster()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "rectangle.grid.1x2")
                        Text("Ücretsiz Fosforlu poster oluştur")
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
                .disabled(generating)
            }
        }
        .focusCard()
    }

    // MARK: - Saved Gallery

    private var gallerySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Bu notun görselleri (\(visuals.count)/\(VisualStorage.maxPerNote))")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                Text("Cihazda saklanır")
                    .font(.caption)
                    .foregroundStyle(Theme.text3)
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                ForEach(visuals) { item in
                    visualCard(item)
                }
            }
        }
    }

    private func visualCard(_ item: GeneratedVisual) -> some View {
        let img = VisualStorage.image(for: item, user: userId, note: note.id)
        return VStack(alignment: .leading, spacing: 8) {
            Button {
                fullscreenItem = item
            } label: {
                ZStack(alignment: .topTrailing) {
                    if let img {
                        Image(uiImage: img)
                            .resizable()
                            .scaledToFill()
                            .frame(height: 118)
                            .frame(maxWidth: .infinity)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Theme.surface)
                            .frame(height: 118)
                            .overlay(Image(systemName: "photo").foregroundStyle(Theme.text3))
                    }
                    Text(item.kind == .aiImage ? "AI" : "Poster")
                        .font(.caption2.weight(.heavy))
                        .foregroundStyle(item.kind == .aiImage ? .white : Theme.onHi)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(item.kind == .aiImage ? Theme.prem1 : Theme.hi, in: Capsule())
                        .padding(6)
                }
            }
            .buttonStyle(.plain)

            Text(item.title)
                .font(.caption.weight(.bold))
                .foregroundStyle(Theme.text)
                .lineLimit(2)

            HStack(spacing: 6) {
                Button {
                    Task { await addCard(for: item) }
                } label: {
                    Label(addedCardIDs.contains(item.id) ? "Eklendi" : "Kart", systemImage: addedCardIDs.contains(item.id) ? "checkmark" : "rectangle.stack.badge.plus")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(addedCardIDs.contains(item.id) ? Theme.success : Theme.text2)
                }
                .buttonStyle(.plain)
                .disabled(addedCardIDs.contains(item.id))

                Spacer()

                if let img {
                    ShareLink(item: Image(uiImage: img), preview: SharePreview(item.title, image: Image(uiImage: img))) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text2)
                    }
                }

                Button(role: .destructive) {
                    OnboardingHaptics.light()
                    visuals = VisualStorage.delete(item, user: userId, note: note.id)
                } label: {
                    Image(systemName: "trash")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.danger)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Interactive Concept Map

    private var conceptMapSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("Kavram haritası", systemImage: "point.3.connected.trianglepath.dotted")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
                Spacer()
                Button {
                    OnboardingHaptics.selection()
                    blindMode.toggle()
                    revealedNodes.removeAll()
                } label: {
                    Label(blindMode ? "Kör mod açık" : "Kör mod", systemImage: blindMode ? "eye.slash.fill" : "eye")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(blindMode ? Theme.onHi : Theme.text2)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(blindMode ? Theme.hi : Theme.surface, in: Capsule())
                        .overlay(Capsule().stroke(blindMode ? Theme.cardLine : Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            // Central topic node
            VStack(alignment: .leading, spacing: 6) {
                Text("ANA KONU")
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.hi, in: Capsule())
                Text(diagram.centralTopic)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Theme.text)
                Text(diagram.centralSummary)
                    .font(.caption)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardLine, lineWidth: 2))

            if diagram.nodes.isEmpty {
                Text("Bu notta henüz kavram çıkarılmamış.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    ForEach(diagram.nodes) { node in
                        let hidden = blindMode && !revealedNodes.contains(node.id)
                        let picked = selectedNode?.id == node.id
                        Button {
                            OnboardingHaptics.selection()
                            if blindMode { revealedNodes.insert(node.id) }
                            selectedNode = node
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(node.relation.uppercased())
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Theme.text3)
                                Text(node.label)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Theme.text)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                if hidden {
                                    Text("Tanımı görmek için dokun")
                                        .font(.caption2)
                                        .foregroundStyle(Theme.text3)
                                        .italic()
                                } else {
                                    Text(node.detail)
                                        .font(.caption)
                                        .foregroundStyle(Theme.text2)
                                        .lineLimit(3)
                                        .multilineTextAlignment(.leading)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(picked ? Theme.hi.opacity(0.22) : Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(picked ? Theme.cardLine : Theme.border, lineWidth: picked ? 1.5 : 1))
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let node = selectedNode {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(node.label)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text)
                            Spacer()
                            Button {
                                Task { await addCard(for: node) }
                            } label: {
                                Label(addedCardIDs.contains(node.id) ? "Karta eklendi" : "Karta çevir", systemImage: addedCardIDs.contains(node.id) ? "checkmark.circle.fill" : "rectangle.stack.badge.plus")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(addedCardIDs.contains(node.id) ? Theme.success : Theme.onHi)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(addedCardIDs.contains(node.id) ? Theme.surface : Theme.hi, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .disabled(addedCardIDs.contains(node.id))
                        }
                        Text(node.detail)
                            .font(.subheadline)
                            .foregroundStyle(Theme.text2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.cardLine, lineWidth: 1.5))
                }
            }
        }
        .focusCard()
    }

    // MARK: - Actions

    private func generateAIImage() async {
        let cleanTopic = topic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTopic.isEmpty else { return }
        OnboardingHaptics.medium()
        generating = true
        error = nil
        toast = nil
        UIApplication.shared.isIdleTimerDisabled = true
        defer {
            UIApplication.shared.isIdleTimerDisabled = false
            generating = false
        }
        do {
            let content = (try? await store.noteContent(note.id)) ?? summary?.overview ?? ""
            let result = try await VisualAI.generate(
                title: note.title,
                topic: cleanTopic,
                context: content,
                aspectRatio: aspect
            )
            visuals = VisualStorage.append(
                title: cleanTopic,
                prompt: cleanTopic,
                caption: result.caption,
                kind: .aiImage,
                jpegData: result.jpegData,
                user: userId,
                note: note.id
            )
            store.recordActivity()
            OnboardingHaptics.success()
            toast = "Görsel hazırlandı ve bu cihaza kaydedildi."
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Görsel üretilemedi. Tekrar dene."
        }
    }

    private func createOfflinePoster() {
        OnboardingHaptics.medium()
        error = nil
        let rows: [(key: String, meaning: String)] = diagram.nodes.prefix(5).map { ($0.label, $0.detail) }
        let fallbackRows = rows.isEmpty ? [(note.title, summary?.overview ?? "Notun temel özeti")] : rows
        guard let data = VisualRenderer.renderPoster(
            title: note.title,
            subtitle: "\(fallbackRows.count) Temel Kavram",
            items: fallbackRows
        ) else {
            error = "Poster oluşturulamadı."
            return
        }
        visuals = VisualStorage.append(
            title: "\(note.title) · Poster",
            prompt: "Fosforlu özet posteri",
            caption: diagram.centralSummary,
            kind: .poster,
            jpegData: data,
            user: userId,
            note: note.id
        )
        OnboardingHaptics.success()
        toast = "Fosforlu özet posteri oluşturuldu."
    }

    private func addCard(for item: GeneratedVisual) async {
        do {
            try await store.addToolCard(
                course: note.courseId,
                note: note.id,
                front: "\(item.title) şemasındaki temel kavram ve işlevi nedir?",
                back: item.caption,
                source: item.title
            )
            addedCardIDs.insert(item.id)
            OnboardingHaptics.success()
            toast = "Kart destene eklendi."
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol et."
        }
    }

    private func addCard(for node: ConceptNode) async {
        do {
            try await store.addToolCard(
                course: note.courseId,
                note: note.id,
                front: "“\(node.label)” kavramı neyi ifade eder?",
                back: node.detail,
                source: node.label
            )
            addedCardIDs.insert(node.id)
            OnboardingHaptics.success()
            toast = "Kavram karta çevrildi."
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol et."
        }
    }
}

// MARK: - Fullscreen Zoomable Sheet

private struct VisualFullscreenSheet: View {
    @Environment(\.dismiss) private var dismiss
    let item: GeneratedVisual
    let image: UIImage?
    let onAddCard: () -> Void
    let onDelete: () -> Void

    @State private var scale: CGFloat = 1.0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .scaleEffect(scale)
                        .gesture(
                            MagnifyGesture()
                                .onChanged { value in scale = max(1, min(4, value.magnification)) }
                                .onEnded { _ in withAnimation(.spring()) { if scale < 1.05 { scale = 1 } } }
                        )
                        .onTapGesture(count: 2) {
                            withAnimation(.spring()) { scale = scale > 1.2 ? 1.0 : 2.2 }
                        }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(item.title)
                        .font(.headline)
                        .foregroundStyle(.white)
                    if !item.caption.isEmpty {
                        Text(item.caption)
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.82))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    HStack(spacing: 12) {
                        Button("Karta çevir", action: onAddCard)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Theme.onHi)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Theme.hi, in: Capsule())

                        if let image {
                            ShareLink(item: Image(uiImage: image), preview: SharePreview(item.title, image: Image(uiImage: image))) {
                                Label("Paylaş / Kaydet", systemImage: "square.and.arrow.up")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(.white.opacity(0.18), in: Capsule())
                            }
                        }

                        Spacer()

                        Button(role: .destructive, action: onDelete) {
                            Image(systemName: "trash")
                                .foregroundStyle(.red)
                                .padding(9)
                                .background(.white.opacity(0.15), in: Circle())
                        }
                    }
                }
                .padding(16)
                .background(.ultraThinMaterial)
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                        .foregroundStyle(.white)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}
