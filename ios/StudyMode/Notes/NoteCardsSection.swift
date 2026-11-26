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
                EmptyBox(
                    title: "Bu notta kart yok",
                    text: "Testteki yanlışlarını tek dokunuşla karta çevirebilir ya da siteden kart ekleyebilirsin."
                )
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .center, spacing: 12) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("\(cards.count)")
                                .font(Theme.display(.largeTitle))
                                .foregroundStyle(Theme.text)
                                .contentTransition(.numericText(value: Double(cards.count)))
                            Text("kart")
                                .font(Theme.display(.title3, weight: .bold))
                                .foregroundStyle(Theme.text)
                        }

                        Spacer()

                        if done {
                            Label("Tamamlandı", systemImage: "checkmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 4)
                                .background(Theme.hi, in: Capsule())
                                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                        } else {
                            MiniDeckGlyph()
                        }
                    }

                    FosforProgressBar(value: Double(studied), total: Double(max(cards.count, 1)), height: 9)

                    Text("Çalışılan: \(studied) · Tekrar bekleyen: \(due)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.text2)

                    Text("Kartları 3 boyutlu çevirip sağa-sola kaydırarak çalış; bilemediklerin aynı turda tekrar gelir.")
                        .font(.footnote)
                        .foregroundStyle(Theme.text3)
                        .fixedSize(horizontal: false, vertical: true)

                    Button {
                        OnboardingHaptics.medium()
                        round = cards
                    } label: {
                        HStack(spacing: 6) {
                            Text(done ? "Yeniden çalış" : "Kartları çalış")
                            Image(systemName: "arrow.right")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .focusCard()

                Button {
                    OnboardingHaptics.selection()
                    withAnimation(.spring(response: 0.40, dampingFraction: 0.80)) {
                        showList.toggle()
                    }
                } label: {
                    HStack {
                        Text("Kartları gör (\(cards.count))")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.text)
                        Spacer()
                        Image(systemName: showList ? "chevron.up" : "chevron.down")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Theme.text2)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1))
                }
                .buttonStyle(.plain)

                if showList {
                    LazyVStack(spacing: 8) {
                        ForEach(Array(cards.enumerated()), id: \.element.id) { idx, card in
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
                            .staggeredAppear(idx)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
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

private struct MiniDeckGlyph: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6)
                .fill(Theme.surface2)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.cardLine, lineWidth: 1.2))
                .frame(width: 26, height: 32)
                .rotationEffect(.degrees(-8))
                .offset(x: -5, y: 2)
            RoundedRectangle(cornerRadius: 6)
                .fill(Theme.hi)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.cardLine, lineWidth: 1.5))
                .frame(width: 26, height: 32)
                .rotationEffect(.degrees(6))
                .offset(x: 4, y: -1)
        }
        .frame(width: 44, height: 38)
        .accessibilityHidden(true)
    }
}

private struct NoteRound: Identifiable {
    let cards: [Card]
    var id: String { cards.map(\.id.uuidString).joined() }
}
