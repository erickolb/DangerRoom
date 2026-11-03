import Foundation
import Security

struct ClientError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

struct Connection: Codable, Equatable {
    var origin: String
    var device: String
    var secret: String
}

enum Input {
    static func origin(_ raw: String) throws -> String {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parts = URLComponents(string: text), parts.scheme == "https",
              let host = parts.host, !host.isEmpty, parts.user == nil, parts.password == nil,
              parts.query == nil, parts.fragment == nil, parts.path.isEmpty || parts.path == "/",
              parts.url != nil else { throw ClientError(message: "Use an HTTPS server address without a path.") }
        return text.hasSuffix("/") ? String(text.dropLast()) : text
    }
}

enum CredentialStore {
    static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: Bundle.main.bundleIdentifier ?? "net.chateaulore.hardlight",
         kSecAttrAccount as String: "connection"]
    }
    static func load() throws -> Connection? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw ClientError(message: "Unable to unlock the saved connection. Unlock your phone and try again.")
        }
        return try JSONDecoder().decode(Connection.self, from: data)
    }
    static func save(_ connection: Connection) throws {
        let attributes: [String: Any] = [kSecValueData as String: try JSONEncoder().encode(connection),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw ClientError(message: "Could not save the device credential securely.") }
    }
}



