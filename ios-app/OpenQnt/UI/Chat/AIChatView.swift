import SwiftUI

struct AIChatView: View {
    @StateObject private var store = ChatStore.shared
    @State private var input = ""
    @FocusState private var inputFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(store.messages) { msg in
                                ChatBubble(message: msg)
                                    .id(msg.id)
                            }
                            if store.messages.isEmpty {
                                emptyState
                            }
                        }
                        .padding()
                    }
                    .onChange(of: store.messages.count) { _, _ in
                        if let last = store.messages.last {
                            withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                        }
                    }
                }

                Divider()
                inputBar
            }
            .navigationTitle("Assistant")
            .task {
                await store.loadHistory()
            }
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Ask anything")
                .font(.headline)
            Text("Try: \u{201C}what\u{2019}s the macro setup for AAPL today?\u{201D} or \u{201C}backtest a 50/200 SMA crossover on TSLA.\u{201D}")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Message", text: $input, axis: .vertical)
                .lineLimit(1...4)
                .padding(8)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
                .focused($inputFocused)
                .submitLabel(.send)
                .onSubmit { send() }

            Button {
                send()
            } label: {
                Image(systemName: "paperplane.fill")
                    .padding(8)
                    .background(Color.accentColor, in: Circle())
                    .foregroundStyle(.white)
            }
            .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || store.sending)
        }
        .padding()
    }

    private func send() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        input = ""
        Task { await store.send(text) }
    }
}
