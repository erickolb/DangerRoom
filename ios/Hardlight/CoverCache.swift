import Foundation
import CryptoKit

final class CoverCache {
    let directory: URL
    var playlist = Set<String>()
    var limit: Int64 = 300 * 1024 * 1024
    let now: () -> Date
    init(_ connection: Connection, root: URL? = nil, now: @escaping () -> Date = Date.init) {
        self.now = now
        let scope = SHA256.hash(data: Data((connection.origin + "\n" + connection.device + "\n" + connection.secret).utf8)).map { String(format: "%02x", $0) }.joined()
        directory = (root ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]).appendingPathComponent("covers/" + scope)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }
    static func valid(_ name: String) -> Bool { name.range(of: "^[a-f0-9]{64}\\.(jpg|png|webp|gif)$", options: .regularExpression) != nil }
    static func mime(_ name: String) -> String { name.hasSuffix("jpg") ? "image/jpeg" : "image/" + (name as NSString).pathExtension }
    func files() -> [URL] { (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])) ?? [] }
    func configure(_ body: [String: Any]) {
        let names = (body["files"] as? String).flatMap { $0.data(using: .utf8) }.flatMap { try? JSONDecoder().decode([String].self, from: $0) } ?? []
        playlist = Set(names.filter(Self.valid))
        limit = body["limited"] as? Bool == false ? Int64.max : Int64(max(1, min(1048576, body["megabytes"] as? Int ?? 300))) * 1024 * 1024
        for file in files() where !playlist.contains(file.lastPathComponent.replacingOccurrences(of: ".access", with: "")) { try? FileManager.default.removeItem(at: file) }
        var covers = files().filter { Self.valid($0.lastPathComponent) }
        var used = covers.reduce(Int64(0)) { $0 + size($1) }
        covers.sort { access($0) < access($1) }
        for file in covers where used > limit { used -= size(file); remove(file) }
    }
    func size(_ file: URL) -> Int64 { Int64((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    func access(_ file: URL) -> Date { (try? file.appendingPathExtension("access").resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast }
    func remove(_ file: URL) { try? FileManager.default.removeItem(at: file); try? FileManager.default.removeItem(at: file.appendingPathExtension("access")) }
    func read(_ name: String) -> Data? {
        guard playlist.contains(name), Self.valid(name) else { return nil }
        let file = directory.appendingPathComponent(name)
        guard let date = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, now().timeIntervalSince(date) < 180 * 86400 else { remove(file); return nil }
        guard let data = try? Data(contentsOf: file) else { return nil }
        try? Data().write(to: file.appendingPathExtension("access")); return data
    }
    func put(_ name: String, _ data: Data) {
        guard playlist.contains(name), Self.valid(name), Int64(data.count) <= limit else { return }
        let file = directory.appendingPathComponent(name)
        let used = files().reduce(Int64(0)) { $0 + size($1) }
        guard used - size(file) <= limit - Int64(data.count) else { return }
        try? data.write(to: file, options: .atomic)
        try? FileManager.default.setAttributes([.modificationDate: now()], ofItemAtPath: file.path)
        try? Data().write(to: file.appendingPathExtension("access"))
    }
    @discardableResult func clear() -> Bool { for file in files() { try? FileManager.default.removeItem(at: file) }; return files().isEmpty }
}
