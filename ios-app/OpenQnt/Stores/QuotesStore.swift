import Foundation
import Combine

@MainActor
final class QuotesStore: ObservableObject {
    static let shared = QuotesStore()

    @Published private(set) var watchlist: [String] = []
    @Published private(set) var quotes: [String: Quote] = [:]
    @Published var lastError: String?

    private var pollTask: Task<Void, Never>?

    private init() {}

    func startPolling(interval: TimeInterval = 4) {
        stopPolling()
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refreshQuotes()
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    func loadWatchlist() async {
        struct WL: Decodable { let symbols: [String] }
        do {
            let wl: WL = try await APIClient.shared.get(Endpoints.watchlist)
            self.watchlist = wl.symbols
            await refreshQuotes()
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func add(symbol: String) async {
        struct Req: Encodable { let symbol: String }
        do {
            let _: EmptyResponse = try await APIClient.shared.post(Endpoints.watchlist, body: Req(symbol: symbol))
            await loadWatchlist()
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func remove(symbol: String) async {
        do {
            try await APIClient.shared.delete(Endpoints.watchlistRemove(symbol))
            self.watchlist.removeAll { $0 == symbol }
            self.quotes[symbol] = nil
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func refreshQuotes() async {
        guard !watchlist.isEmpty else { return }
        struct Req: Encodable { let symbols: [String] }
        struct Res: Decodable { let quotes: [Quote] }
        do {
            let res: Res = try await APIClient.shared.post(Endpoints.quoteBatch, body: Req(symbols: watchlist))
            var next = self.quotes
            for q in res.quotes { next[q.symbol] = q }
            self.quotes = next
            self.lastError = nil
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func search(_ q: String) async -> [SymbolMatch] {
        guard !q.isEmpty else { return [] }
        struct Res: Decodable { let matches: [SymbolMatch] }
        do {
            let res: Res = try await APIClient.shared.get(Endpoints.symbolSearch, query: ["q": q])
            return res.matches
        } catch {
            return []
        }
    }

    func candles(_ symbol: String, timeframe: ChartTimeframe) async -> [Candle] {
        struct Res: Decodable { let candles: [Candle] }
        do {
            let res: Res = try await APIClient.shared.get(
                Endpoints.candles(symbol),
                query: ["range": timeframe.rawValue]
            )
            return res.candles
        } catch {
            return []
        }
    }
}
