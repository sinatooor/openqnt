import Foundation
import Combine

@MainActor
final class NotificationsStore: ObservableObject {
    static let shared = NotificationsStore()

    @Published private(set) var feed: [AlertEvent] = []
    @Published private(set) var unreadCount: Int = 0
    @Published var lastError: String?

    private init() {}

    func refresh() async {
        struct Res: Decodable { let alerts: [AlertEvent]; let unread: Int }
        do {
            let res: Res = try await APIClient.shared.get(Endpoints.notifications)
            self.feed = res.alerts
            self.unreadCount = res.unread
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func markRead(_ id: String) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.postEmpty(Endpoints.markRead(id))
            if let idx = feed.firstIndex(where: { $0.id == id }), !feed[idx].read {
                let cur = feed[idx]
                feed[idx] = AlertEvent(
                    id: cur.id,
                    kind: cur.kind,
                    title: cur.title,
                    body: cur.body,
                    createdAt: cur.createdAt,
                    read: true,
                    deepLink: cur.deepLink
                )
                unreadCount = max(0, unreadCount - 1)
            }
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Called from AppDelegate when APNs hands us a device token.
    func registerDeviceToken(_ token: Data) async {
        struct Req: Encodable {
            let userId: String
            let apnsToken: String
            let environment: String
        }
        guard let userId = AuthStore.shared.user?.id else { return }
        let hex = token.map { String(format: "%02x", $0) }.joined()
        do {
            let _: EmptyResponse = try await APIClient.shared.post(
                Endpoints.registerDevice,
                body: Req(
                    userId: userId,
                    apnsToken: hex,
                    environment: "production"
                )
            )
        } catch {
            // Silent — device registration is best-effort.
        }
    }
}
