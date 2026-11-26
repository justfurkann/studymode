import SwiftUI

/// "Tekrar": today's cards, across all courses or one picked course (the site's /tekrar).
struct ReviewTab: View {
    @Environment(StudyStore.self) private var store
    @State private var selected: UUID?
    @State private var session: [Card]?

    private var dueCourses: [(course: Course, count: Int)] {
        store.courses
            .map { ($0, store.dueCount(course: $0)) }
            .filter { $0.1 > 0 }
            .sorted { $0.1 > $1.1 }
    }

    private var due: [Card] {
        let course = selected.flatMap { id in store.courses.first { $0.id == id } }
        return store.dueCards(course: course)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        if store.status != .ready {
                            ProgressView().tint(Theme.text2).frame(maxWidth: .infinity).padding(.top, 40)
                        } else if store.dueCount() == 0 {
                            nothingDue
                        } else {
                            if dueCourses.count > 1 { picker }
                            startCard
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
        .fullScreenCover(item: Binding(get: { session.map(SessionBox.init) }, set: { session = $0?.cards })) { box in
            ReviewSession(title: box.title(store: store, selected: selected), cards: box.cards, mode: .grades)
                .environment(store)
        }
    }

    private var picker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Hangi dersi tekrar edeceksin?")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.text2)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip(name: "Tümü", color: nil, count: store.dueCount(), isOn: selected == nil) { selected = nil }
                    ForEach(dueCourses, id: \.course.id) { item in
                        chip(name: item.course.name, color: item.course.tint, count: item.count, isOn: selected == item.course.id) {
                            selected = item.course.id
                        }
                    }
                }
            }
        }
    }

    private func chip(name: String, color: Color?, count: Int, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let color { Circle().fill(color).frame(width: 8, height: 8) }
                Text(name).lineLimit(1)
                Text("\(count)")
                    .font(.caption.weight(.bold).monospacedDigit())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background(isOn ? Theme.onHi.opacity(0.12) : Theme.surface2, in: Capsule())
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(isOn ? Theme.onHi : Theme.text)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isOn ? Theme.hi : Theme.surface, in: Capsule())
            .overlay(Capsule().stroke(isOn ? Theme.cardLine : Theme.border, lineWidth: isOn ? 1.5 : 1))
        }
        .buttonStyle(.plain)
    }

    private var startCard: some View {
        let cards = due
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(cards.count)")
                    .font(Theme.display(.largeTitle))
                    .foregroundStyle(Theme.text)
                Text("kart seni bekliyor")
                    .font(Theme.display(.title3, weight: .bold))
                    .foregroundStyle(Theme.text)
            }
            Text("Her kartta önce hatırlamaya çalış, sonra cevaba bak ve ne kadar iyi bildiğini seç. Bilemediklerin aynı turda yine gelir.")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
            Button { session = cards } label: {
                HStack(spacing: 6) { Text("Tekrara başla"); Image(systemName: "arrow.right") }
            }
            .buttonStyle(PrimaryButtonStyle())
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .padding(.top, 4)
    }

    private var nothingDue: some View {
        let next = store.cards.map(\.dueDate).filter { $0 > .now }.min()
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text("Bugünlük")
                    .font(Theme.display(.title2))
                    .foregroundStyle(Theme.text)
                Highlighted(text: "tamam", font: Theme.display(.title2))
            }
            Text(store.cards.isEmpty
                 ? "Henüz kartın yok. Bir not hazırlanınca kartları burada tekrar edersin."
                 : "Şu an tekrar zamanı gelen kart yok.\(next.map { " Sıradaki kart \(relative($0)) gelecek." } ?? "")")
                .font(.subheadline)
                .foregroundStyle(Theme.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .focusCard()
        .padding(.top, 4)
    }

    private func relative(_ date: Date) -> String {
        let minutes = Int(date.timeIntervalSinceNow / 60)
        if minutes < 60 { return "\(max(1, minutes)) dakika sonra" }
        if Calendar.current.isDateInToday(date) { return "bugün \(date.formatted(.dateTime.hour().minute().locale(Dates.turkish)))" }
        if Calendar.current.isDateInTomorrow(date) { return "yarın" }
        return Dates.short(date) + " günü"
    }
}

/// fullScreenCover needs an Identifiable item; the queue is fixed when the session starts.
private struct SessionBox: Identifiable {
    let cards: [Card]
    var id: String { cards.map(\.id.uuidString).joined() }

    @MainActor func title(store: StudyStore, selected: UUID?) -> String {
        selected.flatMap { id in store.courses.first { $0.id == id }?.name } ?? "Tekrar"
    }
}
