import Combine
import SwiftUI

/// Premium Mini-Game 2: "Çekmece" — 4×4 academic stationery merge puzzle (10 chapters, 1–3 stars).
struct DrawerGameView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var stars: [Int] = DrawerLogic.loadStars()
    @State private var chapterIdx: Int = 0
    @State private var grid: [Int?] = DrawerLogic.newGrid(base: 1)
    @State private var selected: Int? = nil
    @State private var hintPair: (Int, Int)? = nil
    @State private var secondsLeft: Int = DrawerLogic.chapters[0].seconds
    @State private var score: Int = 0
    @State private var state: RoundState = .playing
    @State private var earnedStars: Int = 0
    @State private var mergedIndex: Int? = nil
    @State private var spawnedIndex: Int? = nil
    @State private var mergeBanner: String? = nil
    @State private var winSparkTrigger: Int = 0

    enum RoundState { case playing, won, timeUp, stuck }

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var chapter: DrawerChapter { DrawerLogic.chapters[chapterIdx] }
    private var targetSpec: DrawerItemSpec { DrawerLogic.spec(for: chapter.target) }

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                VStack(spacing: 14) {
                    // Chapter strip
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(DrawerLogic.chapters) { ch in
                                let open = DrawerLogic.isChapterOpen(stars, index: ch.id)
                                let active = chapterIdx == ch.id
                                let st = stars[ch.id]
                                Button {
                                    guard open else { return }
                                    OnboardingHaptics.selection()
                                    startChapter(ch.id)
                                } label: {
                                    VStack(spacing: 2) {
                                        Text("B\(ch.id + 1)")
                                            .font(.caption.weight(.heavy))
                                        HStack(spacing: 1) {
                                            ForEach(0..<3, id: \.self) { i in
                                                Image(systemName: i < st ? "star.fill" : "star")
                                                    .font(.system(size: 8))
                                                    .foregroundStyle(i < st ? Theme.prem3 : Theme.text3.opacity(0.4))
                                            }
                                        }
                                    }
                                    .foregroundStyle(active ? Theme.onHi : (open ? Theme.text : Theme.text3))
                                    .padding(.horizontal, 11)
                                    .padding(.vertical, 6)
                                    .background(active ? Theme.hi : Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(active ? Theme.cardLine : Theme.border, lineWidth: active ? 1.4 : 1))
                                    .opacity(open ? 1 : 0.45)
                                }
                                .buttonStyle(.plain)
                                .disabled(!open)
                            }
                        }
                        .padding(.horizontal, 16)
                    }

                    // Target & Timer bar
                    HStack(spacing: 10) {
                        HStack(spacing: 8) {
                            Image(systemName: targetSpec.icon)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(targetSpec.color, in: RoundedRectangle(cornerRadius: 8))
                            VStack(alignment: .leading, spacing: 1) {
                                Text("HEDEF")
                                    .font(.system(size: 9, weight: .heavy))
                                    .foregroundStyle(Theme.text3)
                                Text(targetSpec.name)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Theme.text)
                            }
                        }

                        Spacer()

                        HStack(spacing: 5) {
                            Image(systemName: "timer")
                            Text(formatTime(secondsLeft))
                                .monospacedDigit()
                        }
                        .font(.subheadline.weight(.heavy))
                        .foregroundStyle(secondsLeft <= 10 ? Theme.danger : Theme.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(secondsLeft <= 10 ? Theme.dangerSoft : Theme.surface, in: Capsule())
                        .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                    }
                    .padding(.horizontal, 16)

                    // Live merge feedback banner
                    ZStack {
                        if let mergeBanner {
                            Text(mergeBanner)
                                .font(.caption.weight(.heavy))
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 5)
                                .background(Theme.hi, in: Capsule())
                                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1))
                                .transition(.scale(scale: 0.85).combined(with: .opacity))
                        }
                    }
                    .frame(height: 26)
                    .animation(.spring(response: 0.28, dampingFraction: 0.72), value: mergeBanner)

                    // 4x4 Drawer Grid
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                        ForEach(0..<16, id: \.self) { idx in
                            cellView(index: idx)
                        }
                    }
                    .padding(12)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.cardLine, lineWidth: 1.8))
                    .padding(.horizontal, 16)

                    // Controls
                    HStack(spacing: 10) {
                        Button {
                            guard state == .playing else { return }
                            OnboardingHaptics.light()
                            hintPair = nil
                            let before = grid
                            let next = DrawerLogic.spawnItem(grid, base: chapter.base)
                            let newIdx = next.indices.first { before[$0] == nil && next[$0] != nil }
                            withAnimation(.spring(response: 0.30, dampingFraction: 0.70)) {
                                grid = next
                                spawnedIndex = newIdx
                            }
                            clearSpawnFlash()
                            if DrawerLogic.isStuck(grid) { state = .stuck }
                        } label: {
                            Label("Yeni eşya ekle", systemImage: "plus.circle.fill")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(state != .playing || !grid.contains(where: { $0 == nil }))

                        Button {
                            OnboardingHaptics.selection()
                            hintPair = DrawerLogic.findPair(grid)
                        } label: {
                            Image(systemName: "lightbulb.fill")
                                .font(.headline)
                                .foregroundStyle(Theme.text)
                                .frame(width: 50, height: 50)
                                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                        .disabled(state != .playing)
                    }
                    .padding(.horizontal, 16)

                    Text("Aynı iki eşyaya sırayla dokun → birleşip bir üst seviyeye çıkar!")
                        .font(.caption)
                        .foregroundStyle(Theme.text3)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)

                    Spacer(minLength: 0)
                }
                .padding(.top, 8)

                HighlighterSparkBurst(trigger: winSparkTrigger)

                if state != .playing {
                    resultOverlay
                        .transition(.opacity.combined(with: .scale(scale: 0.90)))
                }
            }
            .animation(.spring(response: 0.42, dampingFraction: 0.80), value: state)
            .navigationTitle("Çekmece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        OnboardingHaptics.light()
                        startChapter(chapterIdx)
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .onAppear {
                let firstOpen = stars.firstIndex(of: 0) ?? 0
                startChapter(firstOpen)
            }
            .onReceive(ticker) { _ in
                guard state == .playing else { return }
                if secondsLeft > 0 {
                    secondsLeft -= 1
                    if secondsLeft == 0 {
                        OnboardingHaptics.light()
                        state = .timeUp
                    }
                }
            }
        }
    }

    private func cellView(index: Int) -> some View {
        let level = grid[index]
        let isSelected = selected == index
        let isHint = hintPair?.0 == index || hintPair?.1 == index
        let isMerged = mergedIndex == index
        let isSpawned = spawnedIndex == index

        return Button {
            tapCell(index)
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        isMerged ? Theme.hi.opacity(0.45) :
                        (level == nil ? Theme.bg : DrawerLogic.spec(for: level!).color.opacity(isSelected ? 0.28 : 0.16))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isMerged ? Theme.hi :
                                (isSelected ? Theme.hi : (isSpawned ? Theme.accent : (isHint ? Theme.prem1 : Theme.border))),
                                lineWidth: (isSelected || isMerged) ? 3 : ((isHint || isSpawned) ? 2 : 1)
                            )
                    )

                if let level {
                    let spec = DrawerLogic.spec(for: level)
                    VStack(spacing: 4) {
                        Image(systemName: spec.icon)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(spec.color)
                        Text(spec.short)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                    }
                    .padding(4)
                    .transition(.scale(scale: 0.45).combined(with: .opacity))
                }
            }
            .frame(height: 76)
            .scaleEffect(isMerged ? 1.14 : (isSelected ? 1.06 : 1.0))
            .shadow(color: isSelected ? Theme.hi.opacity(0.45) : .clear, radius: 6, y: 2)
            .animation(.spring(response: 0.28, dampingFraction: 0.62), value: isMerged)
            .animation(.spring(response: 0.24, dampingFraction: 0.72), value: isSelected)
            .animation(.spring(response: 0.30, dampingFraction: 0.72), value: level)
        }
        .buttonStyle(.plain)
    }

    private func tapCell(_ index: Int) {
        guard state == .playing else { return }
        hintPair = nil

        if grid[index] == nil {
            selected = nil
            return
        }

        if let from = selected {
            if from == index {
                selected = nil
                return
            }
            if let res = DrawerLogic.merge(grid, from: from, to: index) {
                OnboardingHaptics.medium()
                selected = nil
                score += res.points
                let newSpec = DrawerLogic.spec(for: res.level)
                withAnimation(.spring(response: 0.28, dampingFraction: 0.65)) {
                    grid = res.grid
                    mergedIndex = index
                    mergeBanner = "✨ \(newSpec.name)! +\(res.points)"
                }

                if res.level >= chapter.target {
                    earnedStars = DrawerLogic.stars(leftSec: secondsLeft, totalSec: chapter.seconds)
                    stars = DrawerLogic.saveStar(chapter: chapterIdx, stars: earnedStars)
                    winSparkTrigger += 1
                    OnboardingHaptics.success()
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(550))
                        withAnimation(.spring(response: 0.44, dampingFraction: 0.80)) {
                            state = .won
                        }
                    }
                    return
                }

                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(260))
                    withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                        mergedIndex = nil
                    }
                    let before = grid
                    let next = DrawerLogic.spawnItem(grid, base: chapter.base)
                    let newIdx = next.indices.first { before[$0] == nil && next[$0] != nil }
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.68)) {
                        grid = next
                        spawnedIndex = newIdx
                    }
                    clearSpawnFlash()
                    if DrawerLogic.isStuck(grid) {
                        state = .stuck
                    }
                }
            } else {
                OnboardingHaptics.selection()
                selected = index
            }
        } else {
            OnboardingHaptics.selection()
            selected = index
        }
    }

    private func clearSpawnFlash() {
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(500))
            withAnimation(.easeOut(duration: 0.2)) {
                spawnedIndex = nil
            }
            try? await Task.sleep(for: .milliseconds(700))
            withAnimation(.easeOut(duration: 0.2)) {
                mergeBanner = nil
            }
        }
    }

    private var resultOverlay: some View {
        ZStack {
            Color.black.opacity(0.42).ignoresSafeArea()
            VStack(spacing: 14) {
                if state == .won {
                    HStack(spacing: 6) {
                        ForEach(0..<3, id: \.self) { i in
                            Image(systemName: i < earnedStars ? "star.fill" : "star")
                                .font(.title)
                                .foregroundStyle(i < earnedStars ? Theme.prem3 : Theme.text3.opacity(0.4))
                        }
                    }
                    Text("Bölüm \(chapterIdx + 1) tamam!")
                        .font(Theme.display(.title2))
                        .foregroundStyle(Theme.text)
                    Text("\(targetSpec.name) hedefine ulaştın!")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)

                    if chapterIdx + 1 < DrawerLogic.chapters.count {
                        Button("Sonraki bölüm") {
                            startChapter(chapterIdx + 1)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    Button("Tekrar oyna") {
                        startChapter(chapterIdx)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                } else {
                    Text(state == .timeUp ? "Süre bitti!" : "Çekmece doldu!")
                        .font(Theme.display(.title2))
                        .foregroundStyle(Theme.text)
                    Text("Biraz daha hızlı birleştirip tekrar dene.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.text2)
                    Button("Tekrar dene") {
                        startChapter(chapterIdx)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
            }
            .padding(24)
            .frame(maxWidth: 310)
            .focusCard()
        }
    }

    private func startChapter(_ idx: Int) {
        chapterIdx = max(0, min(DrawerLogic.chapters.count - 1, idx))
        grid = DrawerLogic.newGrid(base: chapter.base)
        selected = nil
        hintPair = nil
        secondsLeft = chapter.seconds
        score = 0
        state = .playing
    }

    private func formatTime(_ sec: Int) -> String {
        String(format: "%d:%02d", sec / 60, sec % 60)
    }
}
