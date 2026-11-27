import SwiftUI

// MARK: - Pressable Tactile Card Button Style

/// Subtle spring press scale for tappable cards and rows without stealing scroll gestures.
struct TactileCardButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.975

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1.0)
            .opacity(configuration.isPressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.24, dampingFraction: 0.72), value: configuration.isPressed)
    }
}

// MARK: - Staggered Entrance Modifier

struct StaggeredAppearModifier: ViewModifier {
    let index: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    func body(content: Content) -> some View {
        content
            .opacity(visible ? 1 : 0)
            .offset(y: visible ? 0 : 12)
            .onAppear {
                guard !visible else { return }
                if reduceMotion {
                    visible = true
                } else {
                    let clampedDelay = Double(min(index, 8)) * 0.045
                    withAnimation(.spring(response: 0.44, dampingFraction: 0.82).delay(clampedDelay)) {
                        visible = true
                    }
                }
            }
    }
}

extension View {
    func staggeredAppear(_ index: Int) -> some View {
        modifier(StaggeredAppearModifier(index: index))
    }
}

// MARK: - Animated Fosforlu Shimmer Skeleton

/// Stationery-style skeleton loader with Fosfor while notes, courses, or questions are loading.
struct StudyLoadingStage: View {
    var message: String = "Çalışma masan hazırlanıyor…"
    var cardCount: Int = 3
    var fosforScreen: FosforScreen?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shimmerPhase: CGFloat = -1.0

    private var loadingLabel: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(message)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Theme.text)
            Text("Notlar ve ilerleme eşitleniyor")
                .font(.caption)
                .foregroundStyle(Theme.text3)
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            Group {
                if let fosforScreen {
                    TalkingFosfor(screen: fosforScreen, size: 46, mood: .marking) {
                        loadingLabel
                    }
                } else {
                    HStack(spacing: 12) {
                        FosforMascotView(size: 46, mood: .marking)
                        loadingLabel
                        Spacer()
                    }
                }
            }
            .padding(.horizontal, 4)

            ForEach(0..<cardCount, id: \.self) { idx in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Capsule()
                            .fill(Theme.hi.opacity(0.45))
                            .frame(width: idx == 0 ? 90 : 68, height: 12)
                        Spacer()
                        Capsule()
                            .fill(Theme.surface2)
                            .frame(width: 48, height: 12)
                    }
                    Capsule()
                        .fill(Theme.surface2)
                        .frame(maxWidth: .infinity)
                        .frame(height: 11)
                    Capsule()
                        .fill(Theme.surface2)
                        .frame(width: idx.isMultiple(of: 2) ? 190 : 140, height: 11)
                }
                .padding(16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
                .overlay {
                    if !reduceMotion {
                        GeometryReader { geo in
                            LinearGradient(
                                colors: [.clear, Theme.hi.opacity(0.18), .clear],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .frame(width: geo.size.width * 0.55)
                            .offset(x: shimmerPhase * geo.size.width * 1.5)
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
        }
        .padding(.top, 12)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false)) {
                shimmerPhase = 1.2
            }
        }
    }
}

// MARK: - Smooth Animated Highlighter Progress Bar

struct FosforProgressBar: View {
    let value: Double
    let total: Double
    var height: CGFloat = 10

    private var fraction: CGFloat {
        guard total > 0 else { return 0 }
        return min(max(CGFloat(value / total), 0), 1)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Theme.surface2)
                Capsule()
                    .fill(Theme.hi)
                    .frame(width: fraction == 0 ? 0 : max(height * 1.4, geo.size.width * fraction))
                    .overlay(
                        Capsule()
                            .stroke(Theme.cardLine, lineWidth: fraction > 0 ? 1.5 : 0)
                    )
                    .animation(.spring(response: 0.45, dampingFraction: 0.80), value: fraction)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Tactile Segmented Pill Bar with Sliding Highlighter

struct FosforSegmentedBar<Item: Hashable>: View {
    struct Segment: Identifiable {
        let value: Item
        let title: String
        var icon: String? = nil
        var isDone: Bool = false
        var id: Item { value }
    }

    let segments: [Segment]
    @Binding var selection: Item
    @Namespace private var slideNamespace

    var body: some View {
        HStack(spacing: 4) {
            ForEach(segments) { seg in
                let active = selection == seg.value
                Button {
                    guard selection != seg.value else { return }
                    OnboardingHaptics.selection()
                    withAnimation(.spring(response: 0.36, dampingFraction: 0.80)) {
                        selection = seg.value
                    }
                } label: {
                    HStack(spacing: 5) {
                        if seg.isDone {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(active ? Theme.onHi : Theme.success)
                        } else if let icon = seg.icon {
                            Image(systemName: icon)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(active ? Theme.onHi : Theme.text2)
                        }
                        Text(seg.title)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(active ? Theme.onHi : Theme.text2)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background {
                        if active {
                            RoundedRectangle(cornerRadius: 11)
                                .fill(Theme.hi)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 11)
                                        .stroke(Theme.cardLine, lineWidth: 1.5)
                                )
                                .matchedGeometryEffect(id: "activeSegment", in: slideNamespace)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(Theme.border, lineWidth: 1))
    }
}

// MARK: - Celebration Hero Badge (Fosfor + Animated Check + Spark Burst)

struct CelebrationBadgeView: View {
    var showFosfor: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var popped = false
    @State private var burst = 0

    var body: some View {
        ZStack {
            HighlighterSparkBurst(trigger: burst)

            HStack(spacing: -10) {
                ZStack {
                    Circle()
                        .fill(Theme.cardDrop)
                        .frame(width: 78, height: 78)
                        .offset(y: 4)
                    Circle()
                        .fill(Theme.hi)
                        .frame(width: 78, height: 78)
                        .overlay(Circle().stroke(Theme.cardLine, lineWidth: 2.5))
                    Image(systemName: "checkmark")
                        .font(.system(size: 32, weight: .black))
                        .foregroundStyle(Theme.onHi)
                        .symbolEffect(.bounce, value: popped)
                }
                .scaleEffect(popped ? 1.0 : 0.55)

                if showFosfor {
                    FosforMascotView(size: 56, mood: .cheering)
                        .rotationEffect(.degrees(7))
                        .offset(y: 8)
                }
            }
        }
        .onAppear {
            OnboardingHaptics.success()
            if reduceMotion {
                popped = true
            } else {
                withAnimation(.spring(response: 0.48, dampingFraction: 0.65)) {
                    popped = true
                }
                Task { @MainActor in
                    try? await Task.sleep(for: .milliseconds(160))
                    burst += 1
                }
            }
        }
    }
}
