import SwiftUI

struct SymbolDetailView: View {
    let symbol: String

    @StateObject private var store = QuotesStore.shared
    @State private var candles: [Candle] = []
    @State private var timeframe: ChartTimeframe = .oneMonth
    @State private var loading = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                quoteHeader
                ChartTimeframePicker(selected: $timeframe)
                    .padding(.horizontal)
                CandleChartView(candles: candles)
                    .frame(height: 240)
                    .padding(.horizontal)
                if loading { ProgressView().padding() }
                actionRow
                Divider().padding(.vertical, 8)
                Text("News")
                    .font(.headline)
                    .padding(.horizontal)
                Text("News & fundamentals are available in the desktop app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle(symbol)
        .task(id: timeframe) { await loadCandles() }
        .task { await loadCandles() }
    }

    private var quoteHeader: some View {
        let q = store.quotes[symbol]
        return VStack(alignment: .leading, spacing: 4) {
            Text(symbol).font(.largeTitle.bold())
            if let q = q {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(q.last, format: .currency(code: "USD"))
                        .font(.title2.weight(.semibold))
                    Text("\(q.dayChange, format: .currency(code: "USD")) (\(q.dayChangePct, format: .number.precision(.fractionLength(2)))%)")
                        .font(.callout)
                        .foregroundStyle(q.dayChange >= 0 ? .green : .red)
                }
            } else {
                Text("Loading…").foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal)
    }

    private var actionRow: some View {
        HStack {
            Button {
                Task { await store.add(symbol: symbol) }
            } label: {
                Label("Add to watchlist", systemImage: "star")
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding(.horizontal)
    }

    private func loadCandles() async {
        loading = true
        candles = await store.candles(symbol, timeframe: timeframe)
        loading = false
    }
}
