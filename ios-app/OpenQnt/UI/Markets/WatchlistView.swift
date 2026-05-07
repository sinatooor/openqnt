import SwiftUI

struct WatchlistView: View {
    @StateObject private var store = QuotesStore.shared
    @State private var showAddSheet = false

    var body: some View {
        List {
            if store.watchlist.isEmpty {
                Section {
                    Text("Your watchlist is empty.")
                        .foregroundStyle(.secondary)
                    Button {
                        showAddSheet = true
                    } label: {
                        Label("Add a symbol", systemImage: "plus.circle")
                    }
                }
            } else {
                ForEach(store.watchlist, id: \.self) { sym in
                    NavigationLink {
                        SymbolDetailView(symbol: sym)
                    } label: {
                        WatchlistRow(symbol: sym, quote: store.quotes[sym])
                    }
                }
                .onDelete { idx in
                    let symbols = idx.map { store.watchlist[$0] }
                    Task { for s in symbols { await store.remove(symbol: s) } }
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .refreshable { await store.refreshQuotes() }
        .sheet(isPresented: $showAddSheet) {
            AddSymbolSheet()
        }
        .task {
            await store.loadWatchlist()
            store.startPolling(interval: 4)
        }
        .onDisappear { store.stopPolling() }
    }
}

struct WatchlistRow: View {
    let symbol: String
    let quote: Quote?

    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(symbol).font(.headline)
                if let q = quote {
                    Text(q.last, format: .currency(code: "USD"))
                        .font(.subheadline)
                } else {
                    Text("—").foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let q = quote {
                VStack(alignment: .trailing) {
                    Text(q.dayChange, format: .currency(code: "USD"))
                        .foregroundStyle(q.dayChange >= 0 ? .green : .red)
                        .font(.caption)
                    Text("\(q.dayChangePct, format: .number.precision(.fractionLength(2)))%")
                        .foregroundStyle(q.dayChange >= 0 ? .green : .red)
                        .font(.caption)
                }
            }
        }
    }
}
