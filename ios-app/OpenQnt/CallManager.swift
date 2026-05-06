import Foundation
import CallKit
import AVFoundation
import Combine

/// CallKit bridge: reports incoming calls to iOS, answers them, and starts
/// the WebRTC pipe via `CallController`. One instance for the whole app.
final class CallManager: NSObject, ObservableObject, CXProviderDelegate {
    static let shared = CallManager()

    private let provider: CXProvider
    private let controller = CXCallController()
    @Published private(set) var activeCall: IncomingCall?
    private var callController: CallController?

    override init() {
        let cfg = CXProviderConfiguration()
        cfg.supportsVideo = false
        cfg.maximumCallGroups = 1
        cfg.maximumCallsPerCallGroup = 1
        cfg.supportedHandleTypes = [.generic]
        cfg.includesCallsInRecents = true
        cfg.iconTemplateImageData = nil
        self.provider = CXProvider(configuration: cfg)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    /// Called from PKPushRegistry on every VoIP push. Must report immediately.
    func reportIncomingCall(_ call: IncomingCall, completion: @escaping () -> Void) {
        let update = CXCallUpdate()
        update.localizedCallerName = "OpenQnt AI"
        update.remoteHandle = CXHandle(type: .generic, value: "openqnt:\(call.callId)")
        update.hasVideo = false
        provider.reportNewIncomingCall(with: call.id, update: update) { error in
            if let error = error {
                NSLog("reportNewIncomingCall failed: \(error)")
            } else {
                self.activeCall = call
            }
            completion()
        }
    }

    /// Called when we *must* report a call to satisfy iOS's invariant but the
    /// payload was malformed (e.g. coming back online with stale tokens).
    func reportSyntheticCall(reason: String) {
        let id = UUID()
        let update = CXCallUpdate()
        update.localizedCallerName = "OpenQnt AI"
        update.remoteHandle = CXHandle(type: .generic, value: "openqnt:invalid")
        provider.reportNewIncomingCall(with: id, update: update) { _ in
            self.provider.reportCall(with: id, endedAt: Date(), reason: .failed)
        }
    }

    func endActiveCall() {
        guard let call = activeCall else { return }
        let action = CXEndCallAction(call: call.id)
        controller.requestTransaction(with: action, completion: { _ in })
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        callController?.tearDown()
        callController = nil
        activeCall = nil
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let call = activeCall, call.id == action.callUUID else {
            action.fail(); return
        }
        do {
            try configureAudioSession()
        } catch {
            NSLog("audio session config failed: \(error)")
        }
        let cc = CallController(call: call)
        callController = cc
        Task {
            do {
                try await cc.start()
                action.fulfill()
            } catch {
                NSLog("call start failed: \(error)")
                action.fail()
            }
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        callController?.tearDown()
        callController = nil
        activeCall = nil
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        callController?.setMuted(action.isMuted)
        action.fulfill()
    }

    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        callController?.audioSessionDidActivate(audioSession)
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        callController?.audioSessionDidDeactivate(audioSession)
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
        try session.setPreferredSampleRate(16000)
        try session.setPreferredIOBufferDuration(0.02)
    }
}
