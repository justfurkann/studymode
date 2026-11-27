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
            headerSection
            perforatedTearLine
            metaLedgerSection
            dashedRule
            heroMetricsSection
            dashedRule
            coursesLedgerSection
            dashedRule
            weekRhythmSection
            dashedRule
            totalsAndStampSection
            if !cleanMotto.isEmpty {
                mottoBanner
            }
            barcodeFooterSection
        }
        .padding(.horizontal, s(20))
        .padding(.top, flatTopEdge ? s(16) : s(22))
        .padding(.bottom, s(22))
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
                                .init(color: .white.opacity(palette.isDarkPaper ? 0.07 : 0.34), location: 0.45),
                                .init(color: palette.hi.opacity(palette.isDarkPaper ? 0.14 : 0.22), location: 0.52),
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

    // MARK: - 1. Brand Header

    private var headerSection: some View {
        VStack(spacing: s(5)) {
            Image("Logo")
                .resizable()
                .scaledToFit()
                .frame(height: s(26))
                .environment(\.colorScheme, palette.isDarkPaper ? .dark : .light)
                .accessibilityHidden(true)

            HStack(spacing: s(6)) {
                Text("ÇALIŞMA FİŞİ")
                    .font(.system(size: s(9.5), weight: .heavy, design: .monospaced))
                    .tracking(s(1.4))
                Text("·")
                    .font(.system(size: s(9.5), weight: .bold, design: .monospaced))
                Text(stats.registerTag)
                    .font(.system(size: s(9.5), weight: .bold, design: .monospaced))
            }
            .foregroundStyle(palette.inkSoft)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - 2. Perforated Tear Line

    private var perforatedTearLine: some View {
        HStack(spacing: s(6)) {
            Image(systemName: "scissors")
                .font(.system(size: s(9), weight: .bold))
                .foregroundStyle(palette.inkSoft.opacity(0.75))
            GeometryReader { geo in
                Path { p in
                    p.move(to: CGPoint(x: 0, y: geo.size.height / 2))
                    p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height / 2))
                }
                .stroke(
                    palette.line,
                    style: StrokeStyle(lineWidth: max(1, s(1.1)), dash: [s(4.5), s(3.5)])
                )
            }
            .frame(height: s(10))
        }
    }

    // MARK: - 3. Meta Ledger

    private var metaLedgerSection: some View {
        VStack(spacing: s(4)) {
            ledgerMetaRow(left: "FİŞ NO", right: stats.receiptNo)
            ledgerMetaRow(left: "TARİH", right: "\(stats.dateLabel) · \(stats.timeLabel)")
            ledgerMetaRow(left: "DÖNEM", right: stats.period.ledgerTitle)
            if !cleanName.isEmpty {
                ledgerMetaRow(left: "ÖĞRENCİ", right: cleanName.uppercased(with: Dates.turkish))
            }
            if !cleanTag.isEmpty {
                ledgerMetaRow(left: "BÖLÜM", right: cleanTag)
            }
        }
    }

    private func ledgerMetaRow(left: String, right: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: s(8)) {
            Text(left)
                .font(.system(size: s(9.5), weight: .semibold, design: .monospaced))
                .foregroundStyle(palette.inkSoft)
            Spacer(minLength: s(6))
            Text(right)
                .font(.system(size: s(10), weight: .bold, design: .monospaced))
                .foregroundStyle(palette.ink)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    // MARK: - 4. Hero Metric Boxes

    private var heroMetricsSection: some View {
        HStack(spacing: s(8)) {
            heroMetricBox(
                kicker: "ODAK SÜRESİ",
                value: stats.focusFormatted,
                sub: stats.focusSubtext,
                emphasize: stats.focusMinutes > 0
            )
            heroMetricBox(
                kicker: "KART TEKRARI",
                value: "\(stats.reviews)",
                sub: stats.reviewSubtext,
                emphasize: stats.reviews > 0
            )
        }
    }

    private func heroMetricBox(kicker: String, value: String, sub: String, emphasize: Bool) -> some View {
        VStack(alignment: .leading, spacing: s(4)) {
            Text(kicker)
                .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                .tracking(s(0.7))
                .foregroundStyle(palette.inkSoft)

            Text(value)
                .font(.system(size: s(22), weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .padding(.horizontal, s(2))
                .background(alignment: .bottom) {
                    if emphasize {
                        RoundedRectangle(cornerRadius: s(3))
                            .fill(palette.hi.opacity(palette.isDarkPaper ? 0.34 : 0.88))
                            .frame(height: s(8.5))
                            .offset(y: -s(1.5))
                    }
                }

            Text(sub)
                .font(.system(size: s(9), weight: .semibold, design: .monospaced))
                .foregroundStyle(palette.inkSoft)
                .lineLimit(1)
        }
        .padding(.horizontal, s(10))
        .padding(.vertical, s(9))
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: s(8))
                .stroke(palette.line, lineWidth: max(1, s(1.1)))
        )
    }

    // MARK: - 5. Itemized Courses Ledger (Privacy-safe: course names & counts only)

    private var coursesLedgerSection: some View {
        let shown = Array(stats.byCourse.prefix(4))
        let overflow = max(0, stats.byCourse.count - shown.count)

        return VStack(alignment: .leading, spacing: s(6)) {
            HStack {
                Text("KALEMLER · ÇALIŞILAN DERSLER")
                    .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                    .tracking(s(0.8))
                    .foregroundStyle(palette.inkSoft)
                Spacer()
                Text("TUTAR")
                    .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                    .foregroundStyle(palette.inkSoft)
            }

            if shown.isEmpty {
                HStack(spacing: s(6)) {
                    Text("01")
                        .font(.system(size: s(9.5), weight: .bold, design: .monospaced))
                        .foregroundStyle(palette.inkSoft)
                    Text("SESSİZ MASA AÇILIŞI")
                        .font(.system(size: s(10.5), weight: .semibold, design: .monospaced))
                        .foregroundStyle(palette.inkSoft)
                        .lineLimit(1)
                    Spacer(minLength: s(4))
                    Text("0 KART")
                        .font(.system(size: s(9.5), weight: .bold, design: .monospaced))
                        .foregroundStyle(palette.inkSoft)
                }
            } else {
                ForEach(Array(shown.enumerated()), id: \.element.id) { idx, item in
                    HStack(spacing: s(6)) {
                        Text(String(format: "%02d", idx + 1))
                            .font(.system(size: s(9), weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.inkSoft)

                        Circle()
                            .fill(item.tint)
                            .frame(width: s(6.5), height: s(6.5))

                        Text(item.name.uppercased(with: Dates.turkish))
                            .font(.system(size: s(10.5), weight: .bold, design: .rounded))
                            .foregroundStyle(palette.ink)
                            .lineLimit(1)
                            .truncationMode(.tail)

                        Spacer(minLength: s(4))

                        Text(item.activitySummary)
                            .font(.system(size: s(9.5), weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.ink)
                            .fixedSize()
                    }
                }

                if overflow > 0 {
                    Text("+ \(overflow) DERS DAHA İŞLENDİ")
                        .font(.system(size: s(9), weight: .semibold, design: .monospaced))
                        .foregroundStyle(palette.inkSoft)
                }
            }
        }
    }

    // MARK: - 6. 7-Day Thermal Rhythm Matrix

    private var weekRhythmSection: some View {
        VStack(alignment: .leading, spacing: s(5)) {
            HStack {
                Text("HAFTALIK RİTİM")
                    .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                    .tracking(s(0.8))
                    .foregroundStyle(palette.inkSoft)
                Spacer()
                Text(stats.streak > 0 ? "SERİ: \(stats.streak) GÜN" : "AKTİF: \(stats.activeDays)/7 GÜN")
                    .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                    .foregroundStyle(palette.ink)
            }

            HStack(spacing: s(5)) {
                ForEach(stats.weekDots) { dot in
                    VStack(spacing: s(3)) {
                        ZStack {
                            RoundedRectangle(cornerRadius: s(3.5))
                                .fill(dot.studied ? palette.hi : palette.line.opacity(0.32))
                                .frame(height: s(15))
                                .overlay(
                                    RoundedRectangle(cornerRadius: s(3.5))
                                        .stroke(
                                            dot.studied ? palette.ink.opacity(0.65) : (dot.isToday ? palette.inkSoft : palette.line),
                                            lineWidth: max(0.8, s(dot.isToday ? 1.3 : 0.9))
                                        )
                                )
                            if dot.studied {
                                HStack(spacing: s(1.5)) {
                                    ForEach(0..<dot.level, id: \.self) { _ in
                                        Circle()
                                            .fill(palette.onHi)
                                            .frame(width: s(3.2), height: s(3.2))
                                    }
                                }
                            }
                        }
                        Text(dot.shortLabel)
                            .font(.system(size: s(8), weight: dot.isToday ? .heavy : .semibold, design: .monospaced))
                            .foregroundStyle(dot.isToday ? palette.ink : palette.inkSoft)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - 7. Totals, Verdict & Rubber Stamp

    private var totalsAndStampSection: some View {
        HStack(alignment: .center, spacing: s(10)) {
            VStack(alignment: .leading, spacing: s(6)) {
                HStack(spacing: s(5)) {
                    Text("\(stats.effortPoints) PUAN")
                        .font(.system(size: s(9.5), weight: .heavy, design: .monospaced))
                        .foregroundStyle(palette.onHi)
                        .fixedSize()
                        .padding(.horizontal, s(6.5))
                        .padding(.vertical, s(3))
                        .background(palette.hi, in: RoundedRectangle(cornerRadius: s(4)))

                    if let avg = stats.avgQuizScore {
                        Text("ORT. %\(avg)")
                            .font(.system(size: s(9), weight: .bold, design: .monospaced))
                            .foregroundStyle(palette.ink)
                            .fixedSize()
                            .padding(.horizontal, s(6))
                            .padding(.vertical, s(2.5))
                            .overlay(
                                RoundedRectangle(cornerRadius: s(4))
                                    .stroke(palette.line, lineWidth: max(1, s(1)))
                            )
                    }
                }

                Text(stats.verdict)
                    .font(.system(size: s(10.5), weight: .semibold, design: .rounded))
                    .foregroundStyle(palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            ReceiptRubberStampView(
                rank: stats.rank,
                ink: palette.stamp,
                scale: scale
            )
            .scaleEffect(stampSlammed ? (1.0 + stampPulse * 0.06) : 2.15)
            .opacity(stampSlammed ? 1.0 : 0.0)
            .rotationEffect(.degrees(stampSlammed ? -9.5 : -24))
            .padding(.trailing, s(2))
        }
        .padding(.vertical, s(2))
    }

    // MARK: - 8. Personal Motto Strip

    private var mottoBanner: some View {
        HStack(spacing: s(6)) {
            Rectangle()
                .fill(palette.hi)
                .frame(width: s(3.5))
            Text("“\(cleanMotto)”")
                .font(.system(size: s(10), weight: .semibold, design: .rounded).italic())
                .foregroundStyle(palette.inkSoft)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, s(3))
    }

    // MARK: - 9. Deterministic Barcode & Footer

    private var barcodeFooterSection: some View {
        VStack(spacing: s(5)) {
            ReceiptBarcodeCanvas(seed: stats.barcodeSeed, ink: palette.ink, scale: scale)
                .frame(height: s(32))
                .padding(.horizontal, s(8))

            Text(stats.serialCode)
                .font(.system(size: s(8), weight: .semibold, design: .monospaced))
                .foregroundStyle(palette.inkSoft)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text("studymode.fun · İYİ ÇALIŞMALAR DİLERİZ")
                .font(.system(size: s(8.5), weight: .heavy, design: .monospaced))
                .tracking(s(0.6))
                .foregroundStyle(palette.ink)
                .padding(.top, s(1))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, s(2))
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

    private func s(_ v: CGFloat) -> CGFloat { v * scale }

    var body: some View {
        VStack(spacing: s(1)) {
            Text("DERECE · \(rank.grade)")
                .font(.system(size: s(11.5), weight: .black, design: .rounded))
                .tracking(s(0.6))
            Text(rank.label)
                .font(.system(size: s(7.5), weight: .heavy, design: .monospaced))
                .tracking(s(0.5))
        }
        .foregroundStyle(ink)
        .padding(.horizontal, s(8))
        .padding(.vertical, s(5))
        .overlay(
            RoundedRectangle(cornerRadius: s(6))
                .stroke(ink, lineWidth: max(1.5, s(2.0)))
        )
        .overlay(
            RoundedRectangle(cornerRadius: s(4))
                .inset(by: s(2.8))
                .stroke(ink.opacity(0.55), style: StrokeStyle(lineWidth: max(0.8, s(0.9)), dash: [s(5), s(2)]))
        )
        .opacity(0.92)
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
