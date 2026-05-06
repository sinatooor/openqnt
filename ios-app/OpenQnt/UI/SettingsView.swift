import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: Settings
    @State private var pairingToken: String = ""
    @State private var status: String = ""
    @State private var working: Bool = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Backend") {
                    TextField("Backend URL", text: $settings.backendURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }
                Section("Pairing") {
                    TextField("Pairing token from web profile", text: $pairingToken)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.system(.body, design: .monospaced))
                    Button {
                        Task { await pair() }
                    } label: {
                        HStack {
                            if working { ProgressView() }
                            Text("Pair this device")
                        }
                    }
                    .disabled(pairingToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || working)
                    if !status.isEmpty {
                        Text(status).font(.caption).foregroundStyle(.secondary)
                    }
                }
                Section("Device") {
                    LabeledContent("Paired user", value: settings.userId ?? "—")
                    LabeledContent("VoIP push token") {
                        Text(settings.voipPushToken?.prefix(12).appending("…") ?? "pending")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("OpenQnt")
        }
    }

    private func pair() async {
        working = true; defer { working = false }
        do {
            try await settings.pair(with: pairingToken.trimmingCharacters(in: .whitespacesAndNewlines))
            status = "✓ Paired"
            pairingToken = ""
        } catch {
            status = error.localizedDescription
        }
    }
}
