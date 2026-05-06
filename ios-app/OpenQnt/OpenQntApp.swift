import SwiftUI
import PushKit
import CallKit

@main
struct OpenQntApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var settings = Settings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(CallManager.shared)
        }
    }
}

/// Entry view — when no call is active, show settings/pairing. The
/// CallKit incoming UI is rendered by iOS itself; our SwiftUI in-call
/// surface is presented full-screen by `CallManager` once answered.
struct RootView: View {
    @EnvironmentObject var settings: Settings
    @EnvironmentObject var callManager: CallManager

    var body: some View {
        ZStack {
            if let call = callManager.activeCall {
                InCallView(call: call)
            } else {
                SettingsView()
            }
        }
    }
}
