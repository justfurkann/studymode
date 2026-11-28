import SwiftUI
import UserNotifications
import WatchKit

@main
struct StudyModeWatchApp: App {
    var body: some Scene {
        WindowGroup {
            FocusWatchRootView()
        }
    }
}

private struct FocusWatchRootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isLuminanceReduced) private var dimmed
    @AppStorage("watch.focus.v1") private var saved = Data()

    @State private var clock = FocusClock()
    @State private var selectedPage = 0
    @State private var confirmReset = false
    @State private var asked = false
    @State private var burstTrigger = 0

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                TabView(selection: $selectedPage) {
                    dialPage(now: context.date)
                        .tag(0)

                    statsAndPlanPage(now: context.date)
                        .tag(1)
                }
                .tabViewStyle(.verticalPage)
                .containerBackground(for: .navigation) {
                    WatchAmbientBackdrop(
                        resting: clock.resting,
                        isRunning: clock.deadline != nil,
                        dimmed: dimmed
                    )
                }
                .onChange(of: context.date) { _, date in refresh(date) }
            }
            .navigationTitle("StudyMode")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                if let restored = try? JSONDecoder().decode(FocusClock.self, from: saved) {
                    clock = restored
                }
                refresh(.now)
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { refresh(.now) }
            }
            .confirmationDialog("Turu bitir?", isPresented: $confirmReset) {
                Button("Turu bitir", role: .destructive) {
                    WKInterfaceDevice.current().play(.stop)
                    withAnimation(.spring(response: 0.36, dampingFraction: 0.80)) {
                        clock.reset()
                    }
                    persist()
                }
                Button("Vazgeç", role: .cancel) {}
            }
        }
    }

    // MARK: - Page 1: Chronograph Dial

    private func dialPage(now: Date) -> some View {
        let remaining = clock.remaining(at: now)
        let total = max(1, clock.duration)
        let progress = clock.ready ? 1.0 : (remaining / total)
        let seconds = Int(ceil(remaining))
        let isRunning = clock.deadline != nil
        let isPaused = clock.pausedSeconds != nil
        let cycleSlot = ((clock.round - 1) % 4) + 1
        let accent = clock.resting ? WatchPalette.mint : WatchPalette.yellow
        let onAccent = clock.resting ? WatchPalette.onMint : WatchPalette.onYellow

        return GeometryReader { geo in
            let compact = geo.size.height < 168
            let ringSize = min(geo.size.width - 6, geo.size.height + (compact ? 10 : 14))

            ZStack {
                ChronographArcView(
                    progress: progress,
                    resting: clock.resting,
                    isPaused: isPaused,
                    dimmed: dimmed
                )
                .frame(width: ringSize, height: ringSize)
                .offset(y: compact ? 4 : 6)

                VStack(spacing: compact ? 2 : 4) {
                    // Mascot + mode badge
                    HStack(spacing: 5) {
                        WatchFosforView(
                            size: compact ? 20 : 23,
                            expression: isPaused ? .paused : (clock.resting ? .rest : .focus),
                            dimmed: dimmed
                        )
                        Text(modeLabel.uppercased())
                            .font(.system(size: compact ? 10 : 11, weight: .heavy, design: .rounded))
                            .tracking(0.6)
                            .foregroundStyle(accent)
                    }
                    .padding(.top, compact ? 16 : 20)

                    // Big monospaced countdown
                    Text(String(format: "%02d:%02d", seconds / 60, seconds % 60))
                        .font(.system(size: compact ? 32 : 38, weight: .heavy, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .contentTransition(.numericText(countsDown: true))
                        .minimumScaleFactor(0.75)
                        .lineLimit(1)
                        .accessibilityLabel("\(seconds / 60) dakika, \(seconds % 60) saniye")

                    // 4-round Pomodoro cycle pills + status
                    HStack(spacing: 4) {
                        ForEach(1...4, id: \.self) { step in
                            Capsule()
                                .fill(step <= cycleSlot ? accent : Color.white.opacity(0.20))
                                .frame(width: step == cycleSlot ? 12 : 6, height: 4.5)
                        }
                        Text(isPaused ? "Duraklatıldı" : "\(clock.round). tur")
                            .font(.system(size: 10, weight: .semibold, design: .rounded))
                            .foregroundStyle(.secondary)
                            .padding(.leading, 2)
                    }

                    Spacer(minLength: 2)

                    // Bottom dock inside the open mouth of the chronograph arc
                    if clock.ready {
                        Button {
                            toggleClock()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "play.fill")
                                    .font(.caption.weight(.black))
                                Text("Başlat")
                                    .font(.system(size: compact ? 13 : 14, weight: .bold, design: .rounded))
                            }
                            .foregroundStyle(onAccent)
                            .padding(.horizontal, compact ? 18 : 22)
                            .padding(.vertical, compact ? 7 : 8.5)
                            .background(accent, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    } else {
                        HStack(spacing: 10) {
                            Button {
                                WKInterfaceDevice.current().play(.click)
                                confirmReset = true
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundStyle(.white.opacity(0.88))
                                    .frame(width: compact ? 36 : 40, height: compact ? 32 : 35)
                                    .background(WatchPalette.surface, in: Capsule())
                                    .overlay(Capsule().stroke(WatchPalette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Turu bitir")

                            Button {
                                toggleClock()
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: isRunning ? "pause.fill" : "play.fill")
                                        .font(.caption.weight(.black))
                                    Text(isRunning ? "Duraklat" : "Devam")
                                        .font(.system(size: compact ? 12 : 13, weight: .bold, design: .rounded))
                                }
                                .foregroundStyle(onAccent)
                                .padding(.horizontal, compact ? 13 : 16)
                                .frame(height: compact ? 32 : 35)
                                .background(accent, in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.bottom, compact ? 2 : 4)

                WatchSparkBurst(trigger: burstTrigger, resting: clock.resting)
            }
        }
    }

    // MARK: - Page 2: Plan & Today's Focus Summary

    private func statsAndPlanPage(now: Date) -> some View {
        let todayMinutes = clock.minutes(on: now)
        return ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                // Today's total focus card
                VStack(alignment: .leading, spacing: 4) {
                    Label("Bugünkü odak", systemImage: "flame.fill")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(WatchPalette.yellow)
                    Text("\(todayMinutes) dk")
                        .font(.system(.title3, design: .rounded, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                    Text("4. turun sonunda \(clock.plan.rest(round: 4)) dk uzun mola açılır.")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(WatchPalette.surface.opacity(0.85), in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(WatchPalette.border, lineWidth: 1))

                Text("Odak planı")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 2)

                ForEach(FocusClock.Plan.allCases, id: \.self) { plan in
                    let selected = clock.plan == plan
                    Button {
                        guard clock.ready else { return }
                        WKInterfaceDevice.current().play(.click)
                        withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
                            clock.plan = plan
                        }
                        persist()
                    } label: {
                        HStack(spacing: 8) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(plan.watchLabel)
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundStyle(selected ? WatchPalette.onYellow : .white)
                                Text("Uzun mola: \(plan.rest(round: 4)) dk")
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(selected ? WatchPalette.onYellow.opacity(0.75) : .secondary)
                            }
                            Spacer(minLength: 2)
                            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                .font(.footnote.weight(.bold))
                                .foregroundStyle(selected ? WatchPalette.onYellow : .secondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(
                            selected ? WatchPalette.yellow : WatchPalette.surface.opacity(0.75),
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(selected ? WatchPalette.yellow : WatchPalette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .opacity(clock.ready || selected ? 1.0 : 0.5)
                }

                if !clock.ready {
                    Text("Planı değiştirmek için önce mevcut turu bitir.")
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 2)
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 8)
        }
    }

    private var modeLabel: String {
        if clock.resting {
            return clock.round.isMultiple(of: 4) ? "Uzun mola" : "Mola"
        }
        return "Odak"
    }

    // MARK: - Timer & Notification Logic

    private func toggleClock() {
        let starting = clock.deadline == nil
        WKInterfaceDevice.current().play(starting ? .start : .stop)
        withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) {
            clock.toggle(at: .now)
        }
        persist()
        if starting && !asked {
            asked = true
            Task {
                _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                scheduleAlerts()
            }
        }
    }

    private func refresh(_ now: Date) {
        guard let end = clock.deadline, end <= now else { return }
        withAnimation(.spring(response: 0.44, dampingFraction: 0.76)) {
            clock.advance(to: now)
        }
        burstTrigger += 1
        if scenePhase == .active {
            WKInterfaceDevice.current().play(.success)
        }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(clock) { saved = data }
        scheduleAlerts()
    }

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
            center.add(
                UNNotificationRequest(
                    identifier: id,
                    content: content,
                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false)
                )
            )
        }
        if !clock.resting { schedule("mola.focus", "Odak tamam. Mola zamanı!", end) }
        let restEnd = clock.resting ? end : end.addingTimeInterval(Double(clock.plan.rest(round: clock.round)) * 60)
        schedule("mola.rest", "Mola bitti. Yeni turun hazır.", restEnd)
    }
}
