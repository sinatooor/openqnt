import Foundation

struct ChatMessage: Codable, Equatable, Identifiable {
    enum Role: String, Codable, Equatable { case user, assistant, system, tool }

    let id: String
    let role: Role
    var content: String
    let createdAt: Date
    /// True while the assistant is still streaming tokens into `content`.
    var isStreaming: Bool = false

    static func userMessage(_ text: String) -> ChatMessage {
        return .init(id: UUID().uuidString, role: .user, content: text, createdAt: Date())
    }

    static func assistantPlaceholder() -> ChatMessage {
        return .init(id: UUID().uuidString, role: .assistant, content: "", createdAt: Date(), isStreaming: true)
    }
}
