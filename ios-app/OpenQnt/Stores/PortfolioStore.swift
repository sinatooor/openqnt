import Foundation
import Combine

@MainActor
final class PortfolioStore: ObservableObject {
    static let shared = PortfolioStore()

    @Published private(set) var snapshot: PortfolioSnapshot = .empty
    @Published private(set) var equityHistory: [EquityPoint] = []
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var loading: Bool = false
    @Published var lastError: String?

    private var pollTask: Task<Void, Never>?

    private init() {}

    func startPolling(interval: TimeInterval = 5) {
        stopPolling()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let snap: PortfolioSnapshot = try await APIClient.shared.get(Endpoints.portfolio)
            self.snapshot = snap
            self.lastUpdated = Date()
            self.lastError = nil
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadEquityHistory(days: Int = 30) async {
        do {
            let pts: [EquityPoint] = try await APIClient.shared.get(
                Endpoints.portfolioHistory,
                query: ["days": String(days)]
            )
            self.equityHistory = pts
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Close a single position. Confirmation should happen at the call site.
    func closePosition(symbol: String) async -> Bool {
        struct Req: Encodable { let symbol: String }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(Endpoints.closePosition, body: Req(symbol: symbol))
            await refresh()
            return true
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            return false
        }
    }
}
