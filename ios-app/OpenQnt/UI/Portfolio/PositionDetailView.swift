import SwiftUI

struct PositionDetailView: View {
    let position: Position
    @StateObject private var store = PortfolioStore.shared
    @State private var confirmClose = false
    @State private var closing = false

    var body: some View {
        List {
            Section {
                LabeledContent("Symbol", value: position.symbol)
                LabeledContent("Side", value: position.side.uppercased())
                LabeledContent("Qty", value: position.qty.formatted())
                LabeledContent("Avg cost") {
                    Text(position.avgCost, format: .currency(code: "USD"))
                }
                LabeledContent("Last") {
                    Text(position.lastPrice, format: .currency(code: "USD"))
                }
                LabeledContent("Market value") {
                    Text(position.marketValue, format: .currency(code: "USD"))
                }
                LabeledContent("Unrealized P&L") {
                    Text(position.unrealizedPnl, format: .currency(code: "USD"))
                        .foregroundStyle(position.unrealizedPnl >= 0 ? .green : .red)
                }
            }

            Section {
                NavigationLink {
                    SymbolDetailView(symbol: position.symbol)
                } label: {
                    Label("View chart & news", systemImage: "chart.bar")
                }
            }

            Section {
                Button(role: .destructive) {
                    confirmClose = true
                } label: {
                    if closing {
                        ProgressView()
                    } else {
                        Label("Close position", systemImage: "xmark.circle")
                    }
                }
                .disabled(closing)
            }
        }
        .navigationTitle(position.symbol)
        .alert("Close \(position.symbol)?", isPresented: $confirmClose) {
            Button("Close position", role: .destructive) {
                Task {
                    closing = true
                    _ = await store.closePosition(symbol: position.symbol)
                    closing = false
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will submit a market order to flatten \(position.qty.formatted()) shares of \(position.symbol).")
        }
    }
}
