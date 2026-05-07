import Foundation

/// Single source of truth for backend route paths. Any new endpoint added
/// should land here first so the rest of the app references a constant
/// rather than scattering literals.
enum Endpoints {
    // MARK: - Auth
    static let authLogin = "/auth/login"
    static let authRegister = "/auth/register"
    static let authRefresh = "/auth/refresh"
    static let authMe = "/auth/me"

    // MARK: - Portfolio
    static let portfolio = "/api/portfolio/snapshot"
    static let portfolioHistory = "/api/portfolio/history"
    static func positionDetail(_ symbol: String) -> String {
        return "/api/portfolio/positions/\(symbol)"
    }
    static let closePosition = "/api/execution/close-position"

    // MARK: - Markets
    static func quote(_ symbol: String) -> String {
        return "/api/symbols/quote/\(symbol)"
    }
    static let quoteBatch = "/api/symbols/quote/batch"
    static let symbolSearch = "/api/symbols/search"
    static func candles(_ symbol: String) -> String {
        return "/api/symbols/candles/\(symbol)"
    }
    static func symbolNews(_ symbol: String) -> String {
        return "/api/symbols/news/\(symbol)"
    }

    // MARK: - Watchlist
    static let watchlist = "/api/watchlist"
    static func watchlistRemove(_ symbol: String) -> String {
        return "/api/watchlist/\(symbol)"
    }

    // MARK: - Strategies / Agents
    static let agents = "/api/agents"
    static func agentDetail(_ id: String) -> String {
        return "/api/agents/\(id)"
    }
    static func agentRuns(_ id: String) -> String {
        return "/api/agents/\(id)/runs"
    }
    static func startAgent(_ id: String) -> String {
        return "/api/agents/\(id)/start"
    }
    static func stopAgent(_ id: String) -> String {
        return "/api/agents/\(id)/stop"
    }

    // MARK: - Boss
    static let bossRuns = "/api/boss/runs"
    static let bossStart = "/api/boss/start"

    // MARK: - Chat
    static let chatMessage = "/api/agent-chat/message"
    static let chatStream = "/api/agent-chat/stream"
    static let chatHistory = "/api/agent-chat/history"

    // MARK: - Risk
    static let riskLimits = "/api/execution/risk/limits"
    static let panic = "/api/execution/panic"
    static let riskEvents = "/api/execution/risk/events"

    // MARK: - Notifications & device registration
    static let registerDevice = "/api/notifications/devices/ios/register"
    static let notifications = "/api/notifications/feed"
    static func markRead(_ id: String) -> String {
        return "/api/notifications/\(id)/read"
    }

    // MARK: - Backtest
    static let backtest = "/api/backtest"

    // MARK: - Templates / strategies catalog
    static let strategyTemplates = "/api/templates"

    // MARK: - Health (liveness check used by sign-in to verify URL)
    static let health = "/health"
}
