import SwiftUI

/// "Tekrar": today's goal and readiness per course, not a pile of due cards
/// (docs/IOS_SYNC.md, "Ortak kural: yeni Tekrar").
struct ReviewTab: View {
    @Environment(StudyStore.self) private var store
    @State private var session: SessionBox?

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        if store.status != .ready {
                            StudyLoadingStage(message: "Tekrar planın hesaplanıyor…", cardCount: 2)
                        } else {
                            goalCard
                                .staggeredAppear(0)
                            readinessList
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 32)
                }
                .refreshable { await store.load() }
            }
            .navigationTitle("Tekrar")
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .fullScreenCover(item: $session) { box in
            ReviewSession(title: "Tekrar", cards: box.cards, mode: .daily)
                .environment(store)
        }
    }

    // MARK: Today's goal

    private var goalCard: some View {
        let goal = store.dailyGoal
        let done = min(goal, store.reviewsToday)
        let queue = store.todayQueue
        let reached = store.goalLeft == 0
        let nothing = !reached && queue.isEmpty

        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                GoalRing(done: done, goal: goal)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(reached ? "Bugün tamam" : "Bugünkü hedef")
                            .font(Theme.display(.title3, weight: .bold))
                            .foregroundStyle(Theme.text)
                        if store.streak > 0 {
                            Label("\(store.streak)", systemImage: "flame.fill")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Theme.hi, in: Capsule())
                                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                        }
                    }
                    Text(subtitle(reached: reached, nothing: nothing, left: queue.count))
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                TalkingFosfor(
                    size: 46,
                    mood: reached ? .cheering : (nothing ? .proud : .curious)
                )
            }

            if reached {
                if store.hasMore() {
                    Button {
                        OnboardingHaptics.medium()
                        let more = store.reviewQueue(size: ReviewRules.moreSize, newAllowed: store.newLeftToday)
                        if !more.isEmpty { session = SessionBox(cards: more) }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus.circle.fill")
                            Text("Biraz daha (+\(ReviewRules.moreSize))")
                        }
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
            } else if !nothing {
                Button {
                    OnboardingHaptics.medium()
                    session = SessionBox(cards: queue)
                } label: {
                    HStack(spacing: 6) {
                        Text(done == 0 ? "Başla" : "Devam et")
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            }

            HStack(spacing: 6) {
                Image(systemName: "sparkle")
                    .font(.caption2)
                Text("Bugün başlayan yeni kart: \(min(store.newToday, ReviewRules.newPerDay)) / \(ReviewRules.newPerDay)")
                    .font(.caption)
            }
            .foregroundStyle(Theme.text3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .padding(.top, 4)
    }

    private func subtitle(reached: Bool, nothing: Bool, left: Int) -> String {
        if reached { return "Hedefini bitirdin. Yarın yaklaşık \(store.tomorrowEstimate) kart seni bekliyor." }
        if nothing {
            return store.cards.isEmpty
                ? "Henüz kartın yok. Bir not hazırlanınca kartları burada tekrar edersin."
                : "Şu an tekrar zamanı gelen kart yok. Yeni kartlar, özetini okuduğun ya da testini çözdüğün notlardan gelir."
        }
        let minutes = max(1, Int((Double(left) / 3).rounded()))
        return "\(left) kart kaldı · ~\(minutes) dk"
    }

    // MARK: Readiness

    @ViewBuilder
    private var readinessList: some View {
        let rows = store.readinessRows
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionTitle("Derslere göre hazırlık")
                    .staggeredAppear(1)
                ForEach(Array(rows.enumerated()), id: \.element.course.id) { idx, row in
                    ReadinessRow(course: row.course, readiness: row.readiness)
                        .staggeredAppear(idx + 2)
                }
            }
        }
    }
}

private struct GoalRing: View {
    let done: Int
    let goal: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animatedFraction: CGFloat = 0

    private var targetFraction: CGFloat {
        min(1, CGFloat(done) / CGFloat(max(goal, 1)))
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.surface2, lineWidth: 9)
            Circle()
                .trim(from: 0, to: animatedFraction)
                .stroke(Theme.cardLine, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Circle()
                .trim(from: 0, to: animatedFraction)
                .stroke(Theme.hi, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(done)/\(goal)")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(Theme.text)
                .contentTransition(.numericText(value: Double(done)))
        }
        .frame(width: 68, height: 68)
        .onAppear {
            if reduceMotion {
                animatedFraction = targetFraction
            } else {
                withAnimation(.spring(response: 0.65, dampingFraction: 0.78)) {
                    animatedFraction = targetFraction
                }
            }
        }
        .onChange(of: done) { _, _ in
            withAnimation(.spring(response: 0.50, dampingFraction: 0.78)) {
                animatedFraction = targetFraction
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Bugünkü hedef: \(goal) kartın \(done) tanesi")
    }
}

private struct ReadinessRow: View {
    @Environment(StudyStore.self) private var store
    let course: Course
    let readiness: Int?

    var body: some View {
        let exam = store.nextExam(course).flatMap { Exams.countdown($0, store.audience) }
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Circle().fill(course.tint).frame(width: 9, height: 9)
                Text(course.name)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let exam {
                    CountdownChip(text: exam.text, tone: exam.tone)
                } else {
                    Text("Sınav yok").font(.caption).foregroundStyle(Theme.text3)
                }
            }
            FosforProgressBar(value: Double(readiness ?? 0), total: 100, height: 8)
            HStack {
                Text(readiness.map { "Hazırlık: %\($0)" } ?? "Hazırlık henüz ölçülmedi")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Theme.text2)
                Spacer()
                Text("\(store.cardCount(course: course)) kart")
                    .font(.caption)
                    .foregroundStyle(Theme.text3)
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

/// fullScreenCover needs an Identifiable item; the queue is fixed when the session starts.
struct SessionBox: Identifiable {
    let cards: [Card]
    let id = UUID()
}
