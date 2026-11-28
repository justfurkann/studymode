import SwiftUI

/// Note → "Kodla": Smart memory coding studio with interactive reveal tiles,
/// 1-tap style switching ("Başka tarz dene"), flashcard export, and Premium AI scene drawing.
struct NoteCodingView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(PremiumStore.self) private var premium

    let note: NoteItem
    let summary: NoteSummary?

    @State private var items: [CodingItem] = []
    @State private var selectedKind: CodingKind = .akrostis
    @State private var focusTopic: String = ""
    @State private var generating = false
    @State private var busySceneID: String?
    @State private var error: String?
    @State private var toast: String?
    @State private var quizModeIDs: Set<String> = []
    @State private var revealedTileKeys: Set<String> = []
    @State private var addedCardIDs: Set<String> = []
    @State private var zoomImage: (title: String, image: UIImage)?

    private var userId: UUID? { auth.session?.user.id }

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let toast {
                        Message(text: toast, kind: .info)
                    }
                    if let error {
                        Message(text: error, kind: .error)
                    }

                    generatorCard
                        .staggeredAppear(0)

                    if items.isEmpty {
                        emptyHintCard
                            .staggeredAppear(1)
                    } else {
                        ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                            codingCard(item)
                                .staggeredAppear(idx + 1)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 40)
            }
        }
        .navigationTitle("Kodla")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(isPresented: Binding(get: { zoomImage != nil }, set: { if !$0 { zoomImage = nil } })) {
            if let z = zoomImage {
                SceneZoomSheet(title: z.title, image: z.image)
            }
        }
        .onAppear {
            items = CodingStorage.load(user: userId, note: note.id)
        }
    }

    // MARK: - Generator Card

    private var generatorCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "key.fill")
                    .font(.headline)
                    .foregroundStyle(Theme.onHi)
                    .frame(width: 30, height: 30)
                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.cardLine, lineWidth: 1))
                Text("Akılda kalıcı şifre çıkar")
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.text)
            }

            Text("Ezberlemekte zorlandığın bir kavramı veya listeyi seç; harf şifresi, komik sahne ya da tekerlemeye çevirip tek dokunuşla karta ekle.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)

            // Quick concept chips
            if let terms = summary?.keyTerms, !terms.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        let allPicked = focusTopic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        Button {
                            OnboardingHaptics.selection()
                            focusTopic = ""
                        } label: {
                            Text("Tüm not")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(allPicked ? Theme.onHi : Theme.text2)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(allPicked ? Theme.hi : Theme.surface, in: Capsule())
                                .overlay(Capsule().stroke(allPicked ? Theme.cardLine : Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)

                        ForEach(terms.prefix(6), id: \.term) { t in
                            let picked = focusTopic == t.term
                            Button {
                                OnboardingHaptics.selection()
                                focusTopic = t.term
                            } label: {
                                Text(t.term)
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

            TextField("İsteğe bağlı: özel bir kavram veya liste yaz…", text: $focusTopic)
                .font(.subheadline)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.bg, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.border, lineWidth: 1))

            // 4 style chips
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(CodingKind.allCases) { kind in
                    let active = selectedKind == kind
                    Button {
                        OnboardingHaptics.selection()
                        selectedKind = kind
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: kind.icon)
                                .font(.caption.weight(.bold))
                            Text(kind.label)
                                .font(.caption.weight(.bold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(active ? Theme.onHi : Theme.text2)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 9)
                        .background(active ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Theme.cardLine : Theme.border, lineWidth: active ? 1.4 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                Task { await generateCoding(kind: selectedKind, focus: focusTopic) }
            } label: {
                HStack(spacing: 8) {
                    if generating {
                        ProgressView().tint(Theme.onHi)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(generating ? "Şifre hazırlanıyor…" : "Şifre oluştur")
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(generating)
        }
        .focusCard()
    }

    private var emptyHintCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("İpucu: Nasıl en iyi çalışır?")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text)
            Text("Sıralı listeler için “Harf şifresi”, zor/yabancı terimler için “Komik sahne” seç. Beğendiğin şifreyi tek dokunuşla karta çevirebilir ya da Premium’da sahnesini çizdirebilirsin.")
                .font(.caption)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Coding Card

    private func codingCard(_ item: CodingItem) -> some View {
        let isQuiz = quizModeIDs.contains(item.id)
        let sceneImage = CodingStorage.image(for: item, user: userId, note: note.id)

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Label(item.kind.label, systemImage: item.kind.icon)
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(Theme.onHi)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Theme.hi, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))

                Text(item.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                Spacer()

                Button(role: .destructive) {
                    OnboardingHaptics.light()
                    items = CodingStorage.delete(item, user: userId, note: note.id)
                } label: {
                    Image(systemName: "trash")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text3)
                }
                .buttonStyle(.plain)
            }

            // Highlighted code banner
            Text(item.code)
                .font(Theme.display(.title3, weight: .heavy))
                .foregroundStyle(Theme.text)
                .fixedSize(horizontal: false, vertical: true)
                .padding(13)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.hiSoft.opacity(0.65), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).stroke(Theme.cardLine.opacity(0.6), lineWidth: 1.5))

            // Interactive breakdown tiles
            if !item.breakdown.isEmpty {
                HStack {
                    Text("Açılımı")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.text2)
                    Spacer()
                    Button {
                        OnboardingHaptics.selection()
                        if isQuiz {
                            quizModeIDs.remove(item.id)
                        } else {
                            quizModeIDs.insert(item.id)
                            for b in item.breakdown {
                                revealedTileKeys.remove("\(item.id):\(b.id)")
                            }
                        }
                    } label: {
                        Label(isQuiz ? "Hepsini göster" : "Kendini dene", systemImage: isQuiz ? "eye" : "eye.slash")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Theme.text2)
                    }
                    .buttonStyle(.plain)
                }

                VStack(spacing: 7) {
                    ForEach(item.breakdown) { part in
                        let tileKey = "\(item.id):\(part.id)"
                        let hidden = isQuiz && !revealedTileKeys.contains(tileKey)

                        Button {
                            guard isQuiz else { return }
                            OnboardingHaptics.selection()
                            if revealedTileKeys.contains(tileKey) {
                                revealedTileKeys.remove(tileKey)
                            } else {
                                revealedTileKeys.insert(tileKey)
                            }
                        } label: {
                            HStack(alignment: .center, spacing: 10) {
                                Text(part.key)
                                    .font(.subheadline.weight(.heavy))
                                    .foregroundStyle(Theme.onHi)
                                    .frame(minWidth: 36)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .background(Theme.hi, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.cardLine, lineWidth: 1.2))

                                Text(hidden ? "Hatırlamak için dokun…" : part.meaning)
                                    .font(.subheadline)
                                    .foregroundStyle(hidden ? Theme.text3 : Theme.text)
                                    .italic(hidden)
                                    .multilineTextAlignment(.leading)
                                    .fixedSize(horizontal: false, vertical: true)

                                Spacer(minLength: 0)
                            }
                            .padding(8)
                            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11).stroke(Theme.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if !item.tip.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.prem1)
                    Text(item.tip)
                        .font(.caption)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            // Optional Premium AI scene image
            if let sceneImage {
                Button {
                    zoomImage = (item.title, sceneImage)
                } label: {
                    Image(uiImage: sceneImage)
                        .resizable()
                        .scaledToFill()
                        .frame(maxWidth: .infinity)
                        .frame(height: 170)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }

            // Action strip
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    // Add card
                    Button {
                        Task { await addCard(for: item) }
                    } label: {
                        Label(
                            addedCardIDs.contains(item.id) ? "Karta eklendi" : "Karta çevir",
                            systemImage: addedCardIDs.contains(item.id) ? "checkmark" : "rectangle.stack.badge.plus"
                        )
                        .font(.caption.weight(.bold))
                        .foregroundStyle(addedCardIDs.contains(item.id) ? Theme.success : Theme.onHi)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(addedCardIDs.contains(item.id) ? Theme.bg : Theme.hi, in: Capsule())
                        .overlay(Capsule().stroke(Theme.cardLine.opacity(0.6), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(addedCardIDs.contains(item.id))

                    // Try another style
                    Button {
                        Task { await generateCoding(kind: item.kind.nextStyle, focus: item.title) }
                    } label: {
                        Label("Başka tarz", systemImage: "arrow.triangle.2.circlepath")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 7)
                            .background(Theme.bg, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(generating)

                    // Premium AI scene draw
                    if premium.isPremium {
                        Button {
                            Task { await drawScene(for: item) }
                        } label: {
                            HStack(spacing: 5) {
                                if busySceneID == item.id {
                                    ProgressView().controlSize(.mini)
                                } else {
                                    Image(systemName: "paintbrush.fill")
                                }
                                Text(sceneImage == nil ? "Sahneyi çizdir" : "Yeniden çiz")
                            }
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 7)
                            .background(Theme.prem1, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(busySceneID != nil)
                    } else {
                        NavigationLink {
                            PremiumView()
                        } label: {
                            Label("Sahneyi çizdir · Premium", systemImage: "crown.fill")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
                                .background(Theme.prem1, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    // MARK: - Actions

    private func generateCoding(kind: CodingKind, focus: String) async {
        OnboardingHaptics.medium()
        generating = true
        error = nil
        toast = nil
        defer { generating = false }
        do {
            let content = (try? await store.noteContent(note.id)) ?? summary?.overview ?? note.title
            let created = try await CodingAI.generate(
                title: note.title,
                text: content,
                kind: kind,
                focusTopic: focus
            )
            items = CodingStorage.save(created + items, user: userId, note: note.id)
            store.recordActivity()
            OnboardingHaptics.success()
            toast = "\(kind.label) hazırlandı."
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Şifre hazırlanamadı. Tekrar dene."
        }
    }

    private func drawScene(for item: CodingItem) async {
        OnboardingHaptics.medium()
        busySceneID = item.id
        error = nil
        toast = nil
        defer { busySceneID = nil }
        do {
            let breakdownSummary = item.breakdown.map { "\($0.key): \($0.meaning)" }.joined(separator: "; ")
            let promptTopic = "\(item.title) — Hafıza şifresi: \(item.code)"
            let result = try await VisualAI.generate(
                title: note.title,
                topic: promptTopic,
                context: "\(item.code)\n\(breakdownSummary)\n\(item.tip)",
                aspectRatio: .widescreen
            )
            items = CodingStorage.attachImage(result.jpegData, to: item.id, user: userId, note: note.id)
            store.recordActivity()
            OnboardingHaptics.success()
            toast = "Hafıza sahnesi çizildi ve şifrene eklendi."
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Sahne çizilemedi. Tekrar dene."
        }
    }

    private func addCard(for item: CodingItem) async {
        let backParts = item.breakdown.map { "\($0.key) → \($0.meaning)" }.joined(separator: "\n")
        let back = backParts.isEmpty ? "\(item.code)\(item.tip.isEmpty ? "" : "\n\(item.tip)")" : "\(item.code)\n\(backParts)"
        do {
            try await store.addToolCard(
                course: note.courseId,
                note: note.id,
                front: "“\(item.title)” için hafıza şifresi ve açılımı nedir?",
                back: back,
                source: item.code
            )
            addedCardIDs.insert(item.id)
            OnboardingHaptics.success()
            toast = "Şifre kart destene eklendi."
        } catch {
            self.error = "Kart eklenemedi. Bağlantını kontrol et."
        }
    }
}

// MARK: - Quick Contextual Card Coding Sheet (for ReviewSession)

struct CardCodingSheet: View {
    @Environment(\.dismiss) private var dismiss
    let card: Card
    let onSavedHint: (String) -> Void

    @State private var kind: CodingKind = .hikaye
    @State private var item: CodingItem?
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("KART")
                                .font(.caption2.weight(.heavy))
                                .foregroundStyle(Theme.text3)
                            Text(card.front)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(Theme.text)
                            Text(card.back)
                                .font(.caption)
                                .foregroundStyle(Theme.text2)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))

                        HStack(spacing: 8) {
                            ForEach([CodingKind.hikaye, .akrostis, .ipucu], id: \.self) { k in
                                let active = kind == k
                                Button {
                                    OnboardingHaptics.selection()
                                    kind = k
                                    Task { await generate() }
                                } label: {
                                    Text(k.label)
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(active ? Theme.onHi : Theme.text2)
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(active ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Theme.cardLine : Theme.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                                .disabled(loading)
                            }
                        }

                        if loading {
                            HStack(spacing: 10) {
                                ProgressView()
                                Text("Akılda kalıcı şifre hazırlanıyor…")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text2)
                            }
                            .padding(16)
                        } else if let error {
                            Message(text: error, kind: .error)
                        } else if let item {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(item.code)
                                    .font(Theme.display(.title3, weight: .heavy))
                                    .foregroundStyle(Theme.text)
                                    .padding(12)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Theme.hiSoft.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))

                                ForEach(item.breakdown) { part in
                                    HStack(spacing: 8) {
                                        Text(part.key)
                                            .font(.caption.weight(.heavy))
                                            .foregroundStyle(Theme.onHi)
                                            .padding(.horizontal, 7)
                                            .padding(.vertical, 4)
                                            .background(Theme.hi, in: RoundedRectangle(cornerRadius: 6))
                                        Text(part.meaning)
                                            .font(.caption)
                                            .foregroundStyle(Theme.text)
                                    }
                                }

                                if !item.tip.isEmpty {
                                    Text(item.tip)
                                        .font(.caption)
                                        .foregroundStyle(Theme.text2)
                                }

                                Button {
                                    let hintText = item.tip.isEmpty ? "Şifre: \(item.code)" : "Şifre: \(item.code) · \(item.tip)"
                                    CardHintStore.save(hintText, for: card.id)
                                    OnboardingHaptics.success()
                                    onSavedHint(hintText)
                                    dismiss()
                                } label: {
                                    Label("Bu kartın ipucu olarak kaydet", systemImage: "checkmark.circle.fill")
                                }
                                .buttonStyle(PrimaryButtonStyle())
                            }
                            .focusCard()
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Kartı şifrele")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }
                }
            }
            .task { await generate() }
        }
    }

    private func generate() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let text = "Soru: \(card.front)\nCevap: \(card.back)"
            let created = try await CodingAI.generate(title: String(card.front.prefix(80)), text: text, kind: kind)
            item = created.first
        } catch {
            self.error = (error as? LocalizedError)?.errorDescription ?? "Şifre üretilemedi."
        }
    }
}

private struct SceneZoomSheet: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let image: UIImage

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ShareLink(item: Image(uiImage: image), preview: SharePreview(title, image: Image(uiImage: image))) {
                        Image(systemName: "square.and.arrow.up").foregroundStyle(.white)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Kapat") { dismiss() }.foregroundStyle(.white)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}
