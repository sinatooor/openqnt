import SwiftUI
import PushKit
import CallKit

@main
struct OpenQntApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var settings = Settings.shared
    @StateObject private var auth = AuthStore.shared
    @StateObject private var callManager = CallManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(auth)
                .environmentObject(callManager)
        }
    }
}

/// Top-level routing:
///   - Active call → InCallView (overlays everything; CallKit also runs its UI)
///   - Not authed → LoginView
///   - Authed     → RootTabView (full power-user shell)
struct RootView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var callManager: CallManager

    var body: some View {
        ZStack {
            if let call = callManager.activeCall {
                InCallView(call: call)
            } else if !auth.isAuthed {
                LoginView()
            } else {
                RootTabView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.isAuthed)
        .animation(.easeInOut(duration: 0.2), value: callManager.activeCall != nil)
    }
}
