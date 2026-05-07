import Foundation

struct AlertEvent: Codable, Equatable, Identifiable {
    enum Kind: String, Codable, Equatable {
        case trade
        case riskBreach   = "risk_breach"
        case panicTriggered = "panic_triggered"
        case strategyAlert = "strategy_alert"
        case news
        case other
    }

    let id: String
    let kind: Kind
    let title: String
    let body: String
    let createdAt: Date
    let read: Bool
    let deepLink: String?     // e.g. "openqnt://markets/AAPL"
}
