import SwiftUI

struct RootTabView: View {
    @EnvironmentObject var auth: AuthStore
    @StateObject private var notifs = NotificationsStore.shared

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            MarketsRootView()
                .tabItem { Label("Markets", systemImage: "chart.line.uptrend.xyaxis") }

            AgentsView()
                .tabItem { Label("Agents", systemImage: "cpu") }

            AIChatView()
                .tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }

            SettingsRootView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .badge(notifs.unreadCount > 0 ? notifs.unreadCount : 0)
        }
        .task {
            await notifs.refresh()
        }
    }
}

/// Wraps the existing voice-pairing SettingsView and adds an account section
/// + notifications + risk panel access.
struct SettingsRootView: View {
    @EnvironmentObject var auth: AuthStore
    @StateObject private var risk = RiskStore.shared
    @StateObject private var notifs = NotificationsStore.shared

    var body: some View {
        NavigationStack {
            List {
                if let user = auth.user {
                    Section("Account") {
                        Text(user.name ?? user.email)
                        Text(user.email).font(.caption).foregroundStyle(.secondary)
                        Button(role: .destructive) {
                            auth.signOut()
                        } label: {
                            Text("Sign out")
                        }
                    }
                }

                Section("Risk & Safety") {
                    NavigationLink {
                        RiskPanelView()
                    } label: {
                        Label("Risk panel", systemImage: "shield.lefthalf.filled")
                            .badge(risk.limits.panicActive ? "PANIC" : "")
                    }
                }

                Section("Notifications") {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        Label("Alerts", systemImage: "bell")
                            .badge(notifs.unreadCount > 0 ? notifs.unreadCount : 0)
                    }
                }

                Section("Voice & Pairing") {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Label("Voice pairing & backend URL", systemImage: "phone.connection")
                    }
                }
            }
            .navigationTitle("Settings")
            .task {
                await risk.refresh()
            }
        }
    }
}
