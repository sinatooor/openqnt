import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var auth: AuthStore
    @Environment(\.dismiss) var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirm = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Your name") {
                    TextField("Name", text: $name)
                }
                Section("Login") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField("Password (8+ chars)", text: $password)
                    SecureField("Confirm password", text: $confirm)
                }
                if let err = auth.lastError {
                    Section { Text(err).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Create account")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sign up") {
                        Task {
                            await auth.signUp(email: email, password: password, name: name.isEmpty ? nil : name)
                            if auth.isAuthed { dismiss() }
                        }
                    }
                    .disabled(!canSubmit || auth.isWorking)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var canSubmit: Bool {
        !email.isEmpty && password.count >= 8 && password == confirm
    }
}
