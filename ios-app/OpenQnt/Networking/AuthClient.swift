import Foundation

/// Auth-specific HTTP calls. Kept separate from APIClient because login does
/// NOT carry an Authorization header (you don't have a token yet) and the
/// 401-refresh flow has to short-circuit on the refresh endpoint itself.
enum AuthClient {
    struct LoginRequest: Encodable {
        let email: String
        let password: String
    }
    struct RegisterRequest: Encodable {
        let email: String
        let password: String
        let name: String?
    }
    struct AuthResponse: Decodable {
        let accessToken: String
        let refreshToken: String?
        let user: AuthUser
    }
    struct RefreshRequest: Encodable {
        let refreshToken: String
    }
    struct RefreshResponse: Decodable {
        let accessToken: String
    }
    struct AuthUser: Decodable, Equatable {
        let id: String
        let email: String
        let name: String?
    }

    static func login(email: String, password: String) async throws -> AuthResponse {
        try await postNoAuth(Endpoints.authLogin, body: LoginRequest(email: email, password: password))
    }

    static func register(email: String, password: String, name: String?) async throws -> AuthResponse {
        try await postNoAuth(Endpoints.authRegister, body: RegisterRequest(email: email, password: password, name: name))
    }

    static func refresh(_ refreshToken: String) async throws -> RefreshResponse {
        try await postNoAuth(Endpoints.authRefresh, body: RefreshRequest(refreshToken: refreshToken))
    }

    /// Fire-and-forget liveness probe used during login to confirm the URL
    /// actually hosts an OpenQnt backend.
    static func health() async -> Bool {
        let base = Settings.shared.backendURL
        guard let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + Endpoints.health) else {
            return false
        }
        var req = URLRequest(url: url)
        req.timeoutInterval = 4
        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            return (resp as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    // MARK: - Internals

    private static func postNoAuth<Req: Encodable, Res: Decodable>(_ path: String, body: Req) async throws -> Res {
        let base = Settings.shared.backendURL
        guard let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        req.httpBody = try encoder.encode(body)

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.server(status: -1, message: "Non-HTTP response")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(status: http.statusCode, message: String(data: data, encoding: .utf8) ?? "")
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do { return try decoder.decode(Res.self, from: data) }
        catch { throw APIError.decoding(error) }
    }
}
