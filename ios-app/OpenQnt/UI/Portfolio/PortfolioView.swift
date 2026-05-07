import SwiftUI

struct PortfolioView: View {
    @StateObject private var store = PortfolioStore.shared

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Text("Cash")
                        Spacer()
                        Text(store.snapshot.cash, format: .currency(code: "USD"))
                    }
                    HStack {
                        Text("Equity")
                        Spacer()
                        Text(store.snapshot.totalEquity, format: .currency(code: "USD"))
                    }
                    HStack {
                        Text("Day P&L")
                        Spacer()
                        Text(store.snapshot.dayPnl, format: .currency(code: "USD"))
                            .foregroundStyle(store.snapshot.dayPnl >= 0 ? .green : .red)
                    }
                }

                Section("Positions (\(store.snapshot.positions.count))") {
                    if store.snapshot.positions.isEmpty {
                        Text("No open positions.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.snapshot.positions) { pos in
                        NavigationLink {
                            PositionDetailView(position: pos)
                        } label: {
                            PositionRow(pos: pos)
                                .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Portfolio")
            .refreshable { await store.refresh() }
            .task {
                await store.refresh()
                store.startPolling(interval: 6)
            }
            .onDisappear { store.stopPolling() }
        }
    }
}
