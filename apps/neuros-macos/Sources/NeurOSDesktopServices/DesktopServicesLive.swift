import Foundation
import NeurOSAppCore

public actor PreviewOperationsSnapshotProvider: OperationsSnapshotProviding {
    public init() {}

    public func loadSnapshot(
        configuration: ServerConnectionConfiguration,
        selectedCompanyID: String?
    ) async throws -> OperationsSnapshot {
        _ = configuration
        _ = selectedCompanyID
        return OperationsSnapshot(
            companies: [
                CompanySummary(
                    id: "goldneuron-ops",
                    name: "GoldNeuron Ops",
                    status: "active",
                    projectsCount: 4,
                    activeIssuesCount: 52,
                    activeAgentsCount: 6,
                    recentSignalsCount: 2
                ),
                CompanySummary(
                    id: "agency-studio",
                    name: "Agency Studio",
                    status: "active",
                    projectsCount: 3,
                    activeIssuesCount: 17,
                    activeAgentsCount: 4,
                    recentSignalsCount: 1
                ),
            ],
            selectedCompanyID: "goldneuron-ops",
            dashboard: DashboardSummary(
                openTasks: 52,
                inProgressTasks: 18,
                blockedTasks: 4,
                doneTasks: 113,
                activeAgents: 6,
                runningAgents: 3,
                pausedAgents: 1,
                erroredAgents: 0,
                pendingApprovals: 2,
                monthSpendCents: 43850,
                monthBudgetCents: 120000,
                monthUtilizationPercent: 36.5,
                activeBudgetIncidents: 1,
                pausedProjects: 1
            ),
            approvals: [
                ApprovalSummary(id: "approval-1", title: "Aprovar novo squad criativo", owner: "COO Agent", priorityLabel: "Alta"),
                ApprovalSummary(id: "approval-2", title: "Liberar budget semanal", owner: "Finance Ops", priorityLabel: "Média"),
            ],
            signals: [
                OperationsSignal(title: "Runtime retomado", detail: "Todos os workers reconectados na rede local.", occurredAt: .now),
                OperationsSignal(title: "Webhook em atraso", detail: "Intake criativo aguardando revisão há 9 min.", occurredAt: .now),
            ],
            agents: [
                AgentRuntimeSummary(id: "agent-1", name: "Clara", role: "COO Agent", stateLabel: "Pronta", issueLabel: "#52 Aprovações", budgetLabel: "R$ 120,00"),
                AgentRuntimeSummary(id: "agent-2", name: "Nina", role: "Creative Lead", stateLabel: "Executando", issueLabel: "#48 Campanha", budgetLabel: "R$ 98,00"),
                AgentRuntimeSummary(id: "agent-3", name: "Kai", role: "Ops Engineer", stateLabel: "Monitorando", issueLabel: "#31 Runtime", budgetLabel: "R$ 82,00"),
            ],
            issues: [
                IssueQueueSummary(id: "issue-1", identifier: "GN-52", title: "Revisar fila de aprovações", status: "in_review", priority: "high", assigneeLabel: "Clara", updatedAt: .now),
                IssueQueueSummary(id: "issue-2", identifier: "GN-48", title: "Subir campanha da semana", status: "in_progress", priority: "critical", assigneeLabel: "Nina", updatedAt: .now),
            ],
            projects: [
                ProjectSummary(id: "project-1", name: "Growth Engine", status: "in_progress", workspaceCount: 2, goalCount: 1, targetDateLabel: "2026-04-18"),
                ProjectSummary(id: "project-2", name: "Ops Reliability", status: "planned", workspaceCount: 1, goalCount: 2, targetDateLabel: "Sem data"),
            ],
            plugins: [
                PluginSummary(id: "plugin-1", displayName: "Central Operações", packageName: "@paperclip/central-operacoes", version: "0.8.3", status: "ready"),
            ],
            health: ServerHealthSummary(
                status: "ok",
                version: "0.3.1",
                deploymentMode: "local_trusted",
                deploymentExposure: "private"
            )
        )
    }
}

public actor HybridConnectionStateProvider: ConnectionStateProviding {
    public init() {}

    public func currentConnectionState(configuration: ServerConnectionConfiguration) async -> ConnectionState {
        _ = configuration
        return .local(nodeName: Host.current().localizedName ?? "neurOS node")
    }
}

public actor StubLoginItemController: LoginItemControlling {
    public init() {}

    public func setEnabled(_ isEnabled: Bool) async throws {
        _ = isEnabled
    }
}

public actor StubNotificationsAuthorizer: NotificationsAuthorizing {
    public init() {}

    public func requestAuthorizationIfNeeded() async {}
}

public actor BonjourDiscoveryService: LocalNetworkDiscovering {
    public init() {}

    public func discoverPeers() async -> [String] {
        ["creative-mac.local", "ops-base.local"]
    }
}

public actor ManualPrimaryNodePromoter: PrimaryNodePromoting {
    public init() {}

    public func promoteCurrentMac() async throws -> ConnectionState {
        .local(nodeName: Host.current().localizedName ?? "neurOS node")
    }
}

public actor PreviewDesktopConfigurationStore: DesktopConfigurationStoring {
    public init() {}

    public func load() async -> ServerConnectionConfiguration { .default }

    public func save(_ configuration: ServerConnectionConfiguration) async {
        _ = configuration
    }
}

public extension DesktopServices {
    static let live: DesktopServices = {
        let paperclip = PaperclipDesktopService()
        return DesktopServices(
            operations: paperclip,
            connection: paperclip,
            configurationStore: UserDefaultsDesktopConfigurationStore(),
            loginItem: StubLoginItemController(),
            notifications: StubNotificationsAuthorizer(),
            localNetwork: BonjourDiscoveryService(),
            primaryNode: ManualPrimaryNodePromoter()
        )
    }()

    static let preview = DesktopServices(
        operations: PreviewOperationsSnapshotProvider(),
        connection: HybridConnectionStateProvider(),
        configurationStore: PreviewDesktopConfigurationStore(),
        loginItem: StubLoginItemController(),
        notifications: StubNotificationsAuthorizer(),
        localNetwork: BonjourDiscoveryService(),
        primaryNode: ManualPrimaryNodePromoter()
    )
}
