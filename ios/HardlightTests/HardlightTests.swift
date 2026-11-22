import XCTest
import WebKit
@testable import Hardlight

final class HardlightTests: XCTestCase {
    func testMinimumServerVersion() {
        for version in ["1.2.0","1.2.1","1.10.0","2.0.0"] { XCTAssertTrue(Input.supportsServer(version)) }
        for version in ["1.1.0","1.1.2","1.1.99","1.0.7","0.99.99","β-030","","1.1","1.1.0-beta.1"] { XCTAssertFalse(Input.supportsServer(version)) }
    }
    func testHashMatchesAndroidAndPythonGoldenVectors() throws {
        struct Vector: Decodable { let width: Int; let height: Int; let seed: UInt32; let white: Bool; let hash: String }
        let url = Bundle(for: Self.self).url(forResource: "phash-vectors",withExtension: "json")!
        let vectors = try JSONDecoder().decode([Vector].self,from: Data(contentsOf: url))
        for vector in vectors {
            var state = vector.seed
            let pixels: [UInt32] = (0..<(vector.width*vector.height)).map { _ in
                var pixel: UInt32 = 255<<24
                for shift in [16,8,0] { state = 1664525 &* state &+ 1013904223; pixel |= (state>>24)<<shift }
                return vector.white ? UInt32.max : pixel
            }
            XCTAssertEqual(try PerceptualHash.fromARGB(pixels,width: vector.width,height: vector.height),vector.hash)
            if vector.width==32 && vector.height==32 {
                let bytes = pixels.flatMap { pixel in [UInt8((pixel>>16)&255),UInt8((pixel>>8)&255),UInt8(pixel&255),UInt8(255)] }
                let provider = CGDataProvider(data: Data(bytes) as CFData)!
                let cg = CGImage(width: 32,height: 32,bitsPerComponent: 8,bitsPerPixel: 32,bytesPerRow: 128,space: CGColorSpaceCreateDeviceRGB(),bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),provider: provider,decode: nil,shouldInterpolate: false,intent: .defaultIntent)!
                XCTAssertEqual(try PerceptualHash.image(UIImage(cgImage: cg)),vector.hash,"UIKit pixel orientation must preserve the expected hash")
            }
        }
    }
    func testTransportChecksCompatibilityBeforeDeviceAuthorization() async throws {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        try await Transport(Connection(origin: "https://fixture.example",device: "test",secret: "test"),configuration: config).verify()
    }
    func testTransportRejectsAnOlderInstance() async throws {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [OldInstanceProtocol.self]
        do {
            try await Transport(Connection(origin: "https://fixture.example",device: "test",secret: "test"),configuration: config).verify()
            XCTFail("An incompatible instance must be blocked")
        } catch { XCTAssertTrue(error is ServerUpdateRequired) }
    }
    @MainActor func testSharedClientLoadsMenuAndNativeAPI() async throws {
        let connection = Connection(origin: "https://fixture.example", device: UUID().uuidString, secret: String(repeating: "a", count: 64))
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        let controller = WebController(connection, transport: Transport(connection, configuration: config), settings: {})
        let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = controller; window.makeKeyAndVisible()
        defer { window.isHidden = true; controller.pause() }
        controller.loadViewIfNeeded()
        controller.web.configuration.userContentController.addUserScript(WKUserScript(source: "window.testErrors=[];addEventListener('error',e=>testErrors.push(e.message||e.target.src),true);addEventListener('unhandledrejection',e=>testErrors.push(String(e.reason)))", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.web.reload()
        var count = 0
        for _ in 0..<100 {
            count = (try? await controller.web.evaluateJavaScript("document.querySelectorAll('.mobile-menu-item').length")) as? Int ?? 0
            if count == 8 { break }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTAssertEqual(count, 8, "Shared ES modules and mobile menu must load through the custom scheme")
        if count != 8 { print("Web diagnostics:", (try? await controller.web.evaluateJavaScript("JSON.stringify({errors:window.testErrors,bridge:typeof window.DangerRoomAndroid,uuid:typeof crypto.randomUUID,html:document.body?.innerHTML.slice(0,1500)})")) ?? "No JavaScript response") }
        guard count == 8 else { return }
        let upcShortcut = try await controller.web.evaluateJavaScript("document.querySelector('.mobile-menu-item[href=\"#/?mode=upc\"]').textContent.includes('UPC Mode')") as? Bool
        XCTAssertEqual(upcShortcut, true)
        _ = try await controller.web.evaluateJavaScript("document.querySelector('.mobile-menu-item[href=\"#/?mode=upc\"]').click()")
        for _ in 0..<40 {
            if (try? await controller.web.evaluateJavaScript("!!document.querySelector('#upc-input')")) as? Bool == true { break }
            try await Task.sleep(for: .milliseconds(100))
        }
        let upcReady = try await controller.web.evaluateJavaScript("!!document.querySelector('#upc-input')") as? Bool
        XCTAssertEqual(upcReady, true)
        let stored = try await controller.web.evaluateJavaScript("localStorage.setItem('hardlight-test','saved');localStorage.getItem('hardlight-test')") as? String
        XCTAssertEqual(stored, "saved", "Slideshow preferences must be writable in the per-instance web data store")
        let result = try await controller.web.callAsyncJavaScript("return await Promise.race([new Promise(resolve=>{let id=crypto.randomUUID();window.dangerroomResponses[id]=resolve;window.DangerRoomAndroid.request('/api/health','GET','',id)}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Native API timeout')),10000))])", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertEqual(result?["status"] as? Int, 200)
        let capable = try await controller.web.evaluateJavaScript("window.DangerRoomAndroid.supportsSubscriptions()") as? Bool
        XCTAssertEqual(capable,true)
        let subscription = try await controller.web.callAsyncJavaScript("return await new Promise(resolve=>{let id=crypto.randomUUID();window.dangerroomResponses[id]=resolve;window.DangerRoomAndroid.request('/api/subscriptions/44','PUT',JSON.stringify({subscribed:true}),id)})", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertEqual(subscription?["status"] as? Int,200)
        let subscriptionData = subscription?["data"] as? [String: Any]
        XCTAssertEqual(subscriptionData?["method"] as? String,"PUT")
        XCTAssertEqual(subscriptionData?["authenticated"] as? Bool,true)
        let cleared = try await controller.web.callAsyncJavaScript("return await Promise.race([window.DangerRoomAndroid.flushCoverCache(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Cache bridge timeout')),10000))])", arguments: [:], in: nil, contentWorld: .page) as? Bool
        XCTAssertEqual(cleared, true)
    }
    func testTransportAllowsSubscriptionUpdates() async throws {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        let transport = Transport(Connection(origin: "https://fixture.example",device: "test",secret: "test"),configuration: config)
        let (data,response) = try await transport.get("/api/subscriptions/44",method: "PUT",body: "{\"subscribed\":true}")
        XCTAssertEqual(response.statusCode,200)
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(object?["method"] as? String,"PUT")
        XCTAssertEqual(object?["authenticated"] as? Bool,true)
    }
    func testOriginsAndRequestBoundaries() throws {
        XCTAssertEqual(try Input.origin("https://comics.example.net:8443/"), "https://comics.example.net:8443")
        for value in ["http://example.net", "https://name:secret@example.net", "https://example.net/path", "https://example.net?token=x"] { XCTAssertThrowsError(try Input.origin(value)) }
        for path in ["//evil.net", "/../secret", "/%2e%2e/secret", "/api/https://evil.net", "/api/\\evil"] { XCTAssertFalse(Transport.validPath(path)) }
        XCTAssertTrue(Transport.validPath("/api/collection?q=Batman"))
    }
    func testCacheLimitExpiryAndIsolation() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let connection = Connection(origin: "https://example.net", device: "phone", secret: "secret")
        var date = Date()
        let cache = CoverCache(connection, root: root, now: { date })
        let name = String(repeating: "a", count: 64) + ".png"
        let other = String(repeating: "b", count: 64) + ".png"
        cache.configure(["files": "[\"\(name)\",\"\(other)\"]", "limited": true, "megabytes": 1])
        let data = Data(repeating: 1, count: 700000)
        cache.put(name, data); cache.put(other, data)
        XCTAssertEqual(cache.read(name), data); XCTAssertNil(cache.read(other))
        date = date.addingTimeInterval(181 * 86400); XCTAssertNil(cache.read(name))
        XCTAssertNotEqual(cache.directory, CoverCache(Connection(origin: connection.origin, device: "another", secret: connection.secret), root: root).directory)
        cache.put(other, data); cache.configure(["files": "[]"]); XCTAssertNil(cache.read(other))
    }
}

final class OldInstanceProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "fixture.example" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let data = Data("{\"version\":\"1.1.2\",\"authorized\":true}".utf8)
        client?.urlProtocol(self,didReceive: HTTPURLResponse(url: request.url!,statusCode: 200,httpVersion: nil,headerFields: ["Content-Type":"application/json"])!,cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self,didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class FixtureProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "fixture.example" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let path = String(request.url!.path.dropFirst("/mobile".count))
        let data: Data; let type: String
        if path == "/api/subscriptions/44" {
            data = try! JSONSerialization.data(withJSONObject: ["series_id":44,"subscribed":true,"method":request.httpMethod ?? "", "authenticated":request.value(forHTTPHeaderField: "X-Device-Id") != nil && request.value(forHTTPHeaderField: "Authorization")?.hasPrefix("Bearer ") == true]); type = "application/json"
        }
        else if path.hasPrefix("/api/") { data = Data("{\"status\":\"ok\",\"mobile_api\":1,\"version\":\"1.2.0\",\"authorized\":true}".utf8); type = "application/json" }
        else {
            let file = path.isEmpty || path == "/" ? "/index.html" : path
            let root = Bundle(for: HardlightTests.self).resourceURL!.appendingPathComponent("Fixtures")
            data = (try? Data(contentsOf: root.appendingPathComponent(String(file.dropFirst())))) ?? Data()
            type = file.hasSuffix(".js") ? "text/javascript" : file.hasSuffix(".css") ? "text/css" : file.hasSuffix(".html") ? "text/html" : file.hasSuffix(".svg") ? "image/svg+xml" : "image/png"
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": type])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
