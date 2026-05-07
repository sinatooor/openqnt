import SwiftUI

struct RiskPanelView: View {
    @StateObject private var store = RiskStore.shared
    @State private var confirm1 = false
    @State private var confirm2 = false
    @State private var firing = false

    var body: some View {
        List {
            Section("Limits") {
                LabeledContent("Max order qty", value: "\(store.limits.maxOrderQty)")
                LabeledContent("Max position notional") {
                    Text(store.limits.maxPositionNotional, format: .currency(code: "USD"))
                }
                LabeledContent("Max drawdown",  value: "\(store.limits.maxDrawdownPct, format: .number.precision(.fractionLength(1)))%")
                LabeledContent("Max daily loss", value: "\(store.limits.maxDailyLossPct, format: .number.precision(.fractionLength(1)))%")
            }

            Section {
                if store.limits.panicActive {
                    Label("Panic stop is ACTIVE", systemImage: "exclamationmark.octagon.fill")
                        .foregroundStyle(.red)
                    if let r = store.limits.panicReason {
                        Text("Reason: \(r)").font(.caption)
                    }
                } else {
                    Button(role: .destructive) {
                        confirm1 = true
                    } label: {
                        if firing {
                            ProgressView()
                        } else {
                            Label("PANIC STOP — flatten all positions", systemImage: "exclamationmark.octagon")
                        }
                    }
                    .disabled(firing)
                }
            }

            Section("Recent risk events") {
                if store.events.isEmpty {
                    Text("No events.").foregroundStyle(.secondary)
                }
                ForEach(store.events) { e in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(e.kind.replacingOccurrences(of: "_", with: " ").capitalized).font(.subheadline.weight(.medium))
                        Text(e.message).font(.caption)
                        Text(e.occurredAt, format: .relative(presentation: .named)).font(.caption2).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .navigationTitle("Risk")
        .refreshable { await store.refresh() }
        .task { await store.refresh() }
        .alert("Are you sure?", isPresented: $confirm1) {
            Button("Continue", role: .destructive) { confirm2 = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Panic stop will close every open position and halt all running strategies. This cannot be undone from the app.")
        }
        .alert("Confirm PANIC STOP", isPresented: $confirm2) {
            Button("Yes, panic stop", role: .destructive) {
                Task {
                    firing = true
                    _ = await store.panic(reason: "iOS panic stop")
                    firing = false
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Last chance — this will hit the live execution endpoint immediately.")
        }
    }
}
