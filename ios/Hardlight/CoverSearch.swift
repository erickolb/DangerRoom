import SwiftUI
import VisionKit

struct CoverSearchView: View {
    let onMatch: (String,Int) -> Void
    let onClose: () -> Void
    @State private var distance = 14.0
    @State private var scanning = false
    @State private var processing = false
    @State private var hashing: Task<Void,Never>?
    @State private var message: String?
    private let accent = Color(red: 0.937,green: 0.396,blue: 0.459)
    var body: some View {
        ScrollView {
            VStack(alignment: .leading,spacing: 24) {
                HStack {
                    Image(uiImage: UIImage(named: "mask.png") ?? UIImage()).resizable().scaledToFit().frame(width: 48,height: 48)
                    VStack(alignment: .leading) { Text("DangerRoom").font(.system(size: 27,design: .serif)); Text("Your Comics Sidekick").font(.caption).foregroundStyle(.pink) }
                    Spacer(); Button("Menu",action: onClose).buttonStyle(.bordered)
                }
                VStack(alignment: .leading,spacing: 20) {
                    Rectangle().fill(accent).frame(height: 3)
                    Text("FIND A COMIC BY ITS COVER").font(.caption).tracking(1.5).foregroundStyle(.pink)
                    Text(processing ? "Searching Metron…" : "Image Cover Search").font(.system(size: 32,design: .serif))
                    if processing { ProgressView("Preparing your confirmed cover image…") }
                    else {
                        Text("Capture one cover and adjust its corners or rotation in the scanner. Tap Save to search Metron.").foregroundStyle(.secondary)
                        HStack { Text("Hash distance"); Spacer(); Text("\(Int(distance))").padding(8).background(.white.opacity(0.08),in: Capsule()) }
                        Slider(value: $distance,in: 10...20,step: 1).accessibilityLabel("Hash distance")
                        HStack { Text("10 · Closer matches"); Spacer(); Text("20 · Broader search") }.font(.caption).foregroundStyle(.secondary)
                        Button("Capture Image") {
                            guard VNDocumentCameraViewController.isSupported else { message = "Document scanning is unavailable on this device. Use a supported iPhone or iPad."; return }
                            scanning = true
                        }.buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
                        Text("Your photo stays on this device. Only its cover hash is sent to DangerRoom and Metron.").font(.footnote).foregroundStyle(.secondary)
                    }
                }.padding(20).background(Color(red: 0.15,green: 0.067,blue: 0.098),in: RoundedRectangle(cornerRadius: 12))
            }.padding(20)
        }.background(Color(red: 0.10,green: 0.047,blue: 0.07)).tint(accent).preferredColorScheme(.dark)
        .sheet(isPresented: $scanning) {
            CoverScanner { image,error in
                scanning = false
                if let error { message = error.localizedDescription }
                guard let image else { return }
                processing = true
                hashing = Task {
                    do {
                        let hash = try await Task.detached(priority: .userInitiated) { try PerceptualHash.image(image) }.value
                        guard !Task.isCancelled else { return }
                        processing = false; onMatch(hash,Int(distance))
                    } catch { processing = false; message = error.localizedDescription }
                }
            }.ignoresSafeArea()
        }
        .onDisappear { hashing?.cancel() }
        .alert("Image Cover Search",isPresented: Binding(get: { message != nil },set: { if !$0 { message = nil } })) { Button("OK") { message = nil } } message: { Text(message ?? "") }
    }
}

struct CoverScanner: UIViewControllerRepresentable {
    let completion: (UIImage?,Error?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(completion) }
    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController(); scanner.delegate = context.coordinator; return scanner
    }
    func updateUIViewController(_ controller: VNDocumentCameraViewController,context: Context) {}
    final class Coordinator: NSObject,VNDocumentCameraViewControllerDelegate {
        let completion: (UIImage?,Error?) -> Void
        init(_ completion: @escaping (UIImage?,Error?) -> Void) { self.completion = completion }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController,didFinishWith scan: VNDocumentCameraScan) {
            guard scan.pageCount==1 else { completion(nil,ClientError(message: "Scan one comic cover at a time, then tap Save.")); return }
            completion(scan.imageOfPage(at: 0),nil)
        }
        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { completion(nil,nil) }
        func documentCameraViewController(_ controller: VNDocumentCameraViewController,didFailWithError error: Error) { completion(nil,error) }
    }
}
