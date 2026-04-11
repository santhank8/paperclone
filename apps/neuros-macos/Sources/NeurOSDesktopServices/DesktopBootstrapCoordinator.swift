import Foundation
import NeurOSAppCore

@MainActor
public final class DesktopBootstrapCoordinator {
    private let services: DesktopServices

    public init(services: DesktopServices) {
        self.services = services
    }

    public func start(appModel: AppModel) async {
        appModel.isBootstrapping = true
        let configuration = await services.configurationStore.load()
        appModel.serverConfiguration = configuration
        appModel.runtimeMode = configuration.runtimeMode
        await services.notifications.requestAuthorizationIfNeeded()

        let peers = await services.localNetwork.discoverPeers()
        if peers.isEmpty == false {
            appModel.statusMessage = "Rede local pronta com \(peers.count) nós detectados."
        }

        await refresh(appModel: appModel)
    }

    public func refresh(appModel: AppModel) async {
        let connectionState = await services.connection.currentConnectionState(configuration: appModel.serverConfiguration)
        await applySnapshot(appModel: appModel, connectionState: connectionState)
    }

    public func updateServerConfiguration(
        _ configuration: ServerConnectionConfiguration,
        appModel: AppModel
    ) async {
        await services.configurationStore.save(configuration)
        appModel.serverConfiguration = configuration
        appModel.runtimeMode = configuration.runtimeMode
        appModel.connectionState = .connecting
        await refresh(appModel: appModel)
    }

    public func setLaunchAtLogin(_ enabled: Bool, appModel: AppModel) async {
        do {
            try await services.loginItem.setEnabled(enabled)
            appModel.launchAtLoginEnabled = enabled
        } catch {
            appModel.statusMessage = "Não foi possível atualizar abertura automática."
        }
    }

    public func promoteCurrentMac(appModel: AppModel) async {
        do {
            appModel.connectionState = .connecting
            appModel.connectionState = try await services.primaryNode.promoteCurrentMac()
            appModel.statusMessage = "Este Mac assumiu a coordenação da rede local."
        } catch {
            appModel.connectionState = .degraded(message: "Promoção manual falhou.")
            appModel.statusMessage = error.localizedDescription
        }
    }

    private func applySnapshot(appModel: AppModel, connectionState: ConnectionState) async {
        do {
            let snapshot = try await services.operations.loadSnapshot(
                configuration: appModel.serverConfiguration,
                selectedCompanyID: appModel.selectedCompanyID
            )
            appModel.apply(snapshot: snapshot, connectionState: connectionState)
            if snapshot.companies.isEmpty {
                appModel.statusMessage = "Nenhuma empresa encontrada nessa instância."
            }
        } catch {
            appModel.connectionState = .degraded(message: "Falha ao carregar a operação inicial.")
            appModel.isBootstrapping = false
            appModel.statusMessage = error.localizedDescription
        }
    }
}
