import SwiftUI
import UIKit

/// The printer lives in the studio; the shareable receipt stays a separate rendering.
struct ReceiptPrinterView: View {
    let width: CGFloat
    let status: Status

    enum Status {
        case feeding, stamping, ready

        var label: String {
            switch self {
            case .feeding: "YAZDIRILIYOR…"
            case .stamping: "DAMGALANIYOR…"
            case .ready: "FİŞ HAZIR"
            }
        }

        var light: Color {
            self == .ready ? printerColor(0x80F0B8) : Theme.hi
        }
    }

    var body: some View {
        VStack(spacing: -1) {
            ZStack(alignment: .bottomLeading) {
                printerLid
                    .frame(height: 34)
                FosforMascotView(
                    size: 54,
                    mood: status == .ready ? .proud : .curious,
                    onDark: true,
                    tappable: false
                )
                .offset(x: width * 0.085, y: -3)
            }
            .frame(height: 61, alignment: .bottom)

            HStack(spacing: 7) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(status.light)
                        .frame(width: 6, height: 6)
                        .shadow(color: status.light.opacity(0.7), radius: 3)

                    Text(status.label)
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .foregroundStyle(status.light)
                        .lineLimit(1)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(printerColor(0x19234E), in: RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).strokeBorder(printerColor(0x697BB2).opacity(0.65)))

                Spacer(minLength: 5)

                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 74)
                    .environment(\.colorScheme, .dark)
            }
            .padding(.horizontal, 12)
            .frame(height: 42)
            .padding(.bottom, 8)
            .background {
                RoundedRectangle(cornerRadius: 13)
                    .fill(
                        LinearGradient(
                            colors: [printerColor(0x5163A2), printerColor(0x2C3D78), printerColor(0x202A5F)],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: printerColor(0x090D2B).opacity(0.65), radius: 8, y: 5)
            }
            .overlay(alignment: .bottom) {
                Capsule()
                    .fill(printerColor(0x090E2D))
                    .overlay(alignment: .bottom) {
                        Capsule()
                            .fill(printerColor(0x7186BF).opacity(0.7))
                            .frame(height: 1)
                            .padding(.horizontal, 3)
                    }
                    .frame(height: 6)
                    .padding(.horizontal, 10)
                    .padding(.bottom, 3)
            }
        }
        .frame(width: width)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(status.label)
    }

    private var printerLid: some View {
        Canvas { context, size in
            let w = size.width
            let h = size.height
            let outline = Path { path in
                path.move(to: CGPoint(x: 2, y: h))
                path.addLine(to: CGPoint(x: w * 0.11, y: 2))
                path.addQuadCurve(to: CGPoint(x: w * 0.13, y: 0), control: CGPoint(x: w * 0.12, y: 0))
                path.addLine(to: CGPoint(x: w * 0.87, y: 0))
                path.addQuadCurve(to: CGPoint(x: w * 0.89, y: 2), control: CGPoint(x: w * 0.88, y: 0))
                path.addLine(to: CGPoint(x: w - 2, y: h))
                path.closeSubpath()
            }
            context.fill(outline, with: .linearGradient(
                Gradient(colors: [printerColor(0x8495CA), printerColor(0x5265A4), printerColor(0x3D4F89)]),
                startPoint: .zero, endPoint: CGPoint(x: w, y: h)
            ))
            let panel = Path { path in
                path.move(to: CGPoint(x: w * 0.13, y: h * 0.67))
                path.addLine(to: CGPoint(x: w * 0.18, y: h * 0.18))
                path.addLine(to: CGPoint(x: w * 0.82, y: h * 0.18))
                path.addLine(to: CGPoint(x: w * 0.87, y: h * 0.67))
                path.closeSubpath()
            }
            context.fill(panel, with: .color(printerColor(0x34477F).opacity(0.46)))
            context.stroke(panel, with: .color(printerColor(0xA6B5E5).opacity(0.48)), lineWidth: 0.8)
            let vents = Path { path in
                for index in 0..<5 {
                    let x = w * 0.73 + CGFloat(index) * 5
                    path.move(to: CGPoint(x: x, y: h * 0.31))
                    path.addLine(to: CGPoint(x: x + 2, y: h * 0.52))
                }
            }
            context.stroke(vents, with: .color(printerColor(0x233269)), style: StrokeStyle(lineWidth: 1.1, lineCap: .round))
        }
    }
}

struct ReceiptPrinterDesk: View {
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 22)
        Canvas { context, size in
            let grid = Path { path in
                for x in stride(from: 13.0, to: size.width, by: 22) {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                }
                for y in stride(from: 14.0, to: size.height, by: 22) {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                }
            }
            context.stroke(grid, with: .color(.white.opacity(0.07)), lineWidth: 0.8)
        }
        .background {
            shape.fill(
                RadialGradient(
                    colors: [printerColor(0x3D4979), printerColor(0x222A55), printerColor(0x151A38)],
                    center: .top, startRadius: 16, endRadius: 390
                )
            )
        }
        .clipShape(shape)
        .accessibilityHidden(true)
    }
}

enum ReceiptStampMotion {
    case hidden, hovering, contact, retreating

    var visible: Bool { self == .hovering || self == .contact }

    var x: CGFloat {
        switch self {
        case .hidden: 36
        case .hovering: 7
        case .contact: 0
        case .retreating: 44
        }
    }

    var y: CGFloat {
        switch self {
        case .hidden: -112
        case .hovering: -48
        case .contact: 0
        case .retreating: -97
        }
    }

    var angle: Double {
        switch self {
        case .hidden: 14
        case .hovering: -16
        case .contact: -10
        case .retreating: 17
        }
    }
}

/// The rubber base is centred on the receipt's ink impression.
struct ReceiptStampPress: View {
    let scale: CGFloat
    let motion: ReceiptStampMotion

    var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 6 * scale)
                .fill(
                    LinearGradient(
                        colors: [printerColor(0x6B7DB8), printerColor(0x293763)],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .frame(width: 63 * scale, height: 17 * scale)
                .overlay(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: 2.5 * scale)
                        .fill(printerColor(0x121A39))
                        .frame(height: 5 * scale)
                        .padding(.horizontal, 3 * scale)
                }

            RoundedRectangle(cornerRadius: 6 * scale)
                .fill(LinearGradient(colors: [Theme.hi, printerColor(0xD49B38)], startPoint: .leading, endPoint: .trailing))
                .frame(width: 19 * scale, height: 32 * scale)
                .padding(.bottom, 17 * scale)

            Capsule()
                .fill(LinearGradient(colors: [printerColor(0xFFF297), Theme.hi, printerColor(0xE8AE46)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .overlay(alignment: .topLeading) {
                    Capsule()
                        .fill(.white.opacity(0.58))
                        .frame(width: 23 * scale, height: 1.5 * scale)
                        .padding(.top, 5 * scale)
                        .padding(.leading, 11 * scale)
                }
                .frame(width: 51 * scale, height: 24 * scale)
                .padding(.bottom, 39 * scale)
        }
        .frame(width: 64 * scale, height: 64 * scale, alignment: .bottom)
        .rotationEffect(.degrees(motion.angle), anchor: .bottom)
        .offset(x: motion.x * scale, y: (motion.y - 27) * scale)
        .opacity(motion.visible ? 1 : 0)
        .shadow(color: .black.opacity(motion == .contact ? 0.22 : 0.13), radius: 5 * scale, x: 3 * scale, y: 4 * scale)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private func printerColor(_ hex: UInt32) -> Color {
    Color(uiColor: UIColor(hex: hex))
}
