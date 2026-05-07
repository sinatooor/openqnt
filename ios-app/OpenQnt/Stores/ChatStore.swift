import Foundation
import Combine

/// Chat with the backend AI assistant. Uses SSE streaming if available,
/// falling back to a single-shot POST.
///
/// SSE on iOS is implemented via `URLSession.bytes(for:)` so we don't pull
/// in a third-party SSE lib.
@MainActor
final class ChatStore: ObservableObject {
    static let shared = ChatStore()

    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var sending: Bool = false
    @Published var lastError: String?

    private init() {}

    func loadHistory(limit: Int = 50) async {
        struct Res: Decodable { let messages: [ChatMessage] }
        do {
            let res: Res = try await APIClient.shared.get(
                Endpoints.chatHistory,
                query: ["limit": String(limit)]
            )
            self.messages = res.messages
        } catch {
            self.lastError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func send(_ text: String) async {
        let userMsg = ChatMessage.userMessage(text)
        var assistantMsg = ChatMessage.assistantPlaceholder()
        messages.append(userMsg)
        messages.append(assistantMsg)
        sending = true
        defer { sending = false }

        let base = Settings.shared.backendURL
        guard let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + Endpoints.chatStream) else {
            lastError = "Bad backend URL"
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        if let t = AuthStore.shared.accessToken {
            req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
        }
        struct Req: Encodable { let message: String }
        let body = try? JSONEncoder().encode(Req(message: text))
        req.httpBody = body

        do {
            let (bytes, response) = try await URLSession.shared.bytes(for: req)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw APIError.server(status: (response as? HTTPURLResponse)?.statusCode ?? -1, message: "stream failed")
            }
            for try await line in bytes.lines {
                // SSE frame format: "data: <chunk>\n\n"
                guard line.hasPrefix("data:") else { continue }
                let chunk = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if chunk == "[DONE]" { break }
                assistantMsg.content += chunk
                if let idx = messages.firstIndex(where: { $0.id == assistantMsg.id }) {
                    messages[idx] = assistantMsg
                }
            }
            assistantMsg.isStreaming = false
            if let idx = messages.firstIndex(where: { $0.id == assistantMsg.id }) {
                messages[idx] = assistantMsg
            }
        } catch {
            assistantMsg.content = (assistantMsg.content.isEmpty ? "(failed: " : "\n(failed: ") + error.localizedDescription + ")"
            assistantMsg.isStreaming = false
            if let idx = messages.firstIndex(where: { $0.id == assistantMsg.id }) {
                messages[idx] = assistantMsg
            }
            self.lastError = error.localizedDescription
        }
    }
}
