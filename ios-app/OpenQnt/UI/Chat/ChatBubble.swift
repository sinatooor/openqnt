import SwiftUI

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 40) }
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content.isEmpty && message.isStreaming ? "…" : message.content)
                    .padding(10)
                    .background(bubbleBackground, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(message.role == .user ? .white : .primary)
                if message.isStreaming {
                    Text("Streaming…").font(.caption2).foregroundStyle(.secondary)
                }
            }
            if message.role != .user { Spacer(minLength: 40) }
        }
    }

    private var bubbleBackground: AnyShapeStyle {
        switch message.role {
        case .user:      return AnyShapeStyle(Color.accentColor)
        case .assistant: return AnyShapeStyle(.thinMaterial)
        case .system:    return AnyShapeStyle(Color.gray.opacity(0.2))
        case .tool:      return AnyShapeStyle(Color.orange.opacity(0.2))
        }
    }
}
