import SwiftUI

struct NotificationsView: View {
    @StateObject private var store = NotificationsStore.shared

    var body: some View {
        List {
            if store.feed.isEmpty {
                Text("No alerts yet.").foregroundStyle(.secondary)
            }
            ForEach(store.feed) { alert in
                NotificationItem(alert: alert)
                    .listRowBackground(alert.read ? AnyShapeStyle(Color.clear) : AnyShapeStyle(Color.accentColor.opacity(0.05)))
                    .onTapGesture {
                        Task { await store.markRead(alert.id) }
                    }
            }
        }
        .navigationTitle("Alerts")
        .refreshable { await store.refresh() }
        .task { await store.refresh() }
    }
}

struct NotificationItem: View {
    let alert: AlertEvent

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .font(.title3)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.title).font(.subheadline.weight(.medium))
                Text(alert.body).font(.caption).foregroundStyle(.secondary)
                Text(alert.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            if !alert.read {
                Circle().fill(Color.accentColor).frame(width: 8, height: 8)
            }
        }
        .padding(.vertical, 4)
    }

    private var icon: String {
        switch alert.kind {
        case .trade: return "arrow.left.arrow.right"
        case .riskBreach, .panicTriggered: return "exclamationmark.octagon"
        case .strategyAlert: return "bolt.fill"
        case .news: return "newspaper"
        case .other: return "bell"
        }
    }

    private var color: Color {
        switch alert.kind {
        case .trade: return .blue
        case .riskBreach, .panicTriggered: return .red
        case .strategyAlert: return .yellow
        case .news: return .gray
        case .other: return .accentColor
        }
    }
}
