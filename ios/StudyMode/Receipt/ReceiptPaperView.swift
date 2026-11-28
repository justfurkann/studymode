import SwiftUI
import UIKit

// MARK: - Serrated Thermal Receipt Paper Shape

struct SerratedReceiptShape: Shape {
    var toothWidth: CGFloat = 11
    var toothHeight: CGFloat = 6.5
    var flatTop: Bool = false

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let count = max(6, Int((rect.width / max(4, toothWidth)).rounded()))
        let step = rect.width / CGFloat(count)
        let topY: CGFloat = flatTop ? 0 : toothHeight
        let bottomY: CGFloat = rect.height - toothHeight

        p.move(to: CGPoint(x: 0, y: topY))
        if flatTop {
            p.addLine(to: CGPoint(x: rect.width, y: 0))
        } else {
            for i in 0..<count {
                let midX = CGFloat(i) * step + step * 0.5
                let nextX = CGFloat(i + 1) * step
                p.addLine(to: CGPoint(x: midX, y: 0))
                p.addLine(to: CGPoint(x: nextX, y: topY))
            }
        }

        p.addLine(to: CGPoint(x: rect.width, y: bottomY))
        for i in stride(from: count - 1, through: 0, by: -1) {
            let midX = CGFloat(i) * step + step * 0.5
            let prevX = CGFloat(i) * step
            p.addLine(to: CGPoint(x: midX, y: rect.height))
            p.addLine(to: CGPoint(x: prevX, y: bottomY))
        }
        p.closeSubpath()
        return p
    }
}

// MARK: - Scalable Physical Thermal Receipt View

/// Renders both the interactive 3D studio receipt (`scale = 1.0`, canonical width `336pt`)
/// and the high-resolution `1080×1920` Story export (`scale = 2.52`, width `847px`).
struct ReceiptPaperView: View {
    let stats: ReceiptStats
    let prefs: ReceiptPrefs
    var scale: CGFloat = 1.0
    var flatTopEdge: Bool = false
    var stampSlammed: Bool = true
    var stampPulse: CGFloat = 0
    var glintOffset: CGFloat = 2.0 // -1.2 ... 1.2 sweeps diagonal glossy sheen across paper
    var stampMotion: ReceiptStampMotion = .hidden

    private var palette: ReceiptPalette { prefs.theme.palette }
    private func s(_ v: CGFloat) -> CGFloat { v * scale }

    private var cleanName: String {
        prefs.showIdentity ? String(prefs.studentName.trimmingCharacters(in: .whitespaces).prefix(34)) : ""
    }

    private var cleanTag: String {
        prefs.showIdentity ? String(prefs.studentTag.trimmingCharacters(in: .whitespaces).prefix(42)) : ""
    }

    private var cleanMotto: String {
        String(prefs.motto.trimmingCharacters(in: .whitespaces).prefix(72))
    }

    var body: some View {
        let shape = SerratedReceiptShape(
            toothWidth: s(10.5),
            toothHeight: s(6.5),
            flatTop: flatTopEdge
        )

        VStack(alignment: .leading, spacing: s(12)) {
            brandRow
            dashedRule
            heading
            highlights
            results
            dashedRule
            closing
        }
        .padding(.horizontal, s(25))
        .padding(.top, flatTopEdge ? s(24) : s(26))
        .padding(.bottom, s(23))
        .frame(width: s(336))
        .background {
            ZStack {
                palette.paper
                ThermalFiberTexture(ink: palette.ink, scale: scale, isDark: palette.isDarkPaper)
                if glintOffset > -1.4 && glintOffset < 1.4 {
                    GeometryReader { geo in
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: .white.opacity(palette.isDarkPaper ? 0.05 : 0.14), location: 0.45),
                                .init(color: palette.hi.opacity(palette.isDarkPaper ? 0.06 : 0.09), location: 0.52),
                                .init(color: .clear, location: 1.0),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .frame(width: geo.size.width * 1.4, height: geo.size.height * 0.55)
                        .rotationEffect(.degrees(-18))
                        .offset(
                            x: -geo.size.width * 0.2,
                            y: glintOffset * geo.size.height * 0.65 + geo.size.height * 0.2
                        )
                        .allowsHitTesting(false)
                    }
                }
            }
            .clipShape(shape)
        }
        .overlay(
            shape.stroke(palette.line, lineWidth: max(1, s(1.1)))
        )
    }

    private var brandRow: some View {
        HStack(spacing: s(12)) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(width: s(124))
                .environment(\.colorScheme, palette.isDarkPaper ? .dark : .light)
                .accessibilityHidden(true)

            Spacer(minLength: 0)

            Text(stats.generatedAt.formatted(
                .dateTime.day(.twoDigits).month(.twoDigits).year().locale(Dates.turkish)
            ))
            .font(.system(size: s(11), weight: .medium, design: .monospaced))
            .foregroundStyle(palette.inkSoft)
        }
    }

    private var heading: some View {
        VStack(alignment: .leading, spacing: s(3)) {
            Text(stats.period == .gun ? "GÜNLÜK DÖKÜM" : "HAFTALIK DÖKÜM")
                .font(.system(size: s(10), weight: .medium, design: .monospaced))
                .tracking(s(0.5))
                .foregroundStyle(palette.inkSoft)

            Text("ÇALIŞMA FİŞİ")
                .font(.system(size: s(31), weight: .black, design: .rounded))
                .foregroundStyle(palette.ink)
                .accessibilityAddTraits(.isHeader)

            let identity = [cleanName, cleanTag].filter { !$0.isEmpty }.joined(separator: " · ")
            if !identity.isEmpty {
                Text(identity)
                    .font(.system(size: s(11), weight: .semibold))
                    .foregroundStyle(palette.inkSoft)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var highlights: some View {
        HStack(spacing: s(11)) {
            highlight(
                value: stats.focusMinutes.formatted(.number.locale(Dates.turkish)),
                unit: "dk",
                label: "ODAK SÜRESİ"
            )

            Rectangle()
                .fill(palette.onHi.opacity(0.18))
                .frame(width: max(1, s(1)), height: s(50))
                .accessibilityHidden(true)

            highlight(
                value: stats.reviews.formatted(.number.locale(Dates.turkish)),
                unit: "kart",
                label: "KART TEKRARI"
            )
        }
        .padding(.horizontal, s(12))
        .padding(.vertical, s(9))
        .background(
            palette.hi.opacity(palette.isDarkPaper ? 0.95 : 0.54),
            in: RoundedRectangle(cornerRadius: s(9))
        )
    }

    private func highlight(value: String, unit: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: s(1)) {
            HStack(alignment: .firstTextBaseline, spacing: s(4)) {
                ViewThatFits(in: .horizontal) {
                    Text(value).fixedSize()
                    Text(value)
                        .minimumScaleFactor(0.45)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(.system(size: s(39), weight: .black, design: .rounded))
                .monospacedDigit()
                Text(unit)
                    .font(.system(size: s(14), weight: .semibold))
                    .fixedSize()
            }

            Text(label)
                .font(.system(size: s(9), weight: .medium, design: .monospaced))
                .foregroundStyle(palette.onHi.opacity(0.75))
        }
        .foregroundStyle(palette.onHi)
        .lineLimit(1)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var results: some View {
        VStack(spacing: s(9)) {
            resultRow("TEST ORTALAMASI", value: stats.avgQuizScore.map { "%\($0)" } ?? "—")
            resultRow("ÇALIŞMA SERİSİ", value: "\(stats.streak) GÜN")
        }
    }

    private func resultRow(_ label: String, value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .foregroundStyle(palette.inkSoft)
            Spacer(minLength: s(8))
            Text(value)
                .fontWeight(.semibold)
                .foregroundStyle(palette.ink)
        }
        .font(.system(size: s(11), weight: .medium, design: .monospaced))
        .accessibilityElement(children: .combine)
    }

    private var closing: some View {
        HStack(alignment: .center, spacing: s(15)) {
            VStack(alignment: .leading, spacing: s(7)) {
                Text(closingNote)
                    .font(.system(size: s(14), weight: .semibold))
                    .foregroundStyle(palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                ReceiptBarcodeCanvas(seed: stats.barcodeSeed, ink: palette.ink, scale: scale)
                    .frame(width: s(133), height: s(17))
                    .accessibilityHidden(true)

                Text("studymode.fun")
                    .font(.system(size: s(9), weight: .medium, design: .monospaced))
                    .foregroundStyle(palette.inkSoft)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            let stampScale = scale * 1.40
            ReceiptRubberStampView(rank: stats.rank, ink: palette.stamp, scale: stampScale)
                .scaleEffect(1 + stampPulse * 0.06)
                .opacity(stampSlammed ? 1 : 0)
                .rotationEffect(.degrees(-11.5))
                .overlay {
                    ReceiptStampPress(scale: stampScale, motion: stampMotion)
                }
                .padding(.trailing, s(2))
        }
    }

    private var closingNote: String {
        if !cleanMotto.isEmpty { return cleanMotto }
        if stats.effortPoints == 0 { return stats.verdict }
        return stats.period == .gun ? "Bugün de\nmasadaydık." : "Bu hafta da\nmasadaydık."
    }

    private var dashedRule: some View {
        GeometryReader { geo in
            Path { p in
                p.move(to: CGPoint(x: 0, y: geo.size.height / 2))
                p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height / 2))
            }
            .stroke(
                palette.line,
                style: StrokeStyle(lineWidth: max(1, s(1.0)), dash: [s(4), s(3)])
            )
        }
        .frame(height: s(4))
    }
}

// MARK: - Double-Ring Vector Rubber Stamp

struct ReceiptRubberStampView: View {
    let rank: ReceiptRank
    let ink: Color
    var scale: CGFloat = 1.0

    var body: some View {
        VStack(spacing: 0) {
            Text(rank.grade)
                .font(.system(size: 27 * scale, weight: .black, design: .rounded))
            Text(rank.label)
                .font(.system(size: 6.3 * scale, weight: .heavy, design: .monospaced))
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .padding(.horizontal, 6 * scale)
        }
        .foregroundStyle(ink)
        .frame(width: 62 * scale, height: 62 * scale)
        .background {
            Circle().strokeBorder(ink, lineWidth: 1.8 * scale)
            Circle()
                .inset(by: 3.6 * scale)
                .stroke(ink.opacity(0.65), style: StrokeStyle(lineWidth: 0.8 * scale, dash: [5 * scale, 2 * scale]))
        }
        .opacity(0.92)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Deterministic 46-Bar Thermal Barcode

struct ReceiptBarcodeCanvas: View {
    let seed: UInt32
    let ink: Color
    var scale: CGFloat = 1.0

    var body: some View {
        Canvas { context, size in
            var s = seed == 0 ? 0xA53C_9E11 : seed
            var units: [(bar: Bool, w: CGFloat)] = [
                (true, 2), (false, 1), (true, 1), (false, 1) // Start guard
            ]
            for _ in 0..<24 {
                s = s &* 1_664_525 &+ 1_013_904_223
                let barW = CGFloat((s & 3) + 1)
                let gapW = CGFloat(((s >> 3) & 1) + 1)
                units.append((true, barW))
                units.append((false, gapW))
            }
            units.append((bar: true, w: 1))
            units.append((bar: false, w: 1))
            units.append((bar: true, w: 2)) // End guard

            let totalUnits = units.reduce(CGFloat(0)) { $0 + $1.w }
            let unitPx = size.width / max(1, totalUnits)
            var x: CGFloat = 0
            for item in units {
                let w = item.w * unitPx
                if item.bar {
                    let rect = CGRect(x: x, y: 0, width: max(0.8 * scale, w), height: size.height)
                    context.fill(Path(rect), with: .color(ink))
                }
                x += w
            }
        }
    }
}

// MARK: - Subtle Paper Grain Texture

private struct ThermalFiberTexture: View {
    let ink: Color
    let scale: CGFloat
    let isDark: Bool

    var body: some View {
        Canvas { context, size in
            let step = 18 * scale
            let dot = max(0.8, 1.0 * scale)
            let tint = ink.opacity(isDark ? 0.035 : 0.025)
            var row = 0
            var y: CGFloat = step * 0.5
            while y < size.height {
                var x: CGFloat = (row.isMultiple(of: 2) ? 0.35 : 0.85) * step
                while x < size.width {
                    context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: dot, height: dot)), with: .color(tint))
                    x += step
                }
                y += step
                row += 1
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - High-Resolution 1080×1920 Story Poster & Exporter

struct ReceiptStoryPosterView: View {
    let stats: ReceiptStats
    let prefs: ReceiptPrefs

    private var palette: ReceiptPalette { prefs.theme.palette }

    var body: some View {
        ZStack {
            palette.storyBg

            // Stationery grid-paper backdrop
            Canvas { context, size in
                let step: CGFloat = 48
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
                context.stroke(
                    grid,
                    with: .color(palette.ink.opacity(palette.isDarkPaper ? 0.08 : 0.055)),
                    lineWidth: 1.5
                )
            }

            // Soft ambient highlighter glow behind paper
            Circle()
                .fill(
                    RadialGradient(
                        colors: [palette.aura.opacity(palette.isDarkPaper ? 0.26 : 0.32), .clear],
                        center: .center,
                        startRadius: 30,
                        endRadius: 520
                    )
                )
                .frame(width: 1020, height: 1020)
                .offset(y: -40)

            VStack(spacing: 42) {
                Spacer(minLength: 40)

                ZStack(alignment: .top) {
                    ReceiptPaperView(
                        stats: stats,
                        prefs: prefs,
                        scale: 2.52,
                        flatTopEdge: false,
                        stampSlammed: true,
                        stampPulse: 0,
                        glintOffset: 0.15
                    )
                    .shadow(color: .black.opacity(palette.isDarkPaper ? 0.55 : 0.18), radius: 44, x: 0, y: 26)
                    .shadow(color: .black.opacity(0.08), radius: 10, x: 0, y: 6)

                    // Masking tape holding the receipt onto the story canvas
                    RoundedRectangle(cornerRadius: 6)
                        .fill(palette.tape.opacity(palette.isDarkPaper ? 0.85 : 0.78))
                        .frame(width: 230, height: 52)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(palette.ink.opacity(0.16), lineWidth: 1.5)
                        )
                        .rotationEffect(.degrees(2.4))
                        .offset(y: -20)
                }
                .rotationEffect(.degrees(-1.35))

                Spacer(minLength: 24)

                // Story footer pill
                HStack(spacing: 14) {
                    Circle()
                        .fill(palette.hi)
                        .frame(width: 16, height: 16)
                    Text("studymode.fun · ÇALIŞMA FİŞİNİ KES")
                        .font(.system(size: 23, weight: .heavy, design: .monospaced))
                        .tracking(1.4)
                        .foregroundStyle(palette.ink)
                }
                .padding(.horizontal, 34)
                .padding(.vertical, 16)
                .background(
                    Capsule()
                        .fill(palette.paper.opacity(0.92))
                        .overlay(Capsule().stroke(palette.line, lineWidth: 2))
                )
                .padding(.bottom, 74)
            }
        }
        .frame(width: 1080, height: 1920)
    }
}

@MainActor
enum ReceiptExporter {
    static func renderStoryImage(stats: ReceiptStats, prefs: ReceiptPrefs) -> UIImage? {
        let view = ReceiptStoryPosterView(stats: stats, prefs: prefs)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1.0
        renderer.isOpaque = true
        return renderer.uiImage
    }
}
