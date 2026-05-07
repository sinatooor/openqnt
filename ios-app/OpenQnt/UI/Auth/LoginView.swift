import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    @EnvironmentObject var settings: Settings

    @State private var email = ""
    @State private var password = ""
    @State private var showRegister = false
    @State private var showBackendEditor = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 4) {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(.tint)
                    Text("OpenQnt")
                        .font(.title.bold())
                    Text("Sign in to continue")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 40)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .padding()
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10))

                    Button {
                        Task { await auth.signIn(email: email, password: password) }
                    } label: {
                        if auth.isWorking {
                            ProgressView().tint(.white)
                        } else {
                            Text("Sign in").font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(.tint, in: RoundedRectangle(cornerRadius: 10))
                    .foregroundStyle(.white)
                    .disabled(email.isEmpty || password.isEmpty || auth.isWorking)

                    Button("Create an account") { showRegister = true }
                        .font(.subheadline)
                }

                if let err = auth.lastError {
                    Text(err)
                        .font(.callout)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                VStack(spacing: 4) {
                    Text("Backend")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button {
                        showBackendEditor = true
                    } label: {
                        Text(settings.backendURL)
                            .font(.caption.monospaced())
                            .foregroundStyle(.tint)
                    }
                }
                .padding(.bottom, 16)
            }
            .padding()
            .sheet(isPresented: $showRegister) {
                RegisterView()
                    .environmentObject(auth)
            }
            .sheet(isPresented: $showBackendEditor) {
                NavigationStack {
                    Form {
                        Section("Backend URL") {
                            TextField("https://…", text: $settings.backendURL)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }
                        Section {
                            Button("Test connection") {
                                Task {
                                    let ok = await AuthClient.health()
                                    auth.lastError = ok ? nil : "Could not reach \(settings.backendURL)"
                                }
                            }
                        }
                    }
                    .navigationTitle("Backend URL")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showBackendEditor = false }
                        }
                    }
                }
            }
        }
    }
}
