import SwiftUI
import UserNotifications

@main
struct StudyModeWatchApp: App {
    var body: some Scene {
        WindowGroup { FocusView() }
    }
}

private struct FocusView: View {
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("watch.focus.v1") private var saved = Data()
    @State private var clock = FocusClock()
    @State private var confirmReset = false
    @State private var asked = false
    private let yellow = Color(red: 1, green: 0.88, blue: 0.3)

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                ScrollView {
                    VStack(spacing: 8) {
                        Text(clock.resting ? (clock.round.isMultiple(of: 4) ? "Uzun mola" : "Mola") : "Odak")
                            .font(.headline).foregroundStyle(yellow)
                        let seconds = Int(ceil(clock.remaining(at: context.date)))
                        Text(String(format: "%02d:%02d", seconds / 60, seconds % 60))
                            .font(.system(.largeTitle, design: .rounded, weight: .bold))
                            .monospacedDigit()
                            .accessibilityLabel("\(seconds / 60) dakika, \(seconds % 60) saniye")
                        Text(clock.pausedSeconds == nil ? "\(clock.round). tur" : "Duraklatıldı")
                            .font(.caption).foregroundStyle(.secondary)
                        Button {
                            let starting = clock.deadline == nil
                            clock.toggle(at: .now)
                            persist()
                            if starting && !asked {
                                asked = true
                                Task {
                                    _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                                    scheduleAlerts()
                                }
                            }
                        } label: {
                            Label(clock.deadline != nil ? "Duraklat" : (clock.ready ? "Başlat" : "Devam et"),
                                  systemImage: clock.deadline != nil ? "pause.fill" : "play.fill")
                        }
                        .buttonStyle(.borderedProminent).tint(yellow).foregroundStyle(.black)
                        if clock.ready {
                            Picker("Odak planı", selection: Binding(get: { clock.plan }, set: { clock.plan = $0; persist() })) {
                                ForEach(FocusClock.Plan.allCases, id: \.self) { plan in
                                    Text("\(plan.minutes) + \(plan.rest(round: 1)) dk").tag(plan)
                                }
                            }
                            .pickerStyle(.navigationLink)
                        } else {
                            Button("Turu bitir") { confirmReset = true }
                        }
                        if clock.minutes(on: context.date) > 0 {
                            Text("Bugün \(clock.minutes(on: context.date)) dk odak")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                .onChange(of: context.date) { _, date in refresh(date) }
            }
            .navigationTitle("StudyMode")
            .onAppear {
                if let restored = try? JSONDecoder().decode(FocusClock.self, from: saved) { clock = restored }
                refresh(.now)
            }
            .onChange(of: scenePhase) { _, phase in if phase == .active { refresh(.now) } }
            .confirmationDialog("Turu bitir?", isPresented: $confirmReset) {
                Button("Turu bitir", role: .destructive) { clock.reset(); persist() }
                Button("Vazgeç", role: .cancel) {}
            }
        }
    }

    private func refresh(_ now: Date) {
        guard let end = clock.deadline, end <= now else { return }
        clock.advance(to: now)
        if scenePhase == .active { WKInterfaceDevice.current().play(.notification) }
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
            center.add(UNNotificationRequest(identifier: id, content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false)))
        }
        if !clock.resting { schedule("mola.focus", "Odak tamam. Mola zamanı!", end) }
        let restEnd = clock.resting ? end : end.addingTimeInterval(Double(clock.plan.rest(round: clock.round)) * 60)
        schedule("mola.rest", "Mola bitti. Yeni turun hazır.", restEnd)
    }
}
