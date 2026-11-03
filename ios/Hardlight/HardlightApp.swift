import SwiftUI
import WebKit
import CryptoKit

@main struct HardlightApp: App {
    var body: some Scene { WindowGroup { ClientView().preferredColorScheme(.dark) } }
}

struct ClientView: View {
    @State private var connection = try? CredentialStore.load()
    @State private var editing = false
    @State private var splash = true
    @State private var host = ""
    @State private var device = ""
    @State private var secret = ""
    @State private var message = ""
    @State private var testing = false
    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.047, blue: 0.07).ignoresSafeArea()
            if splash {
                Color(red: 0.906, green: 0, blue: 0.122).ignoresSafeArea()
                ZStack {
                    Circle().fill(Color(red: 0.604, green: 0, blue: 0.067)).frame(width: 192, height: 192).offset(x: 16, y: 16)
                    Image(uiImage: UIImage(named: "mask.png") ?? UIImage()).resizable().scaledToFit().frame(width: 192, height: 192)
                    Circle().stroke(Color(red: 0.086, green: 0.051, blue: 0.071), lineWidth: 1.5).frame(width: 192, height: 192)
                }.frame(width: 224, height: 224)
            } else if let connection, !editing {
                Browser(connection: connection) { editing = true; host = connection.origin; device = connection.device; secret = "" }.ignoresSafeArea()
            } else {
                NavigationStack { Form {
                    Section("Connect to DangerRoom") {
                        TextField("DangerRoom hostname", text: $host).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                        TextField("Device ID", text: $device).textInputAutocapitalization(.never).autocorrectionDisabled()
                        SecureField("Device secret", text: $secret)
                        Text("Ask your administrator for a separate device ID and secret for this installation. HTTPS is required. Leave the secret blank to retain it for the same instance and device.")
                        Button(testing ? "Testing…" : "Save and test connection") { Task { await save() } }.disabled(testing)
                        Text(message).accessibilityLabel(message)
                    }
                    if connection != nil { Button("Back to menu") { editing = false } }
                }.navigationTitle("Danger Room") }
            }
        }.task { try? await Task.sleep(for: .milliseconds(700)); splash = false }
    }
    @MainActor func save() async {
        testing = true; defer { testing = false }
        do {
            let raw = host.trimmingCharacters(in: .whitespacesAndNewlines)
            let origin = try Input.origin(raw.contains("://") ? raw : "https://" + raw)
            let id = device.trimmingCharacters(in: .whitespacesAndNewlines)
            let token = secret.isEmpty && connection?.origin == origin && connection?.device == id ? connection!.secret : secret
            guard UUID(uuidString: id) != nil, token.range(of: "^[a-fA-F0-9]{64}$", options: .regularExpression) != nil else { throw ClientError(message: "Enter the device ID and 64-character secret issued by your administrator.") }
            let next = Connection(origin: origin, device: id, secret: token)
            let (data, response) = try await Transport(next).get("/api/device")
            guard response.statusCode == 200, (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["authorized"] as? Bool == true else { throw ClientError(message: "Device not authorized. Check the address, device ID, secret and server version.") }
            try CredentialStore.save(next); connection = next; secret = ""; editing = false; message = ""
        } catch { message = error.localizedDescription }
    }
}

final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

final class Transport {
    let connection: Connection
    let session: URLSession
    init(_ connection: Connection, configuration: URLSessionConfiguration = .ephemeral) {
        self.connection = connection
        let config = configuration
        config.timeoutIntervalForRequest = 90; config.timeoutIntervalForResource = 90
        config.httpCookieStorage = nil; config.urlCache = nil
        session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }
    deinit { session.invalidateAndCancel() }
    func get(_ path: String, method: String = "GET", body: String = "") async throws -> (Data, HTTPURLResponse) {
        guard Self.validPath(path), ["GET", "POST", "PATCH", "DELETE"].contains(method), body.utf8.count <= 8192 else { throw ClientError(message: "Invalid request.") }
        var request = URLRequest(url: URL(string: connection.origin + "/mobile" + path)!)
        request.httpMethod = method
        request.setValue(connection.device, forHTTPHeaderField: "X-Device-Id")
        request.setValue("Bearer " + connection.secret, forHTTPHeaderField: "Authorization")
        if !body.isEmpty { request.httpBody = Data(body.utf8); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (bytes, response) = try await session.bytes(for: request)
        var data = Data()
        for try await byte in bytes { guard data.count < 26 * 1024 * 1024 else { throw ClientError(message: "Response too large.") }; data.append(byte) }
        guard let response = response as? HTTPURLResponse else { throw ClientError(message: "Invalid response.") }
        return (data, response)
    }
    static func validPath(_ path: String) -> Bool {
        guard let decoded = path.removingPercentEncoding else { return false }
        return decoded.hasPrefix("/") && !decoded.hasPrefix("//") && !decoded.contains("\\") && !decoded.contains("..") && !decoded.contains("#") && !decoded.contains("://")
    }
}

struct Browser: UIViewControllerRepresentable {
    let connection: Connection
    let settings: () -> Void
    func makeUIViewController(context: Context) -> WebController { WebController(connection, settings: settings) }
    func updateUIViewController(_ controller: WebController, context: Context) {}
    static func dismantleUIViewController(_ controller: WebController, coordinator: ()) { controller.pause(); controller.web.stopLoading() }
}

final class WeakWebHandler: NSObject, WKURLSchemeHandler, WKScriptMessageHandler {
    weak var owner: WebController?
    init(_ owner: WebController) { self.owner = owner }
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) { owner?.webView(webView, start: urlSchemeTask) }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { owner?.webView(webView, stop: urlSchemeTask) }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { owner?.userContentController(userContentController, didReceive: message) }
}

final class WebController: UIViewController, WKURLSchemeHandler, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    let transport: Transport
    let settings: () -> Void
    var web: WKWebView!
    var pending: [ObjectIdentifier: Task<Void, Never>] = [:]
    let cache: CoverCache
    init(_ connection: Connection, transport: Transport? = nil, settings: @escaping () -> Void) {
        self.transport = transport ?? Transport(connection); self.settings = settings; cache = CoverCache(connection)
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }
    override func loadView() {
        let config = WKWebViewConfiguration()
        let handler = WeakWebHandler(self)
        config.setURLSchemeHandler(handler, forURLScheme: "hardlight")
        // Separate website data per instance/device, without putting credentials in JavaScript.
        let digest = Array(SHA256.hash(data: Data((transport.connection.origin + transport.connection.device).utf8)).prefix(16))
        let identifier = digest.withUnsafeBytes { UUID(uuid: $0.loadUnaligned(as: uuid_t.self)) }
        config.websiteDataStore = WKWebsiteDataStore(forIdentifier: identifier)
        config.userContentController.add(handler, name: "hardlight")
        config.userContentController.addUserScript(WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config); web.navigationDelegate = self; web.uiDelegate = self
        web.isInspectable = false; web.isOpaque = false; web.backgroundColor = .black
        view = web
        web.load(URLRequest(url: URL(string: "hardlight://app/#/home")!))
        NotificationCenter.default.addObserver(self, selector: #selector(pause), name: UIApplication.willResignActiveNotification, object: nil)
    }
    @objc func pause() { web.evaluateJavaScript("document.dispatchEvent(new Event('dangerroompause'))"); UIApplication.shared.isIdleTimerDisabled = false }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated); pause()
        web.configuration.userContentController.removeScriptMessageHandler(forName: "hardlight")
        for task in pending.values { task.cancel() }; pending.removeAll()
    }
    override var prefersStatusBarHidden: Bool { immersive }
    var immersive = false
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let id = ObjectIdentifier(urlSchemeTask)
        pending[id] = Task { @MainActor in
            defer { pending.removeValue(forKey: id) }
            do {
                guard let url = urlSchemeTask.request.url, url.host == "app", urlSchemeTask.request.httpMethod == "GET" else { throw ClientError(message: "Invalid address.") }
                let path = url.path.isEmpty ? "/" : url.path
                let full = path + (url.query.map { "?" + $0 } ?? "")
                let file = path.hasPrefix("/covers/") ? String(path.dropFirst(8)) : ""
                let data: Data; let mime: String
                if let saved = cache.read(file) { data = saved; mime = CoverCache.mime(file) }
                else {
                    let (received, response) = try await transport.get(full)
                    guard response.statusCode == 200 else { throw ClientError(message: "Server returned HTTP \(response.statusCode). Open instance and device settings to check access.") }
                    data = received; mime = response.mimeType ?? "application/octet-stream"
                    if mime.hasPrefix("image/") { cache.put(file, data) }
                }
                guard !Task.isCancelled else { return }
                urlSchemeTask.didReceive(URLResponse(url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: mime.hasPrefix("text/") ? "utf-8" : nil))
                urlSchemeTask.didReceive(data); urlSchemeTask.didFinish()
            } catch { if !Task.isCancelled { urlSchemeTask.didFailWithError(error) } }
        }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) { pending.removeValue(forKey: ObjectIdentifier(urlSchemeTask))?.cancel() }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == "hardlight", message.frameInfo.request.url?.host == "app", let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        switch action {
        case "settings": settings()
        case "keepAwake": UIApplication.shared.isIdleTimerDisabled = body["enabled"] as? Bool ?? false
        case "fullscreen": immersive = body["enabled"] as? Bool ?? false; setNeedsStatusBarAppearanceUpdate()
        case "configureCoverCache": cache.configure(body)
        case "flushCoverCache": reply(body["id"] as? String, ["cleared": cache.clear()])
        case "request":
            guard let path = body["path"] as? String, path.hasPrefix("/api/"), let id = body["id"] as? String, UUID(uuidString: id) != nil else { return }
            Task { @MainActor in
                do {
                    let (data, response) = try await transport.get(path, method: body["method"] as? String ?? "GET", body: body["body"] as? String ?? "")
                    reply(id, ["status": response.statusCode, "data": (try? JSONSerialization.jsonObject(with: data)) ?? ["error": "Invalid server response."]])
                } catch { reply(id, ["status": 503, "data": ["error": error.localizedDescription]]) }
            }
        default: break
        }
    }
    func reply(_ id: String?, _ result: [String: Any]) {
        guard let id, UUID(uuidString: id) != nil, let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.dangerroomResponses?.['\(id)']?.(\(json))")
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.request.url?.scheme == "hardlight", navigationAction.request.url?.host == "app" { decisionHandler(.allow) }
        else { if let url = navigationAction.request.url, ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }; decisionHandler(.cancel) }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" { UIApplication.shared.open(url) }; return nil
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { settings() }
    static let bridge = """
    (()=>{const send=(action,data={})=>window.webkit.messageHandlers.hardlight.postMessage({action,...data});
    if(!crypto.randomUUID)crypto.randomUUID=()=>"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));
    window.DangerRoomIOS=true;
    window.DangerRoomAndroid={settings:()=>send('settings'),keepAwake:enabled=>send('keepAwake',{enabled}),fullscreen:enabled=>send('fullscreen',{enabled}),
    request:(path,method,body,id)=>send('request',{path,method,body,id}),
    configureCoverCache:(files,limited,megabytes)=>send('configureCoverCache',{files,limited,megabytes}),
    flushCoverCache:()=>new Promise(resolve=>{const id=crypto.randomUUID();window.dangerroomResponses??={};window.dangerroomResponses[id]=r=>{delete window.dangerroomResponses[id];resolve(r.cleared)};send('flushCoverCache',{id})})};})();
    """
}
