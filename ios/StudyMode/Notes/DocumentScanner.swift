import SwiftUI
import VisionKit

struct DocumentScanner: UIViewControllerRepresentable {
    let limit: Int
    let receive: ([UIImage]) -> Void
    let fail: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }
    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let parent: DocumentScanner
        init(parent: DocumentScanner) { self.parent = parent }
        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { parent.dismiss() }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            parent.fail(error.localizedDescription)
            parent.dismiss()
        }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            guard scan.pageCount <= parent.limit else {
                parent.fail("Bu işlemde en fazla \(parent.limit) sayfa tarayabilirsin.")
                parent.dismiss()
                return
            }
            let pages = (0..<scan.pageCount).map { index in
                let page = scan.imageOfPage(at: index)
                return page.preparingThumbnail(of: CGSize(width: 2000, height: 2000)) ?? page
            }
            parent.receive(pages)
            parent.dismiss()
        }
    }
}
