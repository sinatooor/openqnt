import Foundation
import Combine

/// Tiny `UserDefaults`-backed settings store + pairing client.
final class Settings: ObservableObject {
    static let shared = Settings()

    @Published var backendURL: String {
        didSet { UserDefaults.standard.set(backendURL, forKey: "backendURL") }
    }
    @Published var userId: String? {
        didSet { UserDefaults.standard.set(userId, forKey: "userId") }
    }
    @Published var voipPushToken: String? {
        didSet { UserDefaults.standard.set(voipPushToken, forKey: "voipPushToken") }
    }

    private init() {
        self.backendURL = UserDefaults.standard.string(forKey: "backendURL") ?? "https://example.ngrok.app"
        self.userId = UserDefaults.standard.string(forKey: "userId")
        self.voipPushToken = UserDefaults.standard.string(forKey: "voipPushToken")
    }

    /// Submit the pairing token + current VoIP push token to the backend.
    /// On success, the backend stores our voipPushToken under the user_id
    /// so future calls ring this device.
    func pair(with token: String) async throws {
        guard let push = voipPushToken else {
            throw NSError(domain: "OpenQnt", code: 1, userInfo: [NSLocalizedDescriptionKey: "No VoIP push token yet — wait a moment after launch and retry."])
        }
        let url = URL(string: backendURL.trimmingCharacters(in: .init(charactersIn: "/")) + "/api/voice/devices/ios/pair-claim")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "pairing_token": token,
            "voip_push_token": push,
            "apns_environment": "production",
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? ""
            throw NSError(domain: "OpenQnt", code: 2, userInfo: [NSLocalizedDescriptionKey: "Pair failed: \(msg)"])
        }
        if let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let uid = decoded["user_id"] as? String {
            await MainActor.run { self.userId = uid }
        }
    }
}

enum BackendClient {
    static let shared = BackendClient_Impl()
}

final class BackendClient_Impl {
    /// If we already paired before, push our token to /devices/ios/register so
    /// the backend keeps last_seen_at fresh. No-op otherwise.
    func registerDeviceIfPaired(token: String) async {
        let s = Settings.shared
        guard let userId = s.userId else { return }
        let url = URL(string: s.backendURL.trimmingCharacters(in: .init(charactersIn: "/")) + "/api/voice/devices/ios/register")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "user_id": userId,
            "voip_push_token": token,
            "apns_environment": "production",
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await URLSession.shared.data(for: req)
    }
}
