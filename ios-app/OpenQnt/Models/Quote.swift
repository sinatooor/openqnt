import Foundation

struct Quote: Codable, Equatable, Identifiable {
    let symbol: String
    let last: Double
    let bid: Double?
    let ask: Double?
    let dayChange: Double
    let dayChangePct: Double
    let volume: Double?
    let asOf: Date?

    var id: String { symbol }
}

struct SymbolMatch: Codable, Equatable, Identifiable {
    let symbol: String
    let name: String
    let exchange: String?
    let assetClass: String?

    var id: String { symbol }
}

struct Candle: Codable, Equatable, Identifiable {
    let timestamp: Date
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Double

    var id: Date { timestamp }
}

enum ChartTimeframe: String, CaseIterable, Identifiable {
    case oneDay   = "1d"
    case fiveDay  = "5d"
    case oneMonth = "1mo"
    case sixMonth = "6mo"
    case oneYear  = "1y"
    case fiveYear = "5y"
    case max

    var id: String { rawValue }
    var label: String {
        switch self {
        case .oneDay:   return "1D"
        case .fiveDay:  return "5D"
        case .oneMonth: return "1M"
        case .sixMonth: return "6M"
        case .oneYear:  return "1Y"
        case .fiveYear: return "5Y"
        case .max:      return "MAX"
        }
    }
}
