import SwiftUI
import WatchKit

enum WatchPalette {
    static let bgTop = Color(red: 0.08, green: 0.10, blue: 0.22)
    static let bgBottom = Color(red: 0.05, green: 0.06, blue: 0.13)
    static let surface = Color(red: 0.13, green: 0.16, blue: 0.30)
    static let border = Color.white.opacity(0.14)
    static let yellow = Color(red: 1.0, green: 0.88, blue: 0.30)      // #FFE14D
    static let onYellow = Color(red: 0.07, green: 0.08, blue: 0.16)   // #11142A
    static let mint = Color(red: 0.22, green: 0.85, blue: 0.62)       // Calm break accent
    static let onMint = Color(red: 0.04, green: 0.16, blue: 0.12)
    static let cap = Color(red: 0.32, green: 0.37, blue: 0.66)
    static let ink = Color(red: 0.07, green: 0.08, blue: 0.16)
}

/// Subtle StudyMode notebook grid + radial breathing aura tailored for OLED Apple Watch screens.
struct WatchAmbientBackdrop: View {
    let resting: Bool
    let isRunning: Bool
    let dimmed: Bool

    @State private var breathe = false

    private var glowColor: Color {
        resting ? WatchPalette.mint : WatchPalette.yellow
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [WatchPalette.bgTop, WatchPalette.bgBottom],
                startPoint: .top,
                endPoint: .bottom
            )

            // Subtle notebook grid
            if !dimmed {
                Canvas { context, size in
                    let step: CGFloat = 20
                    var grid = Path()
                    var x: CGFloat = 0
                    while x <= size.width {
                        grid.move(to: CGPoint(x: x, y: 0))
                        grid.addLine(to: CGPoint(x: x, y: size.height))
                        x += step
                    }
                    var y: CGFloat = 0
                    while y <= size.height {
                        grid.move(to: CGPoint(x: 0, y: y))
                        grid.addLine(to: CGPoint(x: size.width, y: y))
                        y += step
                    }
                    context.stroke(grid, with: .color(.white.opacity(0.035)), lineWidth: 0.75)
                }
            }

            // Breathing radial glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            glowColor.opacity(dimmed ? 0.06 : (isRunning ? 0.24 : 0.13)),
                            glowColor.opacity(0)
                        ],
                        center: .center,
                        startRadius: 4,
                        endRadius: 95
                    )
                )
                .scaleEffect(isRunning && !dimmed ? (breathe ? 1.12 : 0.90) : 0.95)
                .offset(y: -12)
        }
        .ignoresSafeArea()
        .onAppear {
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                breathe = true
            }
        }
    }
}

/// Open-bottom 256-degree chronograph progress ring with glowing tip bead.
struct ChronographArcView: View {
    /// Remaining or elapsed progress in 0...1 (1 = full ring, 0 = empty, or elapsed fill).
    let progress: Double
    let resting: Bool
    let isPaused: Bool
    let dimmed: Bool

    @State private var pulseTip = false

    private let startTrim: CGFloat = 0.145
    private let endTrim: CGFloat = 0.855

    private var clamped: CGFloat {
        min(max(CGFloat(progress), 0), 1)
    }

    private var activeEnd: CGFloat {
        startTrim + (endTrim - startTrim) * clamped
    }

    private var accent: Color {
        resting ? WatchPalette.mint : WatchPalette.yellow
    }

    var body: some View {
        GeometryReader { geo in
            let lineWidth: CGFloat = min(geo.size.width, geo.size.height) < 170 ? 8.5 : 10.0
            let side = min(geo.size.width, geo.size.height) - lineWidth
            let radius = side / 2.0
            let center = CGPoint(x: geo.size.width / 2.0, y: geo.size.height / 2.0)

            ZStack {
                // Background track
                Circle()
                    .inset(by: lineWidth / 2)
                    .trim(from: startTrim, to: endTrim)
                    .stroke(
                        Color.white.opacity(dimmed ? 0.10 : 0.15),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(90))

                // Soft outer neon halo when active
                if !dimmed && clamped > 0.005 {
                    Circle()
                        .inset(by: lineWidth / 2)
                        .trim(from: startTrim, to: activeEnd)
                        .stroke(
                            accent.opacity(isPaused ? 0.18 : 0.30),
                            style: StrokeStyle(lineWidth: lineWidth + 4, lineCap: .round)
                        )
                        .blur(radius: 2.5)
                        .rotationEffect(.degrees(90))
                }

                // Main active progress arc
                if clamped > 0.002 {
                    Circle()
                        .inset(by: lineWidth / 2)
                        .trim(from: startTrim, to: activeEnd)
                        .stroke(
                            accent.opacity(isPaused ? (pulseTip ? 0.55 : 0.95) : 1.0),
                            style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                        )
                        .rotationEffect(.degrees(90))
                }

                // Tip indicator bead centered cleanly inside the stroke
                if !dimmed && clamped > 0.01 {
                    let angleDeg = 90.0 + Double(activeEnd) * 360.0
                    let rad = angleDeg * .pi / 180.0
                    Circle()
                        .fill(WatchPalette.ink)
                        .frame(width: lineWidth * 0.46, height: lineWidth * 0.46)
                        .position(
                            x: center.x + cos(rad) * radius,
                            y: center.y + sin(rad) * radius
                        )
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .animation(.easeOut(duration: 0.45), value: clamped)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                pulseTip = true
            }
        }
    }
}

/// Compact vector Fosfor mascot for Apple Watch with blinking eyes and tap hop.
struct WatchFosforView: View {
    enum Expression: Equatable {
        case focus
        case rest
        case paused
    }

    var size: CGFloat = 26
    let expression: Expression
    let dimmed: Bool

    @State private var blink = false
    @State private var hop = false

    var body: some View {
        Canvas { context, canvasSize in
            let s = min(canvasSize.width, canvasSize.height) / 64.0
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
                CGRect(x: x * s, y: y * s, width: w * s, height: h * s)
            }

            // Chisel tip
            var tip = Path()
            tip.move(to: pt(24.5, 4.5))
            tip.addLine(to: pt(37.5, 4.5))
            tip.addLine(to: pt(42.0, 13.0))
            tip.addLine(to: pt(21.5, 13.0))
            tip.closeSubpath()
            context.fill(tip, with: .color(WatchPalette.cap))

            // Collar
            let collar = Path(roundedRect: rect(19.5, 11.5, 25, 8), cornerRadius: 3 * s)
            context.fill(collar, with: .color(WatchPalette.cap))

            // Body
            let bodyColor = expression == .rest ? WatchPalette.mint : WatchPalette.yellow
            let bodyPath = Path(roundedRect: rect(14, 17, 36, 43), cornerRadius: 13 * s)
            context.fill(bodyPath, with: .color(bodyColor.opacity(dimmed ? 0.75 : 1)))
            context.stroke(bodyPath, with: .color(WatchPalette.ink), lineWidth: 3 * s)

            // Shine
            let shine = Path(roundedRect: rect(20, 23, 4.5, 12), cornerRadius: 2.2 * s)
            context.fill(shine, with: .color(.white.opacity(0.6)))

            // Eyes
            if blink || expression == .paused {
                var l = Path(); l.move(to: pt(23.5, 37)); l.addLine(to: pt(29.5, 37))
                var r = Path(); r.move(to: pt(34.5, 37)); r.addLine(to: pt(40.5, 37))
                context.stroke(l, with: .color(WatchPalette.ink), style: StrokeStyle(lineWidth: 3 * s, lineCap: .round))
                context.stroke(r, with: .color(WatchPalette.ink), style: StrokeStyle(lineWidth: 3 * s, lineCap: .round))
            } else if expression == .rest {
                var l = Path(); l.move(to: pt(23.5, 38.5)); l.addQuadCurve(to: pt(29.8, 38.5), control: pt(26.6, 33))
                var r = Path(); r.move(to: pt(34.2, 38.5)); r.addQuadCurve(to: pt(40.5, 38.5), control: pt(37.4, 33))
                context.stroke(l, with: .color(WatchPalette.ink), style: StrokeStyle(lineWidth: 3 * s, lineCap: .round))
                context.stroke(r, with: .color(WatchPalette.ink), style: StrokeStyle(lineWidth: 3 * s, lineCap: .round))
            } else {
                context.fill(Path(ellipseIn: rect(23.8, 33, 6.2, 7.8)), with: .color(WatchPalette.ink))
                context.fill(Path(ellipseIn: rect(34.0, 33, 6.2, 7.8)), with: .color(WatchPalette.ink))
                context.fill(Path(ellipseIn: rect(26.8, 34.4, 2.2, 2.2)), with: .color(.white))
                context.fill(Path(ellipseIn: rect(37.0, 34.4, 2.2, 2.2)), with: .color(.white))
            }

            // Smile
            var mouth = Path()
            mouth.move(to: pt(27.2, 45))
            mouth.addQuadCurve(to: pt(36.8, 45), control: pt(32, expression == .paused ? 47 : 51))
            context.stroke(mouth, with: .color(WatchPalette.ink), style: StrokeStyle(lineWidth: 2.8 * s, lineCap: .round))
        }
        .frame(width: size, height: size)
        .scaleEffect(hop ? 1.16 : 1.0)
        .offset(y: hop ? -3 : 0)
        .onTapGesture {
            WKInterfaceDevice.current().play(.click)
            withAnimation(.spring(response: 0.25, dampingFraction: 0.55)) { hop = true }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(200))
                withAnimation(.spring(response: 0.3, dampingFraction: 0.65)) { hop = false }
            }
        }
        .task(id: dimmed) {
            guard !dimmed else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(Int.random(in: 3000...5000)))
                guard !Task.isCancelled else { break }
                blink = true
                try? await Task.sleep(for: .milliseconds(130))
                blink = false
            }
        }
        .accessibilityHidden(true)
    }
}

/// Radial celebration burst when a focus or break round completes on the watch.
struct WatchSparkBurst: View {
    let trigger: Int
    let resting: Bool

    @State private var progress: CGFloat = 0
    @State private var active = false

    private let angles: [Double] = [0, 45, 90, 135, 180, 225, 270, 315]

    var body: some View {
        ZStack {
            if active {
                ForEach(angles, id: \.self) { deg in
                    let rad = deg * .pi / 180.0
                    Capsule()
                        .fill(resting ? WatchPalette.mint : WatchPalette.yellow)
                        .frame(width: 9, height: 4)
                        .rotationEffect(.degrees(deg))
                        .offset(
                            x: cos(rad) * 58 * progress,
                            y: sin(rad) * 58 * progress
                        )
                        .opacity(Double(1 - progress))
                }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: trigger) { _, _ in
            progress = 0
            active = true
            withAnimation(.easeOut(duration: 0.55)) {
                progress = 1
            }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(580))
                active = false
            }
        }
    }
}
