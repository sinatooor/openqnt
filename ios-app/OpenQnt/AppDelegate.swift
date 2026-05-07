import UIKit
import PushKit
import CallKit
import UserNotifications

/// Owns the PushKit registry (VoIP) AND the standard UNUserNotificationCenter
/// (alerts) — forwards each push to the appropriate handler.
///
/// CRITICAL: every VoIP push MUST result in a CallKit `reportNewIncomingCall`
/// almost immediately. iOS will terminate apps that take a push and don't
/// ring. Keep the work in `pushRegistry(:didReceiveIncomingPushWith:)`
/// minimal and synchronous.
final class AppDelegate: NSObject, UIApplicationDelegate, PKPushRegistryDelegate, UNUserNotificationCenterDelegate {
    var registry: PKPushRegistry!

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]

        // Standard remote-notification path for trade/risk/alert pushes.
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
        return true
    }

    // MARK: - Remote (APNs) notifications for alerts

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { await NotificationsStore.shared.registerDeviceToken(deviceToken) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Silent — APNs registration is best-effort.
    }

    /// Show banner + play sound while the app is foregrounded.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
                                @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .badge])
    }

    /// Tap-to-open: refresh the alert feed; the deep-link payload is read by
    /// the SwiftUI side via NotificationsStore.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        Task {
            await NotificationsStore.shared.refresh()
            completionHandler()
        }
    }

    // MARK: - PKPushRegistryDelegate

    func pushRegistry(_ registry: PKPushRegistry,
                      didUpdate pushCredentials: PKPushCredentials,
                      for type: PKPushType) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        Settings.shared.voipPushToken = token
        Task { await BackendClient.shared.registerDeviceIfPaired(token: token) }
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didInvalidatePushTokenFor type: PKPushType) {
        if type == .voIP {
            Settings.shared.voipPushToken = nil
        }
    }

    func pushRegistry(_ registry: PKPushRegistry,
                      didReceiveIncomingPushWith payload: PKPushPayload,
                      for type: PKPushType,
                      completion: @escaping () -> Void) {
        guard type == .voIP else { completion(); return }
        let dict = payload.dictionaryPayload
        guard
            let callId = dict["call_id"] as? String,
            let opening = dict["opening_message"] as? String,
            let wsUrl = dict["ws_url"] as? String
        else {
            // Apple kills us if we don't ring — surface a generic "incoming"
            // so the OS sees the report, then bail.
            CallManager.shared.reportSyntheticCall(reason: "malformed VoIP payload")
            completion()
            return
        }
        let call = IncomingCall(callId: callId, openingMessage: opening, wsUrl: wsUrl)
        CallManager.shared.reportIncomingCall(call) {
            completion()
        }
    }
}
