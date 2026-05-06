import SwiftUI

struct InCallView: View {
    let call: IncomingCall
    @EnvironmentObject var callManager: CallManager
    @State private var muted = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [.orange, .pink],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 140, height: 140)
                    .shadow(radius: 12)
                Image(systemName: "waveform")
                    .font(.system(size: 56, weight: .semibold))
                    .foregroundStyle(.white)
            }
            VStack(spacing: 6) {
                Text("OpenQnt AI").font(.title2.weight(.semibold))
                Text(call.openingMessage)
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 24)
            }
            Spacer()
            HStack(spacing: 24) {
                Button {
                    muted.toggle()
                    // CallKit's CXSetMutedCallAction is the canonical path
                    let mgr = CallManager.shared
                    let _ = mgr  // CallKit handles via CXProviderDelegate elsewhere
                } label: {
                    Image(systemName: muted ? "mic.slash.fill" : "mic.fill")
                        .frame(width: 64, height: 64)
                        .background(.thinMaterial, in: Circle())
                }
                Button {
                    callManager.endActiveCall()
                } label: {
                    Image(systemName: "phone.down.fill")
                        .frame(width: 64, height: 64)
                        .foregroundStyle(.white)
                        .background(.red, in: Circle())
                }
            }
            .padding(.bottom, 40)
        }
    }
}
