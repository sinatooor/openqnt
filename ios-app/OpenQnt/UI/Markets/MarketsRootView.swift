import SwiftUI

struct MarketsRootView: View {
    @State private var tab: Int = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    Text("Watchlist").tag(0)
                    Text("Portfolio").tag(1)
                    Text("Screener").tag(2)
                }
                .pickerStyle(.segmented)
                .padding([.horizontal, .top])

                switch tab {
                case 0: WatchlistView()
                case 1: PortfolioView()
                default: ScreenerView()
                }
            }
            .navigationTitle("Markets")
        }
    }
}

struct ScreenerView: View {
    var body: some View {
        // The web app's screener is a heavy desktop surface — on iOS we ship a
        // minimal "popular screens" launcher rather than rebuilding the form
        // wholesale. Hooks back into backend templates router.
        List {
            Section("Quick screens") {
                ScreenLink(title: "Top US gainers (1d)", path: "screens/us/top-gainers")
                ScreenLink(title: "Most active by volume", path: "screens/us/most-active")
                ScreenLink(title: "New 52-week highs", path: "screens/us/52w-high")
                ScreenLink(title: "Earnings this week", path: "screens/us/earnings-week")
            }
        }
    }
}

private struct ScreenLink: View {
    let title: String
    let path: String

    @State private var matches: [SymbolMatch] = []
    @State private var loading = false

    var body: some View {
        NavigationLink {
            List(matches) { m in
                NavigationLink {
                    SymbolDetailView(symbol: m.symbol)
                } label: {
                    VStack(alignment: .leading) {
                        Text(m.symbol).font(.headline)
                        Text(m.name).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle(title)
            .overlay {
                if loading { ProgressView() }
            }
            .task {
                if matches.isEmpty {
                    loading = true
                    matches = await QuotesStore.shared.search(path)
                    loading = false
                }
            }
        } label: {
            Text(title)
        }
    }
}
