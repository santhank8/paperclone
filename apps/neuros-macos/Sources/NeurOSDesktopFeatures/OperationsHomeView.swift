import SwiftUI
import NeurOSAppCore
import NeurOSDesktopServices

public struct OperationsHomeView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SectionHeroView(
                    title: "Central Operacional",
                    subtitle: "Resumo executivo da instância conectada, com foco na empresa ativa, orçamento, fila operacional e sinais de runtime."
                ) {
                    Button {
                        Task { await coordinator.refresh(appModel: appModel) }
                    } label: {
                        Label("Atualizar", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }

                OperationsHeroView(appModel: appModel)
                ConnectionHealthView(appModel: appModel, coordinator: coordinator)
                DashboardMetricsGrid(appModel: appModel)

                HStack(alignment: .top, spacing: 20) {
                    RuntimeSummaryView(appModel: appModel)
                    ApprovalsQueueView(appModel: appModel)
                }

                HStack(alignment: .top, spacing: 20) {
                    QueuePreviewView(appModel: appModel)
                    ProjectsPreviewView(appModel: appModel)
                }

                ActiveAgentsView(appModel: appModel)
            }
            .padding(28)
        }
        .navigationTitle("Central Operacional")
    }
}

private struct ConnectionHealthView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    var body: some View {
        SurfaceCard {
            Text("Operação híbrida")
                .font(.headline)

            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(appModel.connectionState.label)
                        .font(.title3.weight(.semibold))
                    Text(appModel.statusMessage ?? "A instância macOS acompanha a API real do Paperclip e pode alternar entre topologia local e remota.")
                        .foregroundStyle(.secondary)
                    if let health = appModel.health {
                        Text("Servidor \(health.status) em \(health.deploymentMode ?? "unknown")/\(health.deploymentExposure ?? "unknown")")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 6) {
                    Text(appModel.selectedCompanyName)
                        .font(.headline)
                    Text(appModel.selectedCompanyStatus.uppercased())
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(statusColor(for: appModel.selectedCompanyStatus))
                }
            }

            HStack {
                Label("Modo \(appModel.runtimeMode.rawValue)", systemImage: "network")
                    .foregroundStyle(.secondary)
                Spacer()
                if appModel.serverConfiguration.canManageLocalServer {
                    Button("Iniciar backend") {
                        Task { await coordinator.startLocalServer(appModel: appModel) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(appModel.localServerStatus.phase == .running || appModel.localServerStatus.phase == .starting)

                    Button("Reiniciar backend") {
                        Task { await coordinator.restartLocalServer(appModel: appModel) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(appModel.localServerStatus.isManagedProcess == false)
                }
                Button("Assumir coordenação") {
                    Task { await coordinator.promoteCurrentMac(appModel: appModel) }
                }
                .buttonStyle(.bordered)
            }

            if appModel.serverConfiguration.canManageLocalServer {
                Divider()
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Backend local: \(appModel.localServerStatus.label)")
                            .font(.subheadline.weight(.medium))
                        Text(appModel.localServerStatus.detail)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let pid = appModel.localServerStatus.pid {
                        Text("PID \(pid)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
    }
}
