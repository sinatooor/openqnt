import Foundation

struct Agent: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let kind: String         // "boss" | "quant" | other
    let status: String       // "idle" | "running" | "error"
    let lastRunAt: Date?
    let totalRuns: Int
}

struct AgentRun: Codable, Equatable, Identifiable {
    let id: String           // run_id
    let agentId: String
    let status: String       // "running" | "succeeded" | "failed"
    let startedAt: Date
    let endedAt: Date?
    let summary: String?
    let metrics: [String: Double]?
}

struct BossNode: Codable, Equatable, Identifiable {
    let id: String
    let parentId: String?
    let label: String
    let createdAt: Date
    let summary: String?
    let metrics: [String: Double]?
    let children: [BossNode]?
}
