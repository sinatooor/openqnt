import Foundation

struct RiskLimits: Codable, Equatable {
    let maxOrderQty: Int
    let maxPositionNotional: Double
    let maxDrawdownPct: Double
    let maxDailyLossPct: Double
    let panicActive: Bool
    let panicReason: String?

    static let empty = RiskLimits(
        maxOrderQty: 0,
        maxPositionNotional: 0,
        maxDrawdownPct: 0,
        maxDailyLossPct: 0,
        panicActive: false,
        panicReason: nil
    )
}

struct RiskEvent: Codable, Equatable, Identifiable {
    let id: String
    let kind: String          // "limit_breach" | "panic_triggered" | "panic_cleared"
    let message: String
    let symbol: String?
    let occurredAt: Date
}
