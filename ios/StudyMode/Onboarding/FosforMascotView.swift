import SwiftUI
import UIKit

/// StudyMode's living highlighter mascot ("Fosfor"), ported natively from `src/components/Assistant.tsx`
/// with blinking eyes, breathing float, mood expressions, and tactile tap reactions.
struct FosforMascotView: View {
    enum Mood: Equatable {
        case curious
        case marking
        case proud
        case cheering
    }

    var size: CGFloat = 58
    var mood: Mood = .curious
    var badge: String? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var scheme

    @State private var isBlinking = false
    @State private var hopTrigger = 0
    @State private var floatPhase = false

    private var capColor: Color {
        scheme == .dark
            ? Color(uiColor: UIColor(hex: 0x4A5291))
            : Color(uiColor: UIColor(hex: 0x1B2250))
    }

    private var inkColor: Color {
        scheme == .dark
            ? Color(uiColor: UIColor(hex: 0x05060F))
            : Color(uiColor: UIColor(hex: 0x1B2250))
    }

    var body: some View {
        HStack(spacing: 8) {
            mascotBody
                .frame(width: size, height: size)
                .offset(y: reduceMotion ? 0 : (floatPhase ? -3.5 : 2.5))
                .keyframeAnimator(initialValue: HopValues(), trigger: hopTrigger) { content, val in
                    content
                        .scaleEffect(x: val.scaleX, y: val.scaleY)
                        .rotationEffect(.degrees(val.tilt))
                        .offset(y: val.offsetY)
                } keyframes: { _ in
                    KeyframeTrack(\.offsetY) {
                        SpringKeyframe(-12, duration: 0.16, spring: .bouncy)
                        SpringKeyframe(0, duration: 0.34, spring: .bouncy(duration: 0.34, extraBounce: 0.25))
                    }
                    KeyframeTrack(\.scaleX) {
                        CubicKeyframe(0.92, duration: 0.08)
                        CubicKeyframe(1.08, duration: 0.14)
                        SpringKeyframe(1.0, duration: 0.28, spring: .bouncy)
                    }
                    KeyframeTrack(\.scaleY) {
                        CubicKeyframe(1.10, duration: 0.08)
                        CubicKeyframe(0.94, duration: 0.14)
                        SpringKeyframe(1.0, duration: 0.28, spring: .bouncy)
                    }
                    KeyframeTrack(\.tilt) {
                        CubicKeyframe(-9, duration: 0.10)
                        CubicKeyframe(8, duration: 0.14)
                        SpringKeyframe(0, duration: 0.26, spring: .bouncy)
                    }
                }
                .onTapGesture {
                    OnboardingHaptics.light()
                    hopTrigger += 1
                }

            if let badge {
                Text(badge)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Theme.surface, in: Capsule())
                    .overlay(Capsule().stroke(Theme.cardLine, lineWidth: 1.5))
                    .background(Capsule().fill(Theme.cardDrop).offset(y: 2))
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
        }
        .accessibilityHidden(true)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.1).repeatForever(autoreverses: true)) {
                floatPhase = true
            }
        }
        .onChange(of: mood) { _, _ in
            guard !reduceMotion else { return }
            hopTrigger += 1
        }
        .task {
            guard !reduceMotion else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(Int.random(in: 2600...4400)))
                guard !Task.isCancelled else { break }
                withAnimation(.easeOut(duration: 0.08)) { isBlinking = true }
                try? await Task.sleep(for: .milliseconds(120))
                withAnimation(.easeIn(duration: 0.10)) { isBlinking = false }
            }
        }
    }

    private var mascotBody: some View {
        Canvas { context, canvasSize in
            let s = min(canvasSize.width, canvasSize.height) / 64.0

            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * s, y: y * s)
            }
            func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> CGRect {
                CGRect(x: x * s, y: y * s, width: w * s, height: h * s)
            }

            // Soft tactile drop shadow under body
            let shadowRect = rect(15, 19.5, 34, 42)
            let shadowPath = Path(roundedRect: shadowRect, cornerRadius: 13 * s)
            context.fill(shadowPath, with: .color(Theme.cardDrop.opacity(0.85)))

            // Chisel tip
            var tip = Path()
            tip.move(to: pt(24.5, 4.5))
            tip.addLine(to: pt(37.5, 4.5))
            tip.addQuadCurve(to: pt(39.5, 5.8), control: pt(38.9, 4.5))
            tip.addLine(to: pt(42.5, 13.0))
            tip.addLine(to: pt(21.5, 13.0))
            tip.addLine(to: pt(22.9, 5.8))
            tip.addQuadCurve(to: pt(24.5, 4.5), control: pt(23.2, 4.5))
            tip.closeSubpath()
            context.fill(tip, with: .color(capColor))

            // Cap collar
            let collar = Path(roundedRect: rect(19.5, 11.5, 25, 8), cornerRadius: 3 * s)
            context.fill(collar, with: .color(capColor))

            // Highlighter yellow body + crisp ink outline
            let bodyRect = rect(15, 17, 34, 42)
            let bodyPath = Path(roundedRect: bodyRect, cornerRadius: 13 * s)
            context.fill(bodyPath, with: .color(Theme.hi))
            context.stroke(bodyPath, with: .color(inkColor), lineWidth: 3 * s)

            // Glossy shine strip
            let shine = Path(roundedRect: rect(20.5, 23, 4.5, 13), cornerRadius: 2.25 * s)
            context.fill(shine, with: .color(.white.opacity(0.65)))

            // Eyes (blink or mood)
            let eyeOffsetX: CGFloat = mood == .marking ? -1.2 : (mood == .proud ? 0.8 : 0)
            if isBlinking {
                var leftBlink = Path()
                leftBlink.move(to: pt(24.2 + eyeOffsetX, 37))
                leftBlink.addLine(to: pt(29.8 + eyeOffsetX, 37))
                var rightBlink = Path()
                rightBlink.move(to: pt(34.2 + eyeOffsetX, 37))
                rightBlink.addLine(to: pt(39.8 + eyeOffsetX, 37))
                context.stroke(leftBlink, with: .color(inkColor), style: StrokeStyle(lineWidth: 2.6 * s, lineCap: .round))
                context.stroke(rightBlink, with: .color(inkColor), style: StrokeStyle(lineWidth: 2.6 * s, lineCap: .round))
            } else if mood == .cheering {
                // Happy arc eyes ^ ^
                var leftArc = Path()
                leftArc.move(to: pt(24.2, 38.2))
                leftArc.addQuadCurve(to: pt(29.8, 38.2), control: pt(27.0, 33.4))
                var rightArc = Path()
                rightArc.move(to: pt(34.2, 38.2))
                rightArc.addQuadCurve(to: pt(39.8, 38.2), control: pt(37.0, 33.4))
                context.stroke(leftArc, with: .color(inkColor), style: StrokeStyle(lineWidth: 2.7 * s, lineCap: .round))
                context.stroke(rightArc, with: .color(inkColor), style: StrokeStyle(lineWidth: 2.7 * s, lineCap: .round))
            } else {
                let leftEye = Path(ellipseIn: rect(24.1 + eyeOffsetX, 33.3, 5.8, 7.4))
                let rightEye = Path(ellipseIn: rect(34.1 + eyeOffsetX, 33.3, 5.8, 7.4))
                context.fill(leftEye, with: .color(inkColor))
                context.fill(rightEye, with: .color(inkColor))

                let leftSpark = Path(ellipseIn: rect(27.0 + eyeOffsetX, 34.7, 2.1, 2.1))
                let rightSpark = Path(ellipseIn: rect(37.0 + eyeOffsetX, 34.7, 2.1, 2.1))
                context.fill(leftSpark, with: .color(.white))
                context.fill(rightSpark, with: .color(.white))
            }

            // Rosy cheeks
            let leftCheek = Path(ellipseIn: rect(19.4, 42.3, 6.2, 3.8))
            let rightCheek = Path(ellipseIn: rect(38.4, 42.3, 6.2, 3.8))
            context.fill(leftCheek, with: .color(Theme.danger.opacity(0.32)))
            context.fill(rightCheek, with: .color(Theme.danger.opacity(0.32)))

            // Expressive mouth
            var mouth = Path()
            let smileDepth: CGFloat = (mood == .cheering || mood == .proud) ? 6.8 : 4.8
            mouth.move(to: pt(27.6, 44.0))
            mouth.addQuadCurve(to: pt(36.4, 44.0), control: pt(32.0, 44.0 + smileDepth))
            context.stroke(mouth, with: .color(inkColor), style: StrokeStyle(lineWidth: 2.6 * s, lineCap: .round))
        }
    }

    private struct HopValues {
        var offsetY: CGFloat = 0
        var scaleX: CGFloat = 1
        var scaleY: CGFloat = 1
        var tilt: Double = 0
    }
}

/// Crisp, lightweight haptics for onboarding interactions.
enum OnboardingHaptics {
    @MainActor
    static func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.75)
    }

    @MainActor
    static func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred(intensity: 0.85)
    }

    @MainActor
    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    @MainActor
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

/// Geometric ink-and-highlighter burst particles (no emojis, pure Fosforlu stationery aesthetic).
struct HighlighterSparkBurst: View {
    let trigger: Int

    @State private var progress: CGFloat = 0
    @State private var visible = false

    private let rays: [(angle: Double, dist: CGFloat, isYellow: Bool)] = [
        (-155, 58, true), (-125, 72, false), (-95, 64, true), (-65, 74, true),
        (-35, 60, false), (-10, 52, true), (195, 50, false), (15, 48, true)
    ]

    var body: some View {
        ZStack {
            if visible {
                ForEach(Array(rays.enumerated()), id: \.offset) { idx, ray in
                    let rad = ray.angle * .pi / 180
                    RoundedRectangle(cornerRadius: 2.5)
                        .fill(ray.isYellow ? Theme.hi : Theme.accent)
                        .overlay(
                            RoundedRectangle(cornerRadius: 2.5)
                                .stroke(Theme.cardLine, lineWidth: 1)
                        )
                        .frame(width: idx.isMultiple(of: 2) ? 11 : 7, height: 6)
                        .rotationEffect(.degrees(ray.angle + Double(progress) * 35))
                        .offset(
                            x: cos(rad) * ray.dist * progress,
                            y: sin(rad) * ray.dist * progress
                        )
                        .scaleEffect(1.0 - progress * 0.45)
                        .opacity(Double(1.0 - progress))
                }
            }
        }
        .allowsHitTesting(false)
        .onChange(of: trigger) { _, _ in
            progress = 0
            visible = true
            withAnimation(.easeOut(duration: 0.62)) {
                progress = 1
            }
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(650))
                visible = false
            }
        }
    }
}
