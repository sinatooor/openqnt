import Foundation

/// Generic typed HTTP client for the FastAPI backend.
///
/// - Authorization: pulled from `AuthStore.shared.accessToken` on every call.
///   When 401 is returned and a refresh token exists, the client transparently
///   attempts a refresh once before bubbling the failure.
/// - Encoding: JSON in, JSON out. snake_case server fields are mapped to
///   camelCase via `JSONDecoder.keyDecodingStrategy = .convertFromSnakeCase`.
/// - Errors: thrown as `APIError` carrying status + decoded server message.
enum APIError: Error, LocalizedError {
    case invalidURL
    case transport(URLError)
    case server(status: Int, message: String)
    case decoding(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .transport(let e): return e.localizedDescription
        case .server(let status, let msg): return "Server \(status): \(msg)"
        case .decoding(let e): return "Decode failed: \(e.localizedDescription)"
        case .unauthorized: return "Sign in required"
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 20
        cfg.waitsForConnectivity = true
        self.session = URLSession(configuration: cfg)

        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        self.encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Public surface

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try await sendDecoding(method: "GET", path: path, query: query, body: Optional<EmptyBody>.none)
    }

    func post<Req: Encodable, Res: Decodable>(_ path: String, body: Req) async throws -> Res {
        try await sendDecoding(method: "POST", path: path, query: [:], body: body)
    }

    func postEmpty<Res: Decodable>(_ path: String) async throws -> Res {
        try await sendDecoding(method: "POST", path: path, query: [:], body: Optional<EmptyBody>.none)
    }

    func patch<Req: Encodable, Res: Decodable>(_ path: String, body: Req) async throws -> Res {
        try await sendDecoding(method: "PATCH", path: path, query: [:], body: body)
    }

    func delete(_ path: String) async throws {
        let (_, http) = try await rawSend(method: "DELETE", path: path, query: [:], body: Optional<EmptyBody>.none)
        if !(200..<300).contains(http.statusCode) {
            throw APIError.server(status: http.statusCode, message: "delete failed")
        }
    }

    // MARK: - Internals

    private struct EmptyBody: Encodable {}

    private func makeURL(path: String, query: [String: String]) throws -> URL {
        let base = Settings.shared.backendURL
        var components = URLComponents(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.invalidURL }
        return url
    }

    private func sendDecoding<Req: Encodable, Res: Decodable>(
        method: String,
        path: String,
        query: [String: String],
        body: Req?
    ) async throws -> Res {
        let (data, http) = try await rawSend(method: method, path: path, query: query, body: body)
        guard (200..<300).contains(http.statusCode) else {
            // Attempt refresh + retry once for 401
            if http.statusCode == 401 {
                if await AuthStore.shared.tryRefresh() {
                    let (data2, http2) = try await rawSend(method: method, path: path, query: query, body: body)
                    if (200..<300).contains(http2.statusCode) {
                        return try decode(data2)
                    }
                }
                throw APIError.unauthorized
            }
            let msg = String(data: data, encoding: .utf8) ?? "(no body)"
            throw APIError.server(status: http.statusCode, message: msg)
        }
        return try decode(data)
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        // Allow empty 204-style payloads to decode to `EmptyResponse`.
        if data.isEmpty, let empty = EmptyResponse() as? T { return empty }
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.decoding(error) }
    }

    private func rawSend<Req: Encodable>(
        method: String,
        path: String,
        query: [String: String],
        body: Req?
    ) async throws -> (Data, HTTPURLResponse) {
        let url = try makeURL(path: path, query: query)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = await AuthStore.shared.accessToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = body {
            req.httpBody = try encoder.encode(body)
        }
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.server(status: -1, message: "Non-HTTP response")
            }
            return (data, http)
        } catch let urlErr as URLError {
            throw APIError.transport(urlErr)
        }
    }
}

/// Marker for endpoints that return no body / 204.
struct EmptyResponse: Decodable {}
