import SwiftUI

struct AddSymbolSheet: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var store = QuotesStore.shared

    @State private var query = ""
    @State private var matches: [SymbolMatch] = []
    @State private var searching = false

    var body: some View {
        NavigationStack {
            VStack {
                TextField("Search symbol (e.g. AAPL, MSFT)", text: $query)
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))
                    .padding()
                    .onChange(of: query) { _, q in
                        Task {
                            searching = true
                            matches = await store.search(q)
                            searching = false
                        }
                    }

                List {
                    if searching && matches.isEmpty {
                        ProgressView()
                    }
                    ForEach(matches) { m in
                        Button {
                            Task {
                                await store.add(symbol: m.symbol)
                                dismiss()
                            }
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(m.symbol).font(.headline)
                                    Text(m.name).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if let exch = m.exchange {
                                    Text(exch).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .navigationTitle("Add to watchlist")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
