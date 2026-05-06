import UIKit
import PushKit
import CallKit

/// Owns the PushKit registry and forwards every VoIP push to CallManager.
///
/// CRITICAL: every VoIP push MUST result in a CallKit `reportNewIncomingCall`
/// almost immediately. iOS will terminate apps that take a push and don't
/// ring. Keep the work here minimal and synchronous.
final class AppDelegate: NSObject, UIApplicationDelegate, PKPushRegistryDelegate {
    var registry: PKPushRegistry!

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        return true
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
