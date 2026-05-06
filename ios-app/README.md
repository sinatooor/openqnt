# OpenQnt iOS

A barebones iOS app whose only job is: receive a VoIP push from the OpenQnt
backend, present a CallKit incoming-call screen, then open a WebRTC connection
to the backend's Gemini Live bridge.

## Requirements

- Xcode 15+ (project targets iOS 16+ for SwiftUI niceties; Swift 5.9)
- Apple Developer Program membership ($99/yr)
- A real iOS device — VoIP push **cannot** be tested in the Simulator
- A `.p8` APNs auth key with the **VoIP Services** capability enabled
  - Save the file path in the backend env `APNS_AUTH_KEY_PATH`
  - Set `APNS_KEY_ID` (10-char Apple key ID), `APNS_TEAM_ID`, and `APNS_VOIP_TOPIC=<bundle-id>.voip`

## Project layout

```
OpenQnt/
  OpenQnt.xcodeproj         # add the four targets in Xcode UI:
                            #   - OpenQnt (SwiftUI app)
                            #   - capabilities: Push Notifications, Background Modes (voip, audio, remote-notification),
                            #     Microphone, Background Audio
  OpenQnt/
    OpenQntApp.swift        # @main entry; registers PushKit + CallKit on launch
    AppDelegate.swift       # PKPushRegistryDelegate
    Settings.swift          # backend URL + pairing flow (UserDefaults)
    CallManager.swift       # CXProvider + CXCallController bridge
    CallController.swift    # WebRTC RTCPeerConnection + audio session
    SignalingClient.swift   # WebSocket to backend /api/voice/ios-signal
    Models/
      IncomingCall.swift
    UI/
      InCallView.swift      # SwiftUI in-call surface (transcript + mute + hangup)
      SettingsView.swift    # paste backend URL + pairing token
Info.plist                  # NSMicrophoneUsageDescription + UIBackgroundModes
OpenQnt.entitlements        # aps-environment, voip background mode, audio
```

## Bring-up steps

1. Open `OpenQnt.xcodeproj` in Xcode.
2. Set the team / bundle identifier under Signing.
3. In Capabilities, add: Push Notifications, Background Modes (Voice over IP +
   Audio, AirPlay, and Picture in Picture + Remote notifications), Microphone.
4. Add the [stasel/WebRTC](https://github.com/stasel/WebRTC) Swift Package via
   File → Add Packages → enter `https://github.com/stasel/WebRTC`. (Apple's
   official WebRTC build, repackaged as an SPM-friendly XCFramework.)
5. Build & run on a real device. Open the app, paste your backend URL and a
   pairing token from the OpenQnt web profile.
6. From the OpenQnt web app or chat agent, trigger an `ios_webrtc` call —
   the device should ring with a CallKit screen.

## What the source files in `OpenQnt/` do

The Swift files included here are the production starting point — small,
well-commented, and easy to extend. They are wired so a fresh Xcode project
can use them as-is once the targets/capabilities are configured.

The `WebRTC` import is from the stasel/WebRTC SPM package; replace if you
prefer a different build, but match the API surface used in
`CallController.swift`.
