import SwiftUI
import UserNotifications

/// "Kısa bir mola" (the site's Mola page): games from your own cards and a focus timer.
struct MolaView: View {
    @Environment(StudyStore.self) private var store
    @Environment(PremiumStore.self) private var premium
    @AppStorage("studymode.molaScope") private var scopeRaw = ""
    @State private var game: Game?
    @State private var records = MolaRecords.read()
    @State private var wordSave = WordGame.loadSave()
    @State private var drawerStars = DrawerLogic.loadStars()

    enum Game: String, Identifiable { case match, quick, focus, dailyWord, drawer, paperToss; var id: String { rawValue } }

    private var courseChoices: [(course: Course, count: Int)] {
        store.sortedCourses.map { ($0, Mola.cards(store.cards, course: $0.id).count) }.filter { $0.1 > 0 }
    }
    /// A remembered course that has no cards any more falls back to all courses.
    private var courseId: UUID? {
        guard let id = UUID(uuidString: scopeRaw), courseChoices.contains(where: { $0.course.id == id }) else { return nil }
        return id
    }
    private var cards: [Card] { Mola.cards(store.cards, course: courseId) }

    var body: some View {
        let key = MolaRecords.scope(courseId)
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("Kısa bir").font(Theme.display(.title)).foregroundStyle(Theme.text)
                        Highlighted(text: "mola", font: Theme.display(.title))
                    }
                    Text("Kendi kartlarınla iki dakikalık oyunlar ve bir odak sayacı. Oyunlar tekrar planını değiştirmez, ama serini korur.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                }

                if courseChoices.count > 1 {
                    Menu {
                        Button("Tüm dersler (\(Mola.cards(store.cards, course: nil).count) kart)") { scopeRaw = "" }
                        ForEach(courseChoices, id: \.course.id) { c in
                            Button("\(c.course.name) (\(c.count) kart)") { scopeRaw = c.course.id.uuidString }
                        }
                    } label: {
                        HStack {
                            Text("Hangi dersin kartları?").foregroundStyle(Theme.text2)
                            Spacer()
                            Text(courseChoices.first { $0.course.id == courseId }?.course.name ?? "Tüm dersler").fontWeight(.semibold).foregroundStyle(Theme.text)
                            Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(Theme.text3)
                        }
                        .font(.subheadline)
                        .padding(12)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                    }
                }

                tile(icon: "square.grid.2x2", title: "Eşleştir",
                     text: "Solda kavramlar, sağda cevaplar. Süreye karşı eşleştir; yanlış eşleşme +2 saniye.",
                     meta: records.match[key].map { "Rekor: \(Mola.formatSeconds($0))" } ?? "Henüz rekor yok",
                     locked: cards.count < Mola.matchMinPairs ? "En az \(Mola.matchMinPairs) kart gerekiyor" : nil) { game = .match }
                tile(icon: "bolt.fill", title: "Hızlı tur",
                     text: "Kartı sağa ya da sola kaydır: doğru mu, yanlış mı? \(Int(Mola.quickSeconds)) saniye, \(Mola.quickLives) hak.",
                     meta: records.quick[key].map { "Rekor: \($0) puan" } ?? "Henüz rekor yok",
                     locked: cards.count < Mola.quickMinCards ? "En az \(Mola.quickMinCards) kart gerekiyor" : nil) { game = .quick }
                tile(icon: "timer", title: "Odak sayacı",
                     text: "Pomodoro: 15+5, 25+10 veya 50+15 dk. Bitince bildirimle haber verir.",
                     meta: "Son 7 gün: \(records.focusLastWeek) dk", locked: nil) { game = .focus }
                Link(destination: Config.sitePage("ogrenci-tipi")) {
                    tileLabel(icon: "sparkles", title: "Hangi öğrenci tipisin?",
                              text: "10 soruluk test: karakterin, güçlü yanların ve sana özel çalışma taktiği.",
                              meta: "2 dakika · sitede açılır", locked: nil)
                }
                .buttonStyle(TactileCardButtonStyle())

                // MARK: Premium Mini-Games
                HStack(spacing: 8) {
                    SectionTitle("Premium mini oyunlar")
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
                .padding(.top, 6)

                premiumGameRow(
                    icon: "character.textbox",
                    title: "Günün Kavramı",
                    text: "Her gün Türkiye genelinde aynı akademik kavramı 6 denemede bul.",
                    meta: wordSave.streak > 0 ? "Seri: \(wordSave.streak) gün · \(wordSave.wins) galibiyet" : "Günlük kelime bulmacası",
                    target: .dailyWord
                )
                premiumGameRow(
                    icon: "square.stack.3d.up.fill",
                    title: "Çekmece",
                    text: "Aynı kırtasiye eşyalarını birleştir: kurşun kalemden profesörlüğe 10 bölüm.",
                    meta: "Toplam yıldız: \(drawerStars.reduce(0, +)) / \(DrawerLogic.chapters.count * 3)",
                    target: .drawer
                )

                if cards.count < Mola.quickMinCards {
                    Text(store.cards.isEmpty
                         ? "Oyunlar senin kartlarınla oynanır. Bir not ekle; kartlar ondan oluşsun."
                         : "Oyunlar için birbirinden farklı birkaç kart gerekiyor. Notlarından biraz daha kart oluştur.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                }
                if let name = courseChoices.first(where: { $0.course.id == courseId })?.course.name {
                    Text("Oyunlar yalnızca \(name) kartlarından gelir. Rekorlar ders başına ayrı tutulur.")
                        .font(.caption).foregroundStyle(Theme.text3)
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(GridPaper())
        .navigationTitle("Mola")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $game, onDismiss: {
            records = MolaRecords.read()
            wordSave = WordGame.loadSave()
            drawerStars = DrawerLogic.loadStars()
        }) { g in
            switch g {
            case .match: MatchGameView(cards: cards, courseId: courseId).environment(store)
            case .quick: QuickGameView(cards: cards, courseId: courseId).environment(store)
            case .focus: FocusTimerView().environment(store)
            case .dailyWord: DailyWordGameView()
            case .drawer: DrawerGameView()
            case .paperToss: PaperTossGameView()
            }
        }
    }

    @ViewBuilder
    private func premiumGameRow(icon: String, title: String, text: String, meta: String, target: Game) -> some View {
        if premium.isPremium {
            tile(icon: icon, title: title, text: text, meta: meta, locked: nil) {
                game = target
            }
        } else {
            NavigationLink {
                PremiumView()
            } label: {
                tileLabel(icon: icon, title: title, text: text, meta: "Premium ile açılır", locked: nil)
            }
            .buttonStyle(TactileCardButtonStyle())
        }
    }

    private func tile(icon: String, title: String, text: String, meta: String, locked: String?, action: @escaping () -> Void) -> some View {
        Button {
            OnboardingHaptics.light()
            action()
        } label: {
            tileLabel(icon: icon, title: title, text: text, meta: meta, locked: locked)
        }
        .buttonStyle(TactileCardButtonStyle())
        .disabled(locked != nil)
    }

    private func tileLabel(icon: String, title: String, text: String, meta: String, locked: String?) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.onHi)
                .frame(width: 46, height: 46)
                .background(locked == nil ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.cardLine, lineWidth: 1.2))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline).foregroundStyle(Theme.text)
                Text(text).font(.subheadline).foregroundStyle(Theme.text2).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true)
                Text(locked ?? meta).font(.caption.weight(.semibold)).foregroundStyle(Theme.text3)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .opacity(locked == nil ? 1 : 0.6)
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Shared pieces

private struct GameTop: View {
    @Environment(\.dismiss) private var dismiss
    let stats: String
    var body: some View {
        HStack {
            Button { dismiss() } label: { Label("Molaya dön", systemImage: "chevron.left").font(.subheadline.weight(.semibold)) }
                .foregroundStyle(Theme.text)
            Spacer()
            Text(stats).font(.subheadline.weight(.bold).monospacedDigit()).foregroundStyle(Theme.text2)
        }
    }
}

private struct GameResult: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    let badge: String
    let lines: [String]
    let again: () -> Void
    var body: some View {
        VStack(spacing: 14) {
            CelebrationBadgeView()
            Text(title).font(Theme.display(.title2)).foregroundStyle(Theme.text).multilineTextAlignment(.center)
            Text(badge).font(.headline).foregroundStyle(Theme.onHi).padding(.horizontal, 12).padding(.vertical, 6).background(Theme.hi, in: Capsule())
            ForEach(lines, id: \.self) { Text($0).font(.subheadline).foregroundStyle(Theme.text2).multilineTextAlignment(.center) }
            Button { again() } label: { Label("Tekrar oyna", systemImage: "arrow.counterclockwise") }.buttonStyle(PrimaryButtonStyle())
            Button("Molaya dön") { dismiss() }.buttonStyle(SecondaryButtonStyle())
        }
        .padding(20)
        .focusCard()
    }
}

// MARK: - Eşleştir

struct MatchGameView: View {
    @Environment(StudyStore.self) private var store
    let cards: [Card]
    let courseId: UUID?

    @State private var fronts: [Mola.Tile] = []
    @State private var backs: [Mola.Tile] = []
    @State private var selected: Mola.Tile?
    @State private var matched: Set<UUID> = []
    @State private var missFlash: Set<String> = []
    @State private var misses = 0
    @State private var start = Date.now
    @State private var done: (time: Double, best: Bool, previous: Double?)?

    var body: some View {
        ZStack {
            GridPaper()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TimelineView(.periodic(from: .now, by: 0.1)) { ctx in
                        let elapsed = done?.time ?? (ctx.date.timeIntervalSince(start) + Double(misses) * Mola.matchPenalty)
                        GameTop(stats: "\(Mola.formatSeconds(elapsed)) · \(matched.count)/\(fronts.count)")
                    }
                    if let done {
                        GameResult(
                            title: Mola.formatSeconds(done.time),
                            badge: done.best ? "Yeni rekor!" : "Tamamlandı",
                            lines: [misses > 0 ? "\(misses) yanlış eşleşme (+\(misses * 2) sn)" : "Hiç yanlış yok!",
                                    done.previous.map { "Önceki rekor: \(Mola.formatSeconds($0))" } ?? ""].filter { !$0.isEmpty },
                            again: setUp
                        )
                    } else {
                        Text("Bir kavrama, sonra onun cevabına dokun.").font(.subheadline).foregroundStyle(Theme.text2)
                        HStack(alignment: .top, spacing: 10) {
                            column(fronts)
                            column(backs)
                        }
                    }
                }
                .padding(16)
            }
        }
        .onAppear(perform: setUp)
    }

    private func column(_ tiles: [Mola.Tile]) -> some View {
        VStack(spacing: 10) {
            ForEach(tiles) { tile in
                let isMatched = matched.contains(tile.cardId)
                let isSelected = selected?.id == tile.id
                let isMiss = missFlash.contains(tile.id)
                Button { pick(tile) } label: {
                    MathText(tile.text)
                        .font(.subheadline.weight(tile.isFront ? .bold : .regular))
                        .foregroundStyle(isMatched ? Theme.text3 : Theme.text)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .padding(8)
                        .background(isMiss ? Theme.dangerSoft : isSelected ? Theme.hi : isMatched ? Theme.surface2 : Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(isSelected ? Theme.cardLine : Theme.border, lineWidth: isSelected ? 2 : 1))
                        .opacity(isMatched ? 0.45 : 1)
                }
                .buttonStyle(.plain)
                .disabled(isMatched)
                .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isSelected)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func setUp() {
        guard let cols = Mola.matchColumns(cards) else { return }
        fronts = cols.fronts; backs = cols.backs
        selected = nil; matched = []; missFlash = []; misses = 0; done = nil; start = .now
    }

    private func pick(_ tile: Mola.Tile) {
        guard let current = selected, current.id != tile.id, current.isFront != tile.isFront else {
            OnboardingHaptics.selection()
            selected = tile
            return
        }
        if current.cardId == tile.cardId {
            OnboardingHaptics.success()
            withAnimation { _ = matched.insert(tile.cardId) }
            selected = nil
            if matched.count == fronts.count { finish() }
        } else {
            OnboardingHaptics.medium()
            misses += 1
            let ids: Set<String> = [current.id, tile.id]
            withAnimation { missFlash = ids }
            selected = nil
            Task {
                try? await Task.sleep(for: .milliseconds(450))
                withAnimation { missFlash = [] }
            }
        }
    }

    private func finish() {
        let time = Date.now.timeIntervalSince(start) + Double(misses) * Mola.matchPenalty
        let previous = MolaRecords.read().match[MolaRecords.scope(courseId)]
        let best = MolaRecords.saveMatch(time, course: courseId)
        store.recordActivity()
        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { done = (time, best, previous) }
    }
}

// MARK: - Hızlı tur

struct QuickGameView: View {
    @Environment(StudyStore.self) private var store
    let cards: [Card]
    let courseId: UUID?

    @State private var item: Mola.QuickItem?
    @State private var endsAt = Date.now.addingTimeInterval(Mola.quickSeconds)
    @State private var score = 0
    @State private var answered = 0
    @State private var right = 0
    @State private var wrong = 0
    @State private var streak = 0
    @State private var drag: CGFloat = 0
    @State private var flash: Bool?
    @State private var last: (ok: Bool, item: Mola.QuickItem)?
    @State private var result: (best: Bool, previous: Int, byTime: Bool)?

    var body: some View {
        ZStack {
            GridPaper()
            (flash == true ? Theme.success : flash == false ? Theme.danger : .clear).opacity(0.12).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 16) {
                TimelineView(.periodic(from: .now, by: 0.25)) { ctx in
                    let left = max(0, endsAt.timeIntervalSince(ctx.date))
                    GameTop(stats: "\(score) puan · \(Int(left.rounded(.up))) sn")
                        .onChange(of: left == 0) { _, over in if over && result == nil { finish(byTime: true) } }
                }
                if let result {
                    GameResult(
                        title: "\(score) puan",
                        badge: result.best ? "Yeni rekor!" : (result.byTime ? "Süre doldu" : "Haklar bitti"),
                        lines: ["\(right) doğru, \(wrong) yanlış", result.previous > 0 ? "Önceki rekor: \(result.previous) puan" : ""].filter { !$0.isEmpty },
                        again: restart
                    )
                    Spacer()
                } else {
                    HStack(spacing: 6) {
                        ForEach(0..<Mola.quickLives, id: \.self) { i in
                            Image(systemName: i < wrong ? "xmark.square.fill" : "square")
                                .font(.title3)
                                .foregroundStyle(i < wrong ? Theme.danger : Theme.text3)
                        }
                        Spacer()
                        if streak >= 2 { Label("x2", systemImage: "flame.fill").font(.caption.weight(.heavy)).foregroundStyle(Theme.text) }
                    }
                    Spacer()
                    if let item { card(item) }
                    Spacer()
                    HStack(spacing: 12) {
                        Button { answer(false) } label: { Label("Yanlış", systemImage: "xmark") }.buttonStyle(SecondaryButtonStyle())
                        Button { answer(true) } label: { Label("Doğru", systemImage: "checkmark") }.buttonStyle(PrimaryButtonStyle())
                    }
                    if let last, !last.ok {
                        MathText("Doğrusu: \(last.item.answer)").font(.caption).foregroundStyle(Theme.text2).lineLimit(2)
                    }
                }
            }
            .padding(16)
        }
        .onAppear(perform: restart)
    }

    private func card(_ item: Mola.QuickItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            MathText(Mola.tileFront(item.prompt)).font(Theme.display(.title3, weight: .bold)).foregroundStyle(Theme.text)
            Divider().overlay(Theme.border)
            MathText(item.shown).font(.body).foregroundStyle(Theme.text)
            Text("Bu doğru mu? Sağa kaydır: doğru · sola: yanlış").font(.caption).foregroundStyle(Theme.text3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .rotationEffect(.degrees(Double(drag) / 20))
        .offset(x: drag)
        .gesture(
            DragGesture()
                .onChanged { drag = $0.translation.width }
                .onEnded { v in
                    if abs(v.translation.width) > 90 { answer(v.translation.width > 0) }
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { drag = 0 }
                }
        )
        .id(item.cardId.uuidString + item.shown)
        .transition(.asymmetric(insertion: .scale(scale: 0.92).combined(with: .opacity), removal: .opacity))
    }

    private func restart() {
        endsAt = .now.addingTimeInterval(Mola.quickSeconds)
        score = 0; answered = 0; right = 0; wrong = 0; streak = 0; last = nil; result = nil; flash = nil
        item = Mola.nextQuick(cards, previous: nil)
    }

    private func answer(_ sayTrue: Bool) {
        guard let item, result == nil, Date.now < endsAt else { return }
        let ok = sayTrue == item.correct
        answered += 1
        if ok {
            score += Mola.quickPoints(streakBefore: streak)
            right += 1; streak += 1
            OnboardingHaptics.success()
        } else {
            wrong += 1; streak = 0
            OnboardingHaptics.medium()
        }
        last = (ok, item)
        withAnimation(.easeOut(duration: 0.15)) { flash = ok }
        Task {
            try? await Task.sleep(for: .milliseconds(250))
            withAnimation { flash = nil }
        }
        if wrong >= Mola.quickLives { finish(byTime: false); return }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) { self.item = Mola.nextQuick(cards, previous: item.cardId) }
    }

    private func finish(byTime: Bool) {
        guard result == nil else { return }
        let previous = MolaRecords.read().quick[MolaRecords.scope(courseId)] ?? 0
        let best = MolaRecords.saveQuick(score, course: courseId)
        if answered > 0 { store.recordActivity() }
        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) { result = (best, previous, byTime) }
    }
}

// MARK: - Odak sayacı

struct FocusTimerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @State private var clock = PhoneFocusClock.load()
    @State private var records = MolaRecords.read()

    var body: some View {
        ZStack {
            GridPaper()
            VStack(spacing: 22) {
                GameTop(stats: "\(clock.round). tur")
                Spacer()
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    let left = clock.remaining(at: ctx.date)
                    let progress = 1 - left / clock.duration
                    ZStack {
                        Circle().stroke(Theme.surface2, lineWidth: 16)
                        Circle()
                            .trim(from: 0, to: max(0.001, progress))
                            .stroke(clock.resting ? Theme.success : Theme.hi, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        VStack(spacing: 6) {
                            Text(clock.resting ? "Mola" : "Odak").font(.headline).foregroundStyle(Theme.text2)
                            Text(String(format: "%02d:%02d", Int(left) / 60, Int(left) % 60))
                                .font(.system(size: 56, weight: .bold, design: .rounded).monospacedDigit())
                                .foregroundStyle(Theme.text)
                            if !clock.running && !clock.ready { Text("Duraklatıldı").font(.caption).foregroundStyle(Theme.text3) }
                        }
                    }
                    .frame(width: 260, height: 260)
                    .onChange(of: left <= 0) { _, over in if over { tick() } }
                }
                if clock.ready && !clock.resting && clock.round == 1 {
                    Picker("Plan", selection: $clock.plan) {
                        ForEach(PhoneFocusClock.Plan.allCases, id: \.self) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 260)
                }
                Spacer()
                HStack(spacing: 12) {
                    Button {
                        clock.reset(); persist()
                    } label: { Label("Sıfırla", systemImage: "arrow.counterclockwise") }
                    .buttonStyle(SecondaryButtonStyle())
                    Button {
                        let starting = !clock.running
                        OnboardingHaptics.medium()
                        withAnimation { clock.toggle(at: .now) }
                        persist()
                        if starting { Task { _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]); scheduleAlerts() } }
                    } label: {
                        Label(clock.running ? "Duraklat" : (clock.ready ? "Başlat" : "Devam et"), systemImage: clock.running ? "pause.fill" : "play.fill")
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
                Text("Bugün \(records.focus[SRS.dayKey()] ?? 0) dk odak · son 7 gün \(records.focusLastWeek) dk")
                    .font(.caption).foregroundStyle(Theme.text3)
            }
            .padding(16)
        }
        .onAppear { tick() }
        .onChange(of: phase) { _, p in if p == .active { tick() } }
    }

    private func tick() {
        let credited = clock.advance(to: .now)
        if credited > 0 {
            MolaRecords.addFocus(minutes: credited)
            records = MolaRecords.read()
            OnboardingHaptics.success()
        }
        persist()
    }

    private func persist() {
        clock.save()
        scheduleAlerts()
    }

    /// The same reminders as the watch app: focus over, and break over.
    private func scheduleAlerts() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["mola.focus", "mola.rest"])
        guard let end = clock.deadline else { return }
        func schedule(_ id: String, _ title: String, _ date: Date) {
            let delay = date.timeIntervalSinceNow
            guard delay > 0 else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.sound = .default
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false)))
        }
        if !clock.resting { schedule("mola.focus", "Odak tamam. Mola zamanı!", end) }
        let restEnd = clock.resting ? end : end.addingTimeInterval(Double(clock.plan.rest(round: clock.round)) * 60)
        schedule("mola.rest", "Mola bitti. Yeni turun hazır.", restEnd)
    }
}
