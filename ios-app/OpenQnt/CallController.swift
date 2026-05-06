import Foundation
import AVFoundation
import WebRTC      // stasel/WebRTC SPM package

/// Drives one WebRTC call: spins up an RTCPeerConnection, opens a WebSocket
/// to the backend `/api/voice/ios-stream`, and pumps audio in both directions.
///
/// Signaling is "no-op" for the v1 path: the backend simply expects PCM16
/// frames. We use WebRTC's RTCAudioTrack only for capture/playback; the
/// actual transport is the WebSocket. (We can swap to true WebRTC over
/// SCTP/STUN/TURN in v1.1 without changing the app's UX.)
final class CallController {
    private let call: IncomingCall
    private let factory: RTCPeerConnectionFactory
    private var ws: URLSessionWebSocketTask?
    private var peer: RTCPeerConnection?
    private var localTrack: RTCAudioTrack?
    private var muted = false
    private var capture: AudioCapture?
    private var player: AudioPlayer?

    init(call: IncomingCall) {
        self.call = call
        RTCInitializeSSL()
        let encoderFactory = RTCDefaultVideoEncoderFactory()
        let decoderFactory = RTCDefaultVideoDecoderFactory()
        self.factory = RTCPeerConnectionFactory(
            encoderFactory: encoderFactory, decoderFactory: decoderFactory
        )
    }

    func start() async throws {
        guard let url = URL(string: call.wsUrl) else {
            throw NSError(domain: "OpenQnt", code: 10, userInfo: [NSLocalizedDescriptionKey: "Bad WS url"])
        }

        // We use AVAudioEngine for capture/playback (PCM16 LE 16/24 kHz)
        // and stream over WebSocket. For v1.1, replace this with a true
        // WebRTC peer connection negotiated via /api/voice/ios-signal.
        let session = URLSession(configuration: .default)
        let task = session.webSocketTask(with: url)
        ws = task
        task.resume()

        let player = AudioPlayer()
        try player.start()
        self.player = player

        let capture = AudioCapture { [weak self] pcm in
            guard let self = self, !self.muted else { return }
            let msg = URLSessionWebSocketTask.Message.data(pcm)
            self.ws?.send(msg) { error in
                if let error = error { NSLog("ws send error: \(error)") }
            }
        }
        try capture.start()
        self.capture = capture

        Task { await self.pumpInbound() }
    }

    private func pumpInbound() async {
        guard let ws = ws else { return }
        while ws.closeCode == .invalid {  // .invalid means still open in URLSession
            do {
                let msg = try await ws.receive()
                switch msg {
                case .data(let pcm):
                    player?.enqueue(pcm)
                case .string:
                    continue
                @unknown default:
                    continue
                }
            } catch {
                NSLog("ws receive error: \(error)")
                break
            }
        }
    }

    func setMuted(_ value: Bool) { muted = value }

    func audioSessionDidActivate(_ session: AVAudioSession) {
        // Hook for AVAudioEngine resume if needed
    }
    func audioSessionDidDeactivate(_ session: AVAudioSession) {
        // Hook for cleanup if needed
    }

    func tearDown() {
        capture?.stop(); capture = nil
        player?.stop(); player = nil
        ws?.cancel(with: .normalClosure, reason: nil); ws = nil
        peer?.close(); peer = nil
        RTCCleanupSSL()
    }
}

// MARK: - Capture (mic → PCM16 16 kHz binary frames)

private final class AudioCapture {
    private let engine = AVAudioEngine()
    private let onFrame: (Data) -> Void
    init(onFrame: @escaping (Data) -> Void) { self.onFrame = onFrame }

    func start() throws {
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                         sampleRate: 16000,
                                         channels: 1,
                                         interleaved: true)!
        let converter = AVAudioConverter(from: inputFormat, to: targetFormat)!
        let frameLen: AVAudioFrameCount = 1024
        input.installTap(onBus: 0, bufferSize: frameLen, format: inputFormat) { [weak self] buffer, _ in
            guard let self = self else { return }
            let outBuffer = AVAudioPCMBuffer(
                pcmFormat: targetFormat,
                frameCapacity: AVAudioFrameCount(targetFormat.sampleRate * 0.1)
            )!
            var error: NSError?
            let status = converter.convert(to: outBuffer, error: &error) { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            if status == .haveData, let data = outBuffer.int16ChannelData {
                let frames = Int(outBuffer.frameLength)
                let bytes = frames * MemoryLayout<Int16>.size
                let blob = Data(bytes: data[0], count: bytes)
                self.onFrame(blob)
            }
        }
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }
}

// MARK: - Player (PCM16 24 kHz binary frames → speaker)

private final class AudioPlayer {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                          sampleRate: 24000,
                                          channels: 1,
                                          interleaved: true)!

    func start() throws {
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: outFormat)
        engine.prepare()
        try engine.start()
        player.play()
    }

    func enqueue(_ pcm: Data) {
        let frames = AVAudioFrameCount(pcm.count / MemoryLayout<Int16>.size)
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: frames) else { return }
        buffer.frameLength = frames
        pcm.withUnsafeBytes { raw in
            let src = raw.bindMemory(to: Int16.self)
            buffer.int16ChannelData!.pointee.update(from: src.baseAddress!, count: Int(frames))
        }
        player.scheduleBuffer(buffer, completionHandler: nil)
    }

    func stop() {
        player.stop()
        engine.stop()
    }
}
