import Foundation

struct User: Codable, Equatable, Identifiable {
    let id: String
    let email: String
    let name: String?
}
