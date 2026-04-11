import SwiftUI
import NeurOSAppCore
import NeurOSDesktopFeatures
import NeurOSDesktopServices

@main
struct NeurOSDesktopApp: App {
    @State private var appModel = AppModel()
    private let coordinator = DesktopBootstrapCoordinator(services: .live)

    var body: some Scene {
        WindowGroup {
            RootSplitView(appModel: appModel, coordinator: coordinator)
                .frame(minWidth: 1200, minHeight: 760)
        }
        .defaultSize(width: 1440, height: 900)

        Settings {
            SettingsView(appModel: appModel, coordinator: coordinator)
                .frame(minWidth: 860, minHeight: 780)
        }

        MenuBarExtra("neurOS", systemImage: "waveform.path.ecg.rectangle") {
            VStack(alignment: .leading, spacing: 12) {
                Text(appModel.identity.productName)
                    .font(.headline)
                Text(appModel.connectionState.label)
                    .foregroundStyle(.secondary)
                Divider()
                Button("Abrir Central Operacional") {
                    appModel.selectedSection = .operations
                }
                Button("Abrir Configurações") {
                    appModel.selectedSection = .settings
                }
            }
            .padding()
            .frame(width: 260)
        }
    }
}
