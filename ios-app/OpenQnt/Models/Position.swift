import Foundation

struct PortfolioSnapshot: Codable, Equatable {
    let totalEquity: Double
    let cash: Double
    let unrealizedPnl: Double
    let realizedPnl: Double
    let dayPnl: Double
    let dayPnlPct: Double
    let positions: [Position]
    let asOf: Date

    static let empty = PortfolioSnapshot(
        totalEquity: 0, cash: 0, unrealizedPnl: 0, realizedPnl: 0,
        dayPnl: 0, dayPnlPct: 0, positions: [], asOf: Date()
    )
}

struct Position: Codable, Equatable, Identifiable {
    let symbol: String
    let qty: Double
    let avgCost: Double
    let lastPrice: Double
    let marketValue: Double
    let unrealizedPnl: Double
    let unrealizedPnlPct: Double
    let side: String   // "long" | "short"

    var id: String { symbol }

    var pnlSign: Int {
        if unrealizedPnl > 0 { return 1 }
        if unrealizedPnl < 0 { return -1 }
        return 0
    }
}

struct EquityPoint: Codable, Equatable, Identifiable {
    let timestamp: Date
    let equity: Double

    var id: Date { timestamp }
}
