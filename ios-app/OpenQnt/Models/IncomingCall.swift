import Foundation

struct IncomingCall: Identifiable, Equatable {
    let id: UUID = UUID()             // CXCall identifier
    let callId: String                // backend voice_calls.id
    let openingMessage: String
    let wsUrl: String                 // wss:// URL to the audio bridge
    let receivedAt: Date = Date()
}
