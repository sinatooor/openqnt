import Foundation
import Combine

@MainActor
final class AgentsStore: ObservableObject {
    static let shared = AgentsStore()

    @Published private(set) var agents: [Agent] = []
    @Published private(set) var runsByAgent: [String: [AgentRun]] = [:]
    @Published private(set) var bossNodes: [BossNode] = []
    @Published var lastError: String?

    private init() {}

    func loadAgents() async {
        do {
            let res: [Agent] = try await APIClient.shared.get(Endpoints.agents)
            self.agents = res
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadRuns(for agentId: String, limit: Int = 30) async {
        do {
            let res: [AgentRun] = try await APIClient.shared.get(
                Endpoints.agentRuns(agentId),
                query: ["limit": String(limit)]
            )
            runsByAgent[agentId] = res
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func start(_ agentId: String) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.postEmpty(Endpoints.startAgent(agentId))
            await loadAgents()
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func stop(_ agentId: String) async {
        do {
            let _: EmptyResponse = try await APIClient.shared.postEmpty(Endpoints.stopAgent(agentId))
            await loadAgents()
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func loadBossRuns(limit: Int = 50) async {
        do {
            let res: [BossNode] = try await APIClient.shared.get(
                Endpoints.bossRuns,
                query: ["limit": String(limit)]
            )
            self.bossNodes = res
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func startBoss() async {
        do {
            let _: EmptyResponse = try await APIClient.shared.postEmpty(Endpoints.bossStart)
            await loadBossRuns()
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
