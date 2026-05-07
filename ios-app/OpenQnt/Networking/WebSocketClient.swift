import Foundation

/// Minimal WebSocket wrapper for live quotes + chat streaming.
///
/// Built on `URLSessionWebSocketTask` (no third-party deps). Reconnects with
/// exponential backoff up to 30s when the connection drops. Each instance is
/// single-purpose — instantiate per stream.
@MainActor
final class WebSocketClient: ObservableObject {
    enum State: Equatable { case idle, connecting, connected, disconnected(reason: String) }

    @Published private(set) var state: State = .idle
    private var task: URLSessionWebSocketTask?
    private var session: URLSession
    private let url: URL
    private var receiveLoop: Task<Void, Never>?
    private var reconnectAttempt: Int = 0
    private var shouldReconnect: Bool = true

    /// Caller-provided handler for inbound text frames.
    var onText: ((String) -> Void)?
    /// Optional handler for inbound binary frames (e.g. PCM audio).
    var onData: ((Data) -> Void)?

    init(url: URL) {
        self.url = url
        self.session = URLSession(configuration: .default)
    }

    func connect(authToken: String?) {
        shouldReconnect = true
        startConnection(authToken: authToken)
    }

    func send(_ text: String) async throws {
        guard let task = task, state == .connected else { return }
        try await task.send(.string(text))
    }

    func sendData(_ data: Data) async throws {
        guard let task = task, state == .connected else { return }
        try await task.send(.data(data))
    }

    func disconnect() {
        shouldReconnect = false
        receiveLoop?.cancel()
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        state = .idle
    }

    // MARK: - Internals

    private func startConnection(authToken: String?) {
        state = .connecting
        var req = URLRequest(url: url)
        if let token = authToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let t = session.webSocketTask(with: req)
        self.task = t
        t.resume()
        state = .connected
        reconnectAttempt = 0
        receiveLoop?.cancel()
        receiveLoop = Task { [weak self] in
            await self?.runReceiveLoop()
        }
    }

    private func runReceiveLoop() async {
        guard let task = task else { return }
        while !Task.isCancelled {
            do {
                let msg = try await task.receive()
                switch msg {
                case .string(let s): onText?(s)
                case .data(let d): onData?(d)
                @unknown default: break
                }
            } catch {
                let reason = (error as NSError).localizedDescription
                state = .disconnected(reason: reason)
                if shouldReconnect { await scheduleReconnect() }
                return
            }
        }
    }

    private func scheduleReconnect() async {
        reconnectAttempt += 1
        let delay = min(30.0, pow(1.6, Double(reconnectAttempt)))
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        if shouldReconnect {
            startConnection(authToken: AuthStore.shared.accessTokenSync)
        }
    }
}
