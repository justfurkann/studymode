import SwiftUI

/// A note's cards: a full round (Tekrar / Bildim, like the site's Kartlar step) and the card list.
struct NoteCardsSection: View {
    @Environment(StudyStore.self) private var store
    let note: NoteItem
    @State private var round: [Card]?
    @State private var showList = false

    var body: some View {
        let cards = store.cards(of: note)
        let due = cards.filter { $0.isDue() }.count
        let studied = cards.filter { $0.reps > 0 || $0.lapses > 0 }.count
        let done = store.noteSteps(note).contains("pekistir")

        VStack(alignment: .leading, spacing: 16) {
            if cards.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Bu notta kart yok")
                        .font(Theme.display(.title3))
                        .foregroundStyle(Theme.text)
                    Text("Kart ekleme uygulamaya birazdan geliyor; şimdilik sitede kart ekleyebilir ya da testteki yanlışlarını karta çevirebilirsin.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(cards.count)")
                            .font(Theme.display(.largeTitle))
                            .foregroundStyle(Theme.text)
                        Text("kart")
                            .font(Theme.display(.title3, weight: .bold))
                            .foregroundStyle(Theme.text)
                        Spacer()
                        if done {
                            Label("Tamamlandı", systemImage: "checkmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Theme.hi, in: Capsule())
                        }
                    }
                    Text("Çalışılan: \(studied) · Tekrar bekleyen: \(due)")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                    Text("Kartları tek tek hatırlamaya çalış; bilemediklerin aynı turda yine gelir.")
                        .font(.footnote)
                        .foregroundStyle(Theme.text3)
                        .fixedSize(horizontal: false, vertical: true)
                    Button { round = cards } label: {
                        HStack(spacing: 6) { Text(done ? "Yeniden çalış" : "Kartları çalış"); Image(systemName: "arrow.right") }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()

                DisclosureGroup(isExpanded: $showList) {
                    LazyVStack(spacing: 8) {
                        ForEach(cards) { card in
                            VStack(alignment: .leading, spacing: 6) {
                                MathText(card.front)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.text)
                                MathText(card.back)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.text2)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
                        }
                    }
                    .padding(.top, 10)
                } label: {
                    Text("Kartları gör (\(cards.count))")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.text)
                }
                .tint(Theme.text2)
            }
        }
        .fullScreenCover(item: Binding(get: { round.map(NoteRound.init) }, set: { round = $0?.cards })) { box in
            ReviewSession(title: note.title, cards: box.cards, mode: .simple) {
                store.markStepDone(note, step: "pekistir")
            }
            .environment(store)
        }
    }
}

private struct NoteRound: Identifiable {
    let cards: [Card]
    var id: String { cards.map(\.id.uuidString).joined() }
}
