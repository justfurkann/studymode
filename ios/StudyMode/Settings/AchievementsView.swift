import SwiftUI

/// Başarımlar: the level ring with where the XP came from, then the collection (the site's
/// Achievements page). Hidden ones show only their hint until found.
struct AchievementsView: View {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @State private var allDays: [StudyDayCount] = []
    @State private var loaded = false

    private var unlocked: [String: String] { auth.unlockedAchievements }

    var body: some View {
        let parts = store.xpParts(allDays: allDays, unlocked: unlocked)
        let total = parts.reduce(0) { $0 + $1.xp }
        let level = LevelInfo.of(total)
        let progress = store.achievementProgress(allDays: allDays)
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                levelCard(level, total: total, parts: parts)
                HStack {
                    SectionTitle("Başarımlar")
                    Spacer()
                    Text("\(unlocked.count)/\(Achievement.all.count)")
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(Theme.text2)
                }
                LazyVStack(spacing: 10) {
                    ForEach(sorted) { a in
                        AchievementRow(achievement: a, date: unlocked[a.id].flatMap(Dates.parse), progress: progress[a.id])
                    }
                }
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(GridPaper())
        .navigationTitle("Başarımlar")
        .task {
            allDays = (try? await store.allStudyDays()) ?? store.days
            loaded = true
        }
    }

    /// Found ones first (newest first), then visible goals, then hidden ones.
    private var sorted: [Achievement] {
        Achievement.all.sorted { a, b in
            let da = unlocked[a.id], db = unlocked[b.id]
            switch (da, db) {
            case let (x?, y?): return x > y
            case (_?, nil): return true
            case (nil, _?): return false
            default: return !a.isHidden && b.isHidden
            }
        }
    }

    private func levelCard(_ level: LevelInfo, total: Int, parts: [XpPart]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 16) {
                ZStack {
                    Circle().stroke(Theme.surface2, lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: loaded ? max(0.02, level.progress) : 0)
                        .stroke(Theme.hi, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.spring(response: 0.8, dampingFraction: 0.8), value: loaded)
                    VStack(spacing: 0) {
                        Text("Seviye").font(.caption2.weight(.semibold)).foregroundStyle(Theme.text2)
                        Text("\(level.level)").font(Theme.display(.title)).foregroundStyle(Theme.text)
                    }
                }
                .frame(width: 92, height: 92)
                VStack(alignment: .leading, spacing: 4) {
                    Text(level.title).font(Theme.display(.title3, weight: .bold)).foregroundStyle(Theme.text)
                    Text("\(total.formatted(.number.locale(Dates.turkish))) XP · sonraki seviyeye \(level.toNext.formatted(.number.locale(Dates.turkish))) XP")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                    if let ahead = LevelInfo.nextTitle(after: level.level) {
                        Text("Sv \(ahead.level)’de “\(ahead.title)” olursun")
                            .font(.caption)
                            .foregroundStyle(Theme.text3)
                    }
                }
            }
            DisclosureGroup("XP nereden geldi?") {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(parts.filter { $0.count > 0 }) { p in
                        HStack {
                            Text(p.label).foregroundStyle(Theme.text)
                            Text("× \(p.count)").foregroundStyle(Theme.text3)
                            Spacer()
                            Text("+\(p.xp)").fontWeight(.bold).monospacedDigit().foregroundStyle(Theme.text)
                        }
                        .font(.subheadline)
                    }
                    if total == 0 {
                        Text("Henüz XP yok. Bir kart çevir, bir test çöz: hepsi sayılır.").font(.subheadline).foregroundStyle(Theme.text2)
                    }
                    Text("Kart 2 · test ya da sınav 15 · hatasız test +10 · sınav provası +25 · hazırlanan not 20 · çalışılan gün 10 · başarım 20-250 XP.")
                        .font(.caption)
                        .foregroundStyle(Theme.text3)
                        .padding(.top, 4)
                }
                .padding(.top, 8)
            }
            .font(.subheadline.weight(.semibold))
            .tint(Theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
    }
}

private struct AchievementRow: View {
    let achievement: Achievement
    let date: Date?
    let progress: (value: Int, goal: Int)?

    private var found: Bool { date != nil }
    private var secret: Bool { achievement.isHidden && !found }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: secret ? "questionmark" : achievement.icon)
                .font(.title3.weight(.semibold))
                .foregroundStyle(found ? Theme.onHi : Theme.text3)
                .frame(width: 46, height: 46)
                .background(found ? Theme.hi : Theme.surface2, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(found ? Theme.cardLine : Theme.border, lineWidth: found ? 1.5 : 1))
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(secret ? "Gizli başarım" : achievement.name)
                        .font(.headline)
                        .foregroundStyle(found ? Theme.text : Theme.text2)
                    Text(achievement.rarity.label)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.text2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Theme.surface2, in: Capsule())
                }
                Text(secret ? (achievement.hint ?? "") : achievement.description)
                    .font(.subheadline)
                    .foregroundStyle(Theme.text2)
                    .fixedSize(horizontal: false, vertical: true)
                if let date {
                    Text("Bulundu: \(Dates.short(date)) · +\(achievement.rarity.xp) XP")
                        .font(.caption)
                        .foregroundStyle(Theme.text3)
                } else if let progress, progress.goal > 1 {
                    FosforProgressBar(value: Double(progress.value), total: Double(progress.goal), height: 6)
                        .padding(.top, 2)
                    Text("\(progress.value)/\(progress.goal)").font(.caption.monospacedDigit()).foregroundStyle(Theme.text3)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(found ? Theme.cardLine : Theme.border, lineWidth: found ? 1.5 : 1))
        .opacity(found ? 1 : 0.85)
        .accessibilityElement(children: .combine)
    }
}

/// Checks the goals and clock discoveries after loading and after studying, saves new ones to the
/// account and shows a short toast for each (the site's achievement toasts).
struct AchievementWatcher: ViewModifier {
    @Environment(StudyStore.self) private var store
    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var phase
    @State private var toast: Achievement?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let toast {
                    HStack(spacing: 10) {
                        Image(systemName: toast.icon)
                            .foregroundStyle(Theme.onHi)
                            .frame(width: 32, height: 32)
                            .background(Theme.hi, in: Circle())
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Yeni başarım · \(toast.rarity.label)").font(.caption.weight(.bold)).foregroundStyle(Theme.text2)
                            Text(toast.name).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                        }
                        Spacer(minLength: 0)
                        Text("+\(toast.rarity.xp) XP").font(.caption.weight(.heavy)).foregroundStyle(Theme.text)
                    }
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.cardLine, lineWidth: 1.5))
                    .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
                    .padding(.horizontal, 16)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .onTapGesture { withAnimation { self.toast = nil } }
                }
            }
            .task(id: checkKey) { await check() }
    }

    /// Re-check when loading finishes, after a review or test, and when the app comes back.
    private var checkKey: String {
        "\(store.status == .ready)-\(store.reviewsToday)-\(store.attempts.count)-\(store.examResults.count)-\(phase == .active)"
    }

    private func check() async {
        guard store.status == .ready, phase == .active, auth.session != nil else { return }
        let allDays = (try? await store.allStudyDays()) ?? store.days
        let current = auth.unlockedAchievements
        // Goals someone had already reached before (an empty collection) are added quietly.
        let quiet = current.isEmpty
        let fresh = AchievementSync.newlyEarned(current: current, held: auth.heldAchievements, progress: store.achievementProgress(allDays: allDays))
        guard !fresh.isEmpty else { return }
        do {
            try await auth.addAchievements(fresh)
        } catch {
            return
        }
        guard !quiet else { return }
        for id in fresh {
            guard let a = Achievement.byId[id] else { continue }
            OnboardingHaptics.success()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { toast = a }
            try? await Task.sleep(for: .seconds(3))
            withAnimation { toast = nil }
            try? await Task.sleep(for: .milliseconds(300))
        }
    }
}
