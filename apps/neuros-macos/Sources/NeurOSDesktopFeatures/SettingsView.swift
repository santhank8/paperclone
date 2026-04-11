import SwiftUI
import NeurOSAppCore
import NeurOSDesktopServices

public struct SettingsView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    @State private var draftBaseURL: String
    @State private var draftRuntimeMode: RuntimeMode

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
        _draftBaseURL = State(initialValue: appModel.serverConfiguration.baseURLString)
        _draftRuntimeMode = State(initialValue: appModel.serverConfiguration.runtimeMode)
    }

    public var body: some View {
        Form {
            Section("Aplicação") {
                LabeledContent("Produto", value: appModel.identity.productName)
                LabeledContent("Versão", value: appModel.identity.version)
                LabeledContent("Bundle", value: appModel.identity.bundleIdentifier)
            }

            Section("Conectividade") {
                TextField("http://127.0.0.1:3100", text: $draftBaseURL)
                    .textFieldStyle(.roundedBorder)
                Picker("Runtime preferido", selection: $draftRuntimeMode) {
                    Text("Híbrido").tag(RuntimeMode.hybrid)
                    Text("Local").tag(RuntimeMode.local)
                    Text("Remoto").tag(RuntimeMode.remote)
                }

                LabeledContent("API normalizada", value: normalizedAPIValue)
                LabeledContent("Estado atual", value: appModel.connectionState.label)

                HStack {
                    Button("Salvar e reconectar") {
                        Task { await saveConfiguration() }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Atualizar agora") {
                        Task { await coordinator.refresh(appModel: appModel) }
                    }
                    .buttonStyle(.bordered)
                }
            }

            Section("Desktop") {
                Toggle("Abrir ao iniciar sessão", isOn: Binding(
                    get: { appModel.launchAtLoginEnabled },
                    set: { enabled in
                        Task { await coordinator.setLaunchAtLogin(enabled, appModel: appModel) }
                    }
                ))
                Toggle("Notificações operacionais", isOn: Binding(
                    get: { appModel.notificationsEnabled },
                    set: { appModel.notificationsEnabled = $0 }
                ))
            }

            Section("Diagnóstico") {
                if let health = appModel.health {
                    LabeledContent("Servidor", value: health.status)
                    LabeledContent("Deployment", value: "\(health.deploymentMode ?? "unknown") / \(health.deploymentExposure ?? "unknown")")
                } else {
                    Text("Sem resposta de health check no momento.")
                        .foregroundStyle(.secondary)
                }

                if let statusMessage = appModel.statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Configurações")
        .padding(28)
    }

    private var normalizedAPIValue: String {
        ServerConnectionConfiguration(
            baseURLString: draftBaseURL,
            runtimeMode: draftRuntimeMode
        ).apiBaseURL?.absoluteString ?? "URL inválida"
    }

    private func saveConfiguration() async {
        await coordinator.updateServerConfiguration(
            ServerConnectionConfiguration(
                baseURLString: draftBaseURL,
                runtimeMode: draftRuntimeMode
            ),
            appModel: appModel
        )
    }
}
