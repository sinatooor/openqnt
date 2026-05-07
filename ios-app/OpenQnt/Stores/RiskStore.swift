import Foundation
import Combine

@MainActor
final class RiskStore: ObservableObject {
    static let shared = RiskStore()

    @Published private(set) var limits: RiskLimits = .empty
    @Published private(set) var events: [RiskEvent] = []
    @Published var lastError: String?

    private init() {}

    func refresh() async {
        do {
            let limits: RiskLimits = try await APIClient.shared.get(Endpoints.riskLimits)
            self.limits = limits
            let events: [RiskEvent] = try await APIClient.shared.get(
                Endpoints.riskEvents,
                query: ["limit": "100"]
            )
            self.events = events
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// PANIC STOP — closes everything. Caller must double-confirm.
    func panic(reason: String) async -> Bool {
        struct Req: Encodable { let reason: String }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(Endpoints.panic, body: Req(reason: reason))
            await refresh()
            return true
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }
}
