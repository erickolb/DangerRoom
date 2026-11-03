import XCTest
import WebKit
@testable import Hardlight

final class HardlightTests: XCTestCase {
    @MainActor func testSharedClientLoadsMenuAndNativeAPI() async throws {
        let connection = Connection(origin: "https://fixture.example", device: UUID().uuidString, secret: String(repeating: "a", count: 64))
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [FixtureProtocol.self]
        let controller = WebController(connection, transport: Transport(connection, configuration: config), settings: {})
        let window = UIWindow(frame: UIScreen.main.bounds); window.rootViewController = controller; window.makeKeyAndVisible()
        defer { window.isHidden = true; controller.pause() }
        controller.loadViewIfNeeded()
        var count = 0
        for _ in 0..<100 {
            count = (try? await controller.web.evaluateJavaScript("document.querySelectorAll('.mobile-menu-item').length")) as? Int ?? 0
            if count == 5 { break }
            try await Task.sleep(for: .milliseconds(200))
        }
        XCTAssertEqual(count, 5, "Shared ES modules and mobile menu must load through the custom scheme")
        guard count == 5 else { return }
        let result = try await controller.web.callAsyncJavaScript("return await Promise.race([new Promise(resolve=>{let id=crypto.randomUUID();window.dangerroomResponses[id]=resolve;window.DangerRoomAndroid.request('/api/health','GET','',id)}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Native API timeout')),10000))])", arguments: [:], in: nil, contentWorld: .page) as? [String: Any]
        XCTAssertEqual(result?["status"] as? Int, 200)
        let cleared = try await controller.web.callAsyncJavaScript("return await Promise.race([window.DangerRoomAndroid.flushCoverCache(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Cache bridge timeout')),10000))])", arguments: [:], in: nil, contentWorld: .page) as? Bool
        XCTAssertEqual(cleared, true)
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

final class FixtureProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "fixture.example" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let path = String(request.url!.path.dropFirst("/mobile".count))
        let data: Data; let type: String
        if path.hasPrefix("/api/") { data = Data("{\"status\":\"ok\",\"mobile_api\":1}".utf8); type = "application/json" }
        else {
            let file = path == "/" ? "/index.html" : path
            let root = Bundle(for: HardlightTests.self).resourceURL!.appendingPathComponent("Fixtures")
            data = (try? Data(contentsOf: root.appendingPathComponent(String(file.dropFirst())))) ?? Data()
            type = file.hasSuffix(".js") ? "text/javascript" : file.hasSuffix(".css") ? "text/css" : file.hasSuffix(".html") ? "text/html" : "image/png"
        }
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": type])!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
