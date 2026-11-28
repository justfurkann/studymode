import SwiftUI

/// Premium Mini-Game 3: "Kâğıt top" — Flick crumpled notebook paper into the desk bin with live wind physics!
struct PaperTossGameView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var wind: CGFloat = 1.4 // negative = left, positive = right
    @State private var streak: Int = 0
    @State private var best: Int = PaperTossStore.bestStreak
    @State private var statusText: String = "Kâğıt topu yukarı fırlat!"
    @State private var sparkTrigger: Int = 0

    // Flight state
    @State private var isFlying = false
    @State private var flightStart: Date = .now
    @State private var launchVX: CGFloat = 0
    @State private var launchVY: CGFloat = 0
    @State private var dragPreview: CGSize = .zero
    @State private var landedResult: Bool? = nil

    private let flightDuration: Double = 0.85

    var body: some View {
        NavigationStack {
            ZStack {
                GridPaper()
                GeometryReader { geo in
                    let w = geo.size.width
                    let h = geo.size.height
                    let binCenter = CGPoint(x: w * 0.5, y: h * 0.34)
                    let launchCenter = CGPoint(x: w * 0.5, y: h * 0.80)

                    ZStack {
                        // Top HUD: Streak + Best + Wind indicator
                        VStack(spacing: 12) {
                            HStack {
                                HStack(spacing: 6) {
                                    Image(systemName: "flame.fill").foregroundStyle(Theme.onHi)
                                    Text("Seri: \(streak)").fontWeight(.heavy)
                                }
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(Theme.onHi)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Theme.hi, in: Capsule())
                                .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1.2))

                                Spacer()

                                Text("Rekor: \(best)")
                                    .font(.caption.weight(.bold).monospacedDigit())
                                    .foregroundStyle(Theme.text2)
                                    .padding(.horizontal, 11)
                                    .padding(.vertical, 6)
                                    .background(Theme.surface, in: Capsule())
                                    .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                            }

                            // Wind badge
                            HStack(spacing: 8) {
                                Image(systemName: wind >= 0 ? "arrow.right" : "arrow.left")
                                    .font(.subheadline.weight(.heavy))
                                    .foregroundStyle(Theme.prem1)
                                Text("Rüzgâr: \(Double(abs(wind)).formatted(.number.precision(.fractionLength(1)).locale(Dates.turkish)))")
                                    .font(.subheadline.weight(.bold).monospacedDigit())
                                    .foregroundStyle(Theme.text)
                                Image(systemName: "wind")
                                    .foregroundStyle(Theme.prem1)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Theme.surface, in: Capsule())
                            .overlay(Capsule().stroke(Theme.border, lineWidth: 1.2))

                            Text(statusText)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(landedResult == true ? Theme.success : (landedResult == false ? Theme.danger : Theme.text2))
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 10)
                        .frame(maxHeight: .infinity, alignment: .top)

                        // Desk wastebasket
                        wastebasket
                            .position(binCenter)

                        HighlighterSparkBurst(trigger: sparkTrigger)
                            .position(binCenter)

                        // Paper ball (either idle+draggable or flying along parabolic arc with wind)
                        TimelineView(.animation(minimumInterval: 1 / 60, paused: !isFlying)) { timeline in
                            let t = isFlying ? min(1.0, timeline.date.timeIntervalSince(flightStart) / flightDuration) : 0.0
                            let pos = ballPosition(t: t, start: launchCenter, target: binCenter)
                            let scale = isFlying ? (1.0 - 0.56 * CGFloat(t)) : 1.0
                            let spin = isFlying ? Double(t) * 540.0 : 0.0

                            paperBall
                                .scaleEffect(scale)
                                .rotationEffect(.degrees(spin))
                                .position(
                                    x: pos.x + (isFlying ? 0 : dragPreview.width * 0.22),
                                    y: pos.y + (isFlying ? 0 : min(28, max(-28, dragPreview.height * 0.22)))
                                )
                                .gesture(
                                    DragGesture(minimumDistance: 12)
                                        .onChanged { val in
                                            guard !isFlying else { return }
                                            dragPreview = val.translation
                                        }
                                        .onEnded { val in
                                            guard !isFlying else { return }
                                            let dy = -val.translation.height
                                            dragPreview = .zero
                                            guard dy > 26 else { return }
                                            launch(dx: val.translation.width, dy: dy, width: w)
                                        }
                                )
                        }
                    }
                }
            }
            .navigationTitle("Kâğıt top")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { Image(systemName: "xmark") }
                }
            }
            .onAppear { randomizeWind() }
            .onChange(of: sparkTrigger) { _, _ in StudySound.paperBasket.play() }
        }
    }

    private var wastebasket: some View {
        ZStack {
            // Back rim
            Ellipse()
                .fill(Theme.cardDrop.opacity(0.75))
                .frame(width: 94, height: 22)
                .offset(y: -36)
            // Bin body (trapezoid)
            BinShape()
                .fill(
                    LinearGradient(
                        colors: [Theme.surface2, Theme.border],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(BinShape().stroke(Theme.cardLine, lineWidth: 2))
                .frame(width: 94, height: 76)
            // Front rim
            Ellipse()
                .stroke(Theme.cardLine, lineWidth: 2.5)
                .frame(width: 94, height: 22)
                .offset(y: -36)
        }
    }

    private var paperBall: some View {
        ZStack {
            Circle()
                .fill(Color(light: 0xFFFFFF, dark: 0xF4F3EA))
                .frame(width: 64, height: 64)
                .overlay(Circle().stroke(Theme.cardLine, lineWidth: 2.2))
                .shadow(color: .black.opacity(0.18), radius: 8, y: 4)
            // Crumple lines
            Image(systemName: "scribble.variable")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color(uiColor: UIColor(hex: 0x1B2250)).opacity(0.35))
        }
    }

    private func ballPosition(t: Double, start: CGPoint, target: CGPoint) -> CGPoint {
        guard isFlying else { return start }
        let u = CGFloat(t)
        // Horizontal: player flick angle + quadratic wind drift
        let windDrift = wind * 32.0 * u * u
        let x = start.x + launchVX * u + windDrift
        // Vertical: high parabolic arc toward bin
        let arcHeight: CGFloat = 175 * launchVY
        let baseY = start.y + (target.y - start.y) * u
        let y = baseY - arcHeight * 4 * u * (1 - u)
        return CGPoint(x: x, y: y)
    }

    private func launch(dx: CGFloat, dy: CGFloat, width: CGFloat) {
        OnboardingHaptics.medium()
        landedResult = nil
        statusText = "Uçuyor…"
        launchVX = max(-width * 0.45, min(width * 0.45, dx * 0.95))
        launchVY = max(0.65, min(1.35, dy / 170.0))
        flightStart = .now
        isFlying = true

        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(Int(flightDuration * 1000)))
            let finalOffsetX = launchVX + wind * 32.0
            let hit = abs(finalOffsetX) < 42.0 && launchVY >= 0.72 && launchVY <= 1.28
            if hit {
                streak += 1
                if streak > best {
                    best = streak
                    PaperTossStore.bestStreak = streak
                }
                landedResult = true
                statusText = streak >= 3 ? "Müthiş isabet! 🔥 (\(streak) seri)" : "İsabet! 🎯"
                sparkTrigger += 1
                OnboardingHaptics.success()
            } else {
                streak = 0
                landedResult = false
                statusText = finalOffsetX < 0 ? "Sola kaçtı — rüzgârı hesaba kat!" : "Sağa kaçtı — rüzgârı hesaba kat!"
                OnboardingHaptics.light()
            }
            try? await Task.sleep(for: .milliseconds(450))
            isFlying = false
            randomizeWind()
        }
    }

    private func randomizeWind() {
        let strength = Double.random(in: 0.4...4.2)
        wind = CGFloat(Bool.random() ? strength : -strength)
    }
}

private struct BinShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - 14, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX + 14, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
