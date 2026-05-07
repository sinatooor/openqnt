import SwiftUI

struct DashboardView: View {
    @StateObject private var portfolio = PortfolioStore.shared
    @StateObject private var notifs = NotificationsStore.shared

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    pnlCard
                    EquityCurveChart(points: portfolio.equityHistory)
                        .frame(height: 180)
                        .padding(.horizontal)

                    sectionHeader("Top positions")
                    LazyVStack(spacing: 8) {
                        ForEach(portfolio.snapshot.positions.prefix(5)) { pos in
                            PositionRow(pos: pos)
                        }
                    }
                    .padding(.horizontal)

                    sectionHeader("Recent alerts")
                    LazyVStack(spacing: 8) {
                        ForEach(notifs.feed.prefix(4)) { alert in
                            NotificationItem(alert: alert)
                        }
                        if notifs.feed.isEmpty {
                            Text("No alerts.")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("Overview")
            .refreshable {
                await portfolio.refresh()
                await notifs.refresh()
            }
            .task {
                portfolio.startPolling(interval: 6)
                await portfolio.loadEquityHistory(days: 30)
                await notifs.refresh()
            }
            .onDisappear { portfolio.stopPolling() }
        }
    }

    private var pnlCard: some View {
        let snap = portfolio.snapshot
        return VStack(alignment: .leading, spacing: 6) {
            Text("Total equity")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(snap.totalEquity, format: .currency(code: "USD"))
                .font(.system(size: 36, weight: .semibold, design: .rounded))
            HStack(spacing: 12) {
                pnlChip(label: "Day", value: snap.dayPnl, pct: snap.dayPnlPct)
                pnlChip(label: "Unrealized", value: snap.unrealizedPnl, pct: nil)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal)
    }

    private func pnlChip(label: String, value: Double, pct: Double?) -> some View {
        let color: Color = value >= 0 ? .green : .red
        return VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            HStack(spacing: 4) {
                Text(value, format: .currency(code: "USD"))
                    .foregroundStyle(color)
                    .font(.callout.weight(.medium))
                if let pct = pct {
                    Text("(\(pct, format: .number.precision(.fractionLength(2)))%)")
                        .font(.caption)
                        .foregroundStyle(color)
                }
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.headline)
            .padding(.horizontal)
            .padding(.top, 8)
    }
}

struct PositionRow: View {
    let pos: Position

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(pos.symbol).font(.headline)
                Text("\(pos.qty, format: .number) @ \(pos.avgCost, format: .currency(code: "USD"))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(pos.lastPrice, format: .currency(code: "USD"))
                    .font(.subheadline.weight(.medium))
                Text(pos.unrealizedPnl, format: .currency(code: "USD"))
                    .font(.caption)
                    .foregroundStyle(pos.unrealizedPnl >= 0 ? .green : .red)
            }
        }
        .padding(12)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
    }
}
