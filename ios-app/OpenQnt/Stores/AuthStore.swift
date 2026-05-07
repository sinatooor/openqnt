import Foundation
import Security
import Combine

/// Owns the access/refresh tokens + the current user. Tokens are persisted in
/// Keychain, never UserDefaults.
@MainActor
final class AuthStore: ObservableObject {
    static let shared = AuthStore()

    @Published private(set) var user: User?
    @Published private(set) var isAuthed: Bool = false
    @Published private(set) var isWorking: Bool = false
    @Published var lastError: String?

    /// Synchronous accessor for code paths that can't await (WebSocket reconnect).
    fileprivate(set) var accessTokenSync: String?
    private(set) var refreshTokenSync: String?

    private init() {
        // Keychain restore — runs at app start
        if let access = Keychain.read("openqnt.accessToken"),
           let userJson = Keychain.read("openqnt.user"),
           let userData = userJson.data(using: .utf8),
           let restored = try? JSONDecoder().decode(User.self, from: userData) {
            self.accessTokenSync = access
            self.refreshTokenSync = Keychain.read("openqnt.refreshToken")
            self.user = restored
            self.isAuthed = true
        }
    }

    var accessToken: String? { accessTokenSync }

    func signIn(email: String, password: String) async {
        isWorking = true
        lastError = nil
        do {
            let res = try await AuthClient.login(email: email, password: password)
            applyAuth(res: res)
        } catch {
            lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isWorking = false
    }

    func signUp(email: String, password: String, name: String?) async {
        isWorking = true
        lastError = nil
        do {
            let res = try await AuthClient.register(email: email, password: password, name: name)
            applyAuth(res: res)
        } catch {
            lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isWorking = false
    }

    func signOut() {
        accessTokenSync = nil
        refreshTokenSync = nil
        user = nil
        isAuthed = false
        Keychain.delete("openqnt.accessToken")
        Keychain.delete("openqnt.refreshToken")
        Keychain.delete("openqnt.user")
    }

    /// Try to refresh the access token. Returns true on success.
    /// APIClient calls this on its own when a 401 lands.
    func tryRefresh() async -> Bool {
        guard let refresh = refreshTokenSync else { return false }
        do {
            let res = try await AuthClient.refresh(refresh)
            self.accessTokenSync = res.accessToken
            Keychain.write("openqnt.accessToken", value: res.accessToken)
            return true
        } catch {
            // Refresh failed → force sign-out so the UI shows the login screen.
            signOut()
            return false
        }
    }

    private func applyAuth(res: AuthClient.AuthResponse) {
        let u = User(id: res.user.id, email: res.user.email, name: res.user.name)
        self.user = u
        self.accessTokenSync = res.accessToken
        self.refreshTokenSync = res.refreshToken
        self.isAuthed = true

        Keychain.write("openqnt.accessToken", value: res.accessToken)
        if let r = res.refreshToken {
            Keychain.write("openqnt.refreshToken", value: r)
        }
        if let userData = try? JSONEncoder().encode(u),
           let userJson = String(data: userData, encoding: .utf8) {
            Keychain.write("openqnt.user", value: userJson)
        }
    }
}

// MARK: - Tiny Keychain helper

enum Keychain {
    static func write(_ key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var attrs = query
        attrs[kSecValueData as String] = data
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attrs as CFDictionary, nil)
    }

    static func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
