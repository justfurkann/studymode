import SwiftUI
@preconcurrency import SceneKit
import UIKit

/// The 3D Fosfor, only for the big hero at the top of the Fosfor tab. Everywhere else the flat
/// `FosforMascotView` stays. Built from the same 64-unit drawing as the 2D one
/// (x3 = x - 32, y3 = 64 - y), each part extruded with rounded edges and an ink outline,
/// so it reads as the same sticker character, just with depth.
struct Fosfor3DView: UIViewRepresentable {
    var mood: FosforMascotView.Mood = .curious
    var onTap: () -> Void = {}

    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero)
        view.backgroundColor = .clear
        view.antialiasingMode = .multisampling4X
        view.preferredFramesPerSecond = 60
        view.rendersContinuously = false
        view.isPlaying = true

        let c = context.coordinator
        c.build(dark: scheme == .dark)
        view.scene = c.scene
        view.pointOfView = c.cameraNode

        let tap = UITapGestureRecognizer(target: c, action: #selector(Coordinator.tapped(_:)))
        let pan = UIPanGestureRecognizer(target: c, action: #selector(Coordinator.panned(_:)))
        view.addGestureRecognizer(tap)
        view.addGestureRecognizer(pan)

        c.onTap = onTap
        c.apply(mood: mood, animated: false)
        c.setMotion(enabled: !reduceMotion)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {
        let c = context.coordinator
        c.onTap = onTap
        c.setDark(scheme == .dark)
        c.apply(mood: mood, animated: true)
        c.setMotion(enabled: !reduceMotion)
    }

    static func dismantleUIView(_ view: SCNView, coordinator: Coordinator) {
        view.isPlaying = false
        view.scene = nil
    }

    // MARK: - Scene

    @MainActor
    final class Coordinator: NSObject {
        let scene = SCNScene()
        let cameraNode = SCNNode()
        var onTap: () -> Void = {}

        private let root = SCNNode()      // float + sway + drag yaw
        private let squash = SCNNode()    // hop squash/stretch, pivot at the feet
        private var eyes: [SCNNode] = []
        private var sparks: [SCNNode] = []
        private var happyEyes = SCNNode()
        private var smile = SCNNode()
        private var bigSmile = SCNNode()
        private var oMouth = SCNNode()
        private var mood: FosforMascotView.Mood?
        private var motionOn: Bool?
        private var dark: Bool?
        private var dragYaw: Float = 0

        private let yellowMat = Coordinator.toon(UIColor(hex: 0xFFE14D))
        private let capMat = Coordinator.toon(UIColor(hex: 0x1B2250))
        private let inkFaceMat = Coordinator.toon(UIColor(hex: 0x1B2250))
        private let outlineMat = Coordinator.outlineMaterial()
        private var hullMats: [SCNMaterial] = []

        func build(dark: Bool) {
            scene.background.contents = UIColor.clear

            // Camera: small field of view so the character keeps its proportions.
            let camera = SCNCamera()
            camera.fieldOfView = 30
            camera.zNear = 1
            camera.zFar = 600
            cameraNode.camera = camera
            cameraNode.position = SCNVector3(26, 46, 128)
            cameraNode.look(at: SCNVector3(0, 31, 0))
            scene.rootNode.addChildNode(cameraNode)

            // Light: soft fill + one key light that casts the shadow on the paper.
            let ambient = SCNNode()
            ambient.light = SCNLight()
            ambient.light?.type = .ambient
            ambient.light?.intensity = 380
            scene.rootNode.addChildNode(ambient)

            let key = SCNNode()
            let keyLight = SCNLight()
            keyLight.type = .directional
            keyLight.intensity = 760
            keyLight.castsShadow = true
            keyLight.shadowMode = .deferred
            keyLight.shadowRadius = 6
            keyLight.shadowSampleCount = 16
            keyLight.shadowColor = UIColor(hex: 0x1B2250).withAlphaComponent(0.22)
            keyLight.orthographicScale = 60
            keyLight.automaticallyAdjustsShadowProjection = true
            key.light = keyLight
            key.position = SCNVector3(40, 90, 60)
            key.look(at: SCNVector3(0, 0, 0))
            scene.rootNode.addChildNode(key)

            // Paper floor that only shows the shadow.
            let floor = SCNNode(geometry: SCNPlane(width: 160, height: 160))
            let floorMat = SCNMaterial()
            floorMat.lightingModel = .shadowOnly
            floor.geometry?.firstMaterial = floorMat
            floor.eulerAngles.x = -.pi / 2
            floor.position.y = -2
            scene.rootNode.addChildNode(floor)

            root.addChildNode(squash)
            scene.rootNode.addChildNode(root)

            buildBody()
            buildFace()
            setDark(dark)
        }

        private func buildBody() {
            // Highlighter body.
            let body = part(Coordinator.roundedRect(w: 34, h: 42, r: 13), depth: 27, chamfer: 5, mat: yellowMat, outline: 0.75)
            body.position.y = 26
            squash.addChildNode(body)

            // Cap collar.
            let collar = part(Coordinator.roundedRect(w: 25, h: 8, r: 3), depth: 19, chamfer: 2, mat: capMat, outline: 0.5)
            collar.position.y = 48.5
            squash.addChildNode(collar)

            // Chisel tip with its slanted top.
            let tip = UIBezierPath()
            tip.move(to: CGPoint(x: -10.8, y: 0))
            tip.addLine(to: CGPoint(x: 10.8, y: 0))
            tip.addLine(to: CGPoint(x: 8.0, y: 6.6))
            tip.addQuadCurve(to: CGPoint(x: 5.2, y: 8.2), controlPoint: CGPoint(x: 7.2, y: 8.0))
            tip.addLine(to: CGPoint(x: -5.0, y: 9.8))
            tip.addQuadCurve(to: CGPoint(x: -7.6, y: 8.4), controlPoint: CGPoint(x: -7.2, y: 10.0))
            tip.close()
            let tipNode = part(tip, depth: 11, chamfer: 1.4, mat: capMat, outline: 0.5)
            tipNode.position.y = 50.5
            squash.addChildNode(tipNode)
        }

        private func buildFace() {
            let face = SCNNode()
            face.position.z = 13.55
            squash.addChildNode(face)

            // Glossy shine strip.
            let shine = flatPart(Coordinator.roundedRect(w: 4.5, h: 13, r: 2.25), mat: Coordinator.flat(UIColor.white.withAlphaComponent(0.72)))
            shine.position = SCNVector3(-9.3, 34.5, 0)
            face.addChildNode(shine)

            // Eyes with a white spark.
            for x: Float in [-5, 5] {
                let eye = SCNNode()
                let sphere = SCNSphere(radius: 1)
                sphere.segmentCount = 36
                sphere.firstMaterial = inkFaceMat
                let ball = SCNNode(geometry: sphere)
                ball.scale = SCNVector3(2.9, 3.7, 1.4)
                ball.name = "ball"
                let spark = SCNNode(geometry: SCNSphere(radius: 1.05))
                spark.geometry?.firstMaterial = Coordinator.flat(.white)
                spark.position = SCNVector3(1.05, 1.25, 1.25)
                spark.name = "spark"
                eye.addChildNode(ball)
                eye.addChildNode(spark)
                eye.position = SCNVector3(x, 27, 0)
                face.addChildNode(eye)
                eyes.append(eye)
            }

            // Happy ^ ^ eyes for cheering.
            happyEyes = SCNNode()
            happyEyes.addChildNode(stroke(from: CGPoint(x: -7.8, y: 25.8), control: CGPoint(x: -5, y: 30.6), to: CGPoint(x: -2.2, y: 25.8), width: 2.7))
            happyEyes.addChildNode(stroke(from: CGPoint(x: 2.2, y: 25.8), control: CGPoint(x: 5, y: 30.6), to: CGPoint(x: 7.8, y: 25.8), width: 2.7))
            face.addChildNode(happyEyes)

            // Rosy cheeks.
            for x: CGFloat in [-9.5, 9.5] {
                let cheek = flatPart(UIBezierPath(ovalIn: CGRect(x: x - 3.1, y: 19.8 - 1.9, width: 6.2, height: 3.8)),
                                     mat: Coordinator.flat(UIColor(hex: 0xF59A8B).withAlphaComponent(0.8)))
                face.addChildNode(cheek)
            }

            // Mouths.
            smile = stroke(from: CGPoint(x: -4.4, y: 20), control: CGPoint(x: 0, y: 15.2), to: CGPoint(x: 4.4, y: 20), width: 2.6)
            bigSmile = stroke(from: CGPoint(x: -4.6, y: 20), control: CGPoint(x: 0, y: 13.0), to: CGPoint(x: 4.6, y: 20), width: 2.6)
            let torus = SCNTorus(ringRadius: 1.7, pipeRadius: 1.0)
            torus.firstMaterial = inkFaceMat
            oMouth = SCNNode(geometry: torus)
            oMouth.eulerAngles.x = .pi / 2
            oMouth.position = SCNVector3(0.2, 18.3, 0.3)
            face.addChildNode(smile)
            face.addChildNode(bigSmile)
            face.addChildNode(oMouth)
        }

        // MARK: Mood, colors, motion

        func apply(mood new: FosforMascotView.Mood, animated: Bool) {
            guard new != mood else { return }
            let first = mood == nil
            mood = new
            let shift: Float = switch new {
            case .marking: -1.2
            case .proud: 0.8
            case .thinking: 1.4
            default: 0
            }
            let lift: Float = new == .thinking ? 1.7 : 0
            for (i, eye) in eyes.enumerated() {
                let target = SCNVector3((i == 0 ? -5 : 5) + shift, 27 + lift, 0)
                if animated {
                    let move = SCNAction.move(to: target, duration: 0.25)
                    move.timingMode = .easeOut
                    eye.runAction(move)
                } else {
                    eye.position = target
                }
                eye.isHidden = new == .cheering
            }
            happyEyes.isHidden = new != .cheering
            smile.isHidden = !(new == .curious || new == .marking)
            bigSmile.isHidden = !(new == .proud || new == .cheering)
            oMouth.isHidden = new != .thinking
            if !first, animated, motionOn == true, new != .thinking { hop() }
        }

        func setDark(_ isDark: Bool) {
            guard isDark != dark else { return }
            dark = isDark
            capMat.diffuse.contents = UIColor(hex: isDark ? 0x4A5291 : 0x1B2250)
            let ink = UIColor(hex: isDark ? 0x05060F : 0x1B2250)
            inkFaceMat.diffuse.contents = ink
            outlineMat.diffuse.contents = ink
            hullMats.forEach { $0.diffuse.contents = ink }
        }

        func setMotion(enabled: Bool) {
            guard enabled != motionOn else { return }
            motionOn = enabled
            root.removeAllActions()
            eyes.forEach { $0.childNode(withName: "ball", recursively: false)?.removeAllActions() }
            root.position = SCNVector3Zero
            root.eulerAngles = SCNVector3Zero
            guard enabled else { return }

            // Breathing float.
            let up = SCNAction.moveBy(x: 0, y: 2.2, z: 0, duration: 2.1)
            up.timingMode = .easeInEaseOut
            root.runAction(.repeatForever(.sequence([up, up.reversed()])), forKey: "float")

            // Gentle sway so the depth shows without touching it.
            let swayL = SCNAction.rotateTo(x: 0, y: -0.22, z: 0.02, duration: 3.2, usesShortestUnitArc: true)
            swayL.timingMode = .easeInEaseOut
            let swayR = SCNAction.rotateTo(x: 0, y: 0.22, z: -0.02, duration: 3.2, usesShortestUnitArc: true)
            swayR.timingMode = .easeInEaseOut
            root.runAction(.repeatForever(.sequence([swayR, swayL])), forKey: "sway")

            scheduleBlink()
        }

        private func scheduleBlink() {
            let wait = SCNAction.wait(duration: Double.random(in: 2.6...4.4))
            // SceneKit runs actions on its render thread: capture only nodes, hop back to main to re-arm.
            let balls = eyes.compactMap { $0.childNode(withName: "ball", recursively: false) }
            let glints = eyes.compactMap { $0.childNode(withName: "spark", recursively: false) }
            let blink = SCNAction.customAction(duration: 0.2) { _, t in
                let k = t < 0.08 ? 1 - t / 0.08 : (t - 0.08) / 0.12
                let open = max(0.08, min(1, Float(k)))
                balls.forEach { $0.scale.y = 3.7 * open }
                glints.forEach { $0.isHidden = open < 0.6 }
            }
            let again = SCNAction.run { [weak self] _ in
                DispatchQueue.main.async { self?.scheduleBlink() }
            }
            root.runAction(.sequence([wait, blink, again]), forKey: "blink")
        }

        // MARK: Touch

        @objc func tapped(_ g: UITapGestureRecognizer) {
            guard let view = g.view as? SCNView else { return }
            let hits = view.hitTest(g.location(in: view), options: [.searchMode: SCNHitTestSearchMode.any.rawValue])
            guard !hits.isEmpty else { return }
            OnboardingHaptics.light()
            if motionOn == true { hop() }
            onTap()
        }

        @objc func panned(_ g: UIPanGestureRecognizer) {
            guard let view = g.view else { return }
            switch g.state {
            case .began:
                root.removeAction(forKey: "sway")
                dragYaw = root.eulerAngles.y
            case .changed:
                let dx = Float(g.translation(in: view).x)
                root.eulerAngles.y = dragYaw + dx * 0.012
            default:
                let back = SCNAction.rotateTo(x: 0, y: 0, z: 0, duration: 0.6, usesShortestUnitArc: true)
                back.timingMode = .easeOut
                root.runAction(back) { [weak self] in
                    DispatchQueue.main.async {
                        guard let self, self.motionOn == true else { return }
                        self.motionOn = nil
                        self.setMotion(enabled: true)
                    }
                }
            }
        }

        private func hop() {
            squash.removeAction(forKey: "hop")
            squash.scale = SCNVector3(1, 1, 1)
            squash.position = SCNVector3Zero
            squash.eulerAngles = SCNVector3Zero
            let hop = SCNAction.customAction(duration: 0.55) { node, elapsed in
                let p = Float(elapsed / 0.55)
                var sx: Float = 1, sy: Float = 1, y: Float = 0, tilt: Float = 0
                if p < 0.15 {
                    let k = p / 0.15; sx = 1 + 0.12 * k; sy = 1 - 0.14 * k
                } else if p < 0.6 {
                    let k = (p - 0.15) / 0.45
                    y = sin(k * .pi) * 12; sx = 0.92 + 0.08 * k; sy = 1.1 - 0.1 * k
                    tilt = sin(k * .pi * 2) * 0.15
                } else if p < 1 {
                    let b = sin((p - 0.6) / 0.4 * .pi); sx = 1 + 0.1 * b; sy = 1 - 0.1 * b
                }
                node.scale = SCNVector3(sx, sy, sx)
                node.position = SCNVector3(0, y, 0)
                node.eulerAngles.z = tilt
            }
            let reset = SCNAction.run { node in
                node.scale = SCNVector3(1, 1, 1); node.position = SCNVector3Zero; node.eulerAngles = SCNVector3Zero
            }
            squash.runAction(.sequence([hop, reset]), forKey: "hop")
            burst()
        }

        /// Highlighter and ink bits flying out, like the 2D `HighlighterSparkBurst`.
        private func burst() {
            sparks.forEach { $0.removeFromParentNode() }
            sparks.removeAll()
            let angles: [Float] = [-155, -125, -95, -65, -35, -10, 195, 15]
            for (i, a) in angles.enumerated() {
                let box = SCNBox(width: 3.2, height: 1.6, length: 0.8, chamferRadius: 0.5)
                let mat = Coordinator.flat(i % 3 == 1 ? UIColor(hex: 0x1B2250) : UIColor(hex: 0xFFE14D))
                box.firstMaterial = mat
                let n = SCNNode(geometry: box)
                let rad = -a * .pi / 180
                let dist: Float = 16 + Float(i % 2) * 6
                n.position = SCNVector3(0, 38, 6)
                n.eulerAngles.z = rad
                scene.rootNode.addChildNode(n)
                sparks.append(n)
                let fly = SCNAction.move(by: SCNVector3(cos(rad) * dist, sin(rad) * dist, Float.random(in: -3...3)), duration: 0.62)
                fly.timingMode = .easeOut
                let spin = SCNAction.rotateBy(x: 0, y: 0, z: 1.2, duration: 0.62)
                let shrink = SCNAction.scale(to: 0.55, duration: 0.62)
                let fade = SCNAction.fadeOut(duration: 0.62)
                n.runAction(.sequence([.group([fly, spin, shrink, fade]), .removeFromParentNode()]))
            }
        }

        // MARK: Builders

        /// Extruded part with rounded front/back edges plus its ink outline.
        private func part(_ path: UIBezierPath, depth: CGFloat, chamfer: CGFloat, mat: SCNMaterial, outline: Float) -> SCNNode {
            path.flatness = 0.4
            let shape = SCNShape(path: path, extrusionDepth: depth)
            shape.chamferRadius = chamfer
            shape.chamferProfile = Coordinator.roundProfile
            shape.chamferMode = .both
            shape.materials = [mat]
            let node = SCNNode(geometry: shape)
            node.castsShadow = true

            let hull = SCNNode(geometry: shape.copy() as? SCNGeometry)
            let m = outlineMat.copy() as! SCNMaterial
            m.shaderModifiers = [.geometry: "_geometry.position.xyz += _geometry.normal * \(outline);"]
            hullMats.append(m)
            hull.geometry?.materials = [m]
            hull.castsShadow = false
            node.addChildNode(hull)
            return node
        }

        /// Thin flat sticker on the face (shine, cheeks).
        private func flatPart(_ path: UIBezierPath, mat: SCNMaterial) -> SCNNode {
            path.flatness = 0.05
            let shape = SCNShape(path: path, extrusionDepth: 0.2)
            shape.materials = [mat]
            let node = SCNNode(geometry: shape)
            node.castsShadow = false
            return node
        }

        /// A rounded ink stroke (mouth, happy eyes) extruded so it sits on the face with depth.
        private func stroke(from: CGPoint, control: CGPoint, to: CGPoint, width: CGFloat) -> SCNNode {
            let line = UIBezierPath()
            line.move(to: from)
            line.addQuadCurve(to: to, controlPoint: control)
            let outline = UIBezierPath(cgPath: line.cgPath.copy(strokingWithWidth: width, lineCap: .round, lineJoin: .round, miterLimit: 1))
            outline.flatness = 0.03
            let shape = SCNShape(path: outline, extrusionDepth: 1.2)
            shape.chamferRadius = 0.5
            shape.chamferProfile = Coordinator.roundProfile
            shape.materials = [inkFaceMat]
            let node = SCNNode(geometry: shape)
            node.position.z = 0.2
            return node
        }

        /// Plain circular-corner rectangle. UIKit's `roundedRect` draws "continuous" corners made of
        /// many tiny curves, and SCNShape drops the whole part when it chamfers that path.
        static func roundedRect(w: CGFloat, h: CGFloat, r: CGFloat) -> UIBezierPath {
            let x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2
            let p = UIBezierPath()
            p.move(to: CGPoint(x: x0 + r, y: y0))
            p.addLine(to: CGPoint(x: x1 - r, y: y0))
            p.addArc(withCenter: CGPoint(x: x1 - r, y: y0 + r), radius: r, startAngle: -.pi / 2, endAngle: 0, clockwise: true)
            p.addLine(to: CGPoint(x: x1, y: y1 - r))
            p.addArc(withCenter: CGPoint(x: x1 - r, y: y1 - r), radius: r, startAngle: 0, endAngle: .pi / 2, clockwise: true)
            p.addLine(to: CGPoint(x: x0 + r, y: y1))
            p.addArc(withCenter: CGPoint(x: x0 + r, y: y1 - r), radius: r, startAngle: .pi / 2, endAngle: .pi, clockwise: true)
            p.addLine(to: CGPoint(x: x0, y: y0 + r))
            p.addArc(withCenter: CGPoint(x: x0 + r, y: y0 + r), radius: r, startAngle: .pi, endAngle: 1.5 * .pi, clockwise: true)
            p.close()
            return p
        }

        /// Quarter-circle chamfer so edges look soft and puffy, not bevelled.
        static let roundProfile: UIBezierPath = {
            let p = UIBezierPath()
            p.move(to: CGPoint(x: 0, y: 1))
            p.addArc(withCenter: CGPoint(x: 1, y: 1), radius: 1, startAngle: .pi, endAngle: 1.5 * .pi, clockwise: true)
            p.flatness = 0.01
            return p
        }()

        /// Three-step cartoon shading, matching the flat sticker style of the 2D Fosfor.
        static func toon(_ color: UIColor) -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .lambert
            m.diffuse.contents = color
            m.shaderModifiers = [.lightingModel: """
                float d = max(0.0, dot(_surface.normal, _light.direction));
                float q = d > 0.55 ? 1.0 : (d > 0.2 ? 0.78 : 0.6);
                _lightingContribution.diffuse += (_light.intensity.rgb * q);
                """]
            return m
        }

        static func flat(_ color: UIColor) -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .constant
            m.diffuse.contents = color
            return m
        }

        static func outlineMaterial() -> SCNMaterial {
            let m = SCNMaterial()
            m.lightingModel = .constant
            m.cullMode = .front
            m.diffuse.contents = UIColor(hex: 0x1B2250)
            return m
        }
    }
}
