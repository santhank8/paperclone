import SwiftUI
import NeurOSAppCore
import NeurOSDesktopServices

struct SurfaceCard<Content: View>: View {
    private let alignment: HorizontalAlignment
    private let content: Content

    init(
        alignment: HorizontalAlignment = .leading,
        @ViewBuilder content: () -> Content
    ) {
        self.alignment = alignment
        self.content = content()
    }

    var body: some View {
        VStack(alignment: alignment, spacing: 14) {
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22))
    }
}

struct SectionHeroView<Actions: View>: View {
    let title: String
    let subtitle: String
    private let actions: Actions

    init(
        title: String,
        subtitle: String,
        @ViewBuilder actions: () -> Actions
    ) {
        self.title = title
        self.subtitle = subtitle
        self.actions = actions()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 20) {
            VStack(alignment: .leading, spacing: 10) {
                Text(title)
                    .font(.largeTitle.weight(.bold))
                Text(subtitle)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            actions
        }
    }
}

struct DashboardMetricsGrid: View {
    let appModel: AppModel
    private let columns = [GridItem(.adaptive(minimum: 180), spacing: 16)]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            MetricTile(title: "Tarefas abertas", value: "\(appModel.dashboard?.openTasks ?? appModel.totalActiveIssues)", accent: .blue)
            MetricTile(title: "Em andamento", value: "\(appModel.dashboard?.inProgressTasks ?? 0)", accent: .cyan)
            MetricTile(title: "Bloqueadas", value: "\(appModel.dashboard?.blockedTasks ?? 0)", accent: .orange)
            MetricTile(title: "Aprovações", value: "\(appModel.dashboard?.pendingApprovals ?? appModel.approvals.count)", accent: .yellow)
            MetricTile(title: "Agentes ativos", value: "\(appModel.dashboard?.activeAgents ?? appModel.totalActiveAgents)", accent: .green)
            MetricTile(title: "Budget do mês", value: formatCurrency(appModel.dashboard?.monthSpendCents ?? 0), accent: .mint)
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.weight(.bold))
            RoundedRectangle(cornerRadius: 999)
                .fill(accent.opacity(0.8))
                .frame(width: 48, height: 5)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct OperationsHeroView: View {
    let appModel: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(appModel.selectedCompanyName)
                        .font(.title.weight(.bold))
                    Text("Status \(appModel.selectedCompanyStatus.uppercased())")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(statusColor(for: appModel.selectedCompanyStatus))
                }
                Spacer()
                if let health = appModel.health {
                    VStack(alignment: .trailing, spacing: 6) {
                        Text("API \(health.version)")
                            .font(.headline)
                        Text(health.status.uppercased())
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(statusColor(for: health.status))
                    }
                }
            }

            HStack(spacing: 16) {
                heroMetric("Empresas", value: "\(appModel.companies.count)")
                heroMetric("Issues", value: "\(appModel.totalActiveIssues)")
                heroMetric("Agentes", value: "\(appModel.totalActiveAgents)")
                heroMetric("Sinais", value: "\(appModel.totalRecentSignals)")
            }
        }
        .padding(24)
        .background(
            LinearGradient(
                colors: [Color.blue.opacity(0.20), Color.cyan.opacity(0.12), Color.mint.opacity(0.10)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 26)
        )
    }

    private func heroMetric(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title2.weight(.bold))
            Text(title)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct RuntimeSummaryView: View {
    let appModel: AppModel

    var body: some View {
        SurfaceCard {
            Text("Sinais e runtime")
                .font(.headline)

            if appModel.signals.isEmpty {
                EmptyCollectionState(message: "Nenhum sinal recente emitido pela instância.")
            } else {
                ForEach(appModel.signals.prefix(4)) { signal in
                    SummaryRow(
                        title: signal.title,
                        detail: signal.detail,
                        trailing: signal.occurredAt.formatted(date: .abbreviated, time: .shortened)
                    )
                }
            }
        }
    }
}

struct ApprovalsQueueView: View {
    let appModel: AppModel

    var body: some View {
        SurfaceCard {
            Text("Aprovações pendentes")
                .font(.headline)

            if appModel.approvals.isEmpty {
                EmptyCollectionState(message: "Não existem decisões pendentes para o board.")
            } else {
                ForEach(appModel.approvals.prefix(4)) { approval in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(approval.title)
                                .font(.subheadline.weight(.semibold))
                            Text(approval.owner)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(approval.priorityLabel)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(priorityColor(for: approval.priorityLabel).opacity(0.14), in: Capsule())
                    }
                }
            }
        }
    }
}

struct QueuePreviewView: View {
    let appModel: AppModel

    var body: some View {
        SurfaceCard {
            Text("Fila de issues")
                .font(.headline)

            if appModel.issues.isEmpty {
                EmptyCollectionState(message: "Nenhuma issue ativa para a empresa selecionada.")
            } else {
                ForEach(appModel.issues.prefix(5)) { issue in
                    SummaryRow(
                        title: "\(issue.identifier) · \(issue.title)",
                        detail: "Responsável: \(issue.assigneeLabel)",
                        trailing: issue.status.uppercased()
                    )
                }
            }
        }
    }
}

struct ProjectsPreviewView: View {
    let appModel: AppModel

    var body: some View {
        SurfaceCard {
            Text("Projetos em foco")
                .font(.headline)

            if appModel.projects.isEmpty {
                EmptyCollectionState(message: "Nenhum projeto carregado para esta empresa.")
            } else {
                ForEach(appModel.projects.prefix(4)) { project in
                    SummaryRow(
                        title: project.name,
                        detail: "\(project.workspaceCount) workspaces · \(project.goalCount) goals",
                        trailing: project.status.uppercased()
                    )
                }
            }
        }
    }
}

struct ActiveAgentsView: View {
    let appModel: AppModel

    var body: some View {
        SurfaceCard {
            Text("Agentes ativos")
                .font(.headline)

            if appModel.agents.isEmpty {
                EmptyCollectionState(message: "Nenhum agente retornado pelo backend.")
            } else {
                ForEach(appModel.agents) { agent in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(agent.name)
                                .font(.subheadline.weight(.semibold))
                            Text(agent.role)
                                .foregroundStyle(.secondary)
                            Text(agent.issueLabel)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(agent.stateLabel)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(statusColor(for: agent.stateLabel))
                            Text(agent.budgetLabel)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
    }
}

public struct QueueSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Fila e Issues",
            subtitle: "Monitoramento das issues abertas, prioridades e distribuição operacional.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Issues ativas", value: "\(appModel.issues.count)", accent: .blue)
            MetricTile(title: "Críticas", value: "\(appModel.issues.filter { $0.priority == "critical" }.count)", accent: .red)
            MetricTile(title: "Alta prioridade", value: "\(appModel.issues.filter { $0.priority == "high" }.count)", accent: .orange)
            MetricTile(title: "Em revisão", value: "\(appModel.issues.filter { $0.status.contains("review") }.count)", accent: .yellow)
        } content: {
            SurfaceCard {
                Text("Issues abertas")
                    .font(.headline)
                if appModel.issues.isEmpty {
                    EmptyCollectionState(message: "Nenhuma issue ativa encontrada.")
                } else {
                    ForEach(appModel.issues) { issue in
                        SummaryRow(
                            title: "\(issue.identifier) · \(issue.title)",
                            detail: "\(issue.assigneeLabel) · prioridade \(issue.priority)",
                            trailing: issue.updatedAt.formatted(date: .abbreviated, time: .shortened)
                        )
                    }
                }
            }
        }
    }
}

public struct AgentsSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Agentes",
            subtitle: "Estado, papel, alocação e consumo operacional dos agentes da empresa selecionada.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Ativos", value: "\(appModel.dashboard?.activeAgents ?? appModel.agents.count)", accent: .green)
            MetricTile(title: "Executando", value: "\(appModel.dashboard?.runningAgents ?? 0)", accent: .cyan)
            MetricTile(title: "Pausados", value: "\(appModel.dashboard?.pausedAgents ?? 0)", accent: .orange)
            MetricTile(title: "Erros", value: "\(appModel.dashboard?.erroredAgents ?? 0)", accent: .red)
        } content: {
            ActiveAgentsView(appModel: appModel)
        }
    }
}

public struct ProjectsSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Projetos e Workspaces",
            subtitle: "Portfólio de projetos da empresa, com visibilidade de metas, workspaces e prazos.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Projetos", value: "\(appModel.projects.count)", accent: .blue)
            MetricTile(title: "Workspaces", value: "\(appModel.projects.reduce(0) { $0 + $1.workspaceCount })", accent: .mint)
            MetricTile(title: "Goals", value: "\(appModel.projects.reduce(0) { $0 + $1.goalCount })", accent: .cyan)
            MetricTile(title: "Pausados", value: "\(appModel.dashboard?.pausedProjects ?? 0)", accent: .orange)
        } content: {
            ProjectsPreviewView(appModel: appModel)
        }
    }
}

public struct ApprovalsSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Aprovações",
            subtitle: "Itens que dependem de decisão humana ou de validação do board.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Pendentes", value: "\(appModel.approvals.count)", accent: .yellow)
            MetricTile(title: "Sinais ativos", value: "\(appModel.signals.count)", accent: .blue)
        } content: {
            ApprovalsQueueView(appModel: appModel)
        }
    }
}

public struct RuntimeSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Runtime e Sinais",
            subtitle: "Saúde da instância, topologia de execução e eventos recentes emitidos pelo backend.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Modo", value: appModel.runtimeMode.rawValue, accent: .blue)
            MetricTile(title: "Status API", value: appModel.health?.status ?? "unknown", accent: statusColor(for: appModel.health?.status ?? "unknown"))
            MetricTile(title: "Budget incidents", value: "\(appModel.dashboard?.activeBudgetIncidents ?? 0)", accent: .orange)
        } content: {
            VStack(alignment: .leading, spacing: 20) {
                SurfaceCard {
                    Text("Saúde da instância")
                        .font(.headline)
                    if let health = appModel.health {
                        SummaryRow(title: "Versão", detail: health.version, trailing: health.status.uppercased())
                        SummaryRow(title: "Modo", detail: health.deploymentMode ?? "unknown", trailing: health.deploymentExposure ?? "unknown")
                    } else {
                        EmptyCollectionState(message: "A instância ainda não respondeu ao health check.")
                    }
                }
                RuntimeSummaryView(appModel: appModel)
            }
        }
    }
}

public struct PluginsSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Plugins",
            subtitle: "Pacotes carregados pela instância para estender adapters, UI e automações.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Instalados", value: "\(appModel.plugins.count)", accent: .purple)
            MetricTile(title: "Prontos", value: "\(appModel.plugins.filter { $0.status == "ready" }.count)", accent: .green)
        } content: {
            SurfaceCard {
                Text("Plugins carregados")
                    .font(.headline)
                if appModel.plugins.isEmpty {
                    EmptyCollectionState(message: "Nenhum plugin instalado foi retornado pela API.")
                } else {
                    ForEach(appModel.plugins) { plugin in
                        SummaryRow(
                            title: plugin.displayName,
                            detail: "\(plugin.packageName) · \(plugin.version)",
                            trailing: plugin.status.uppercased()
                        )
                    }
                }
            }
        }
    }
}

public struct OrganizationSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Empresa e Equipe",
            subtitle: "Contexto organizacional da instância, com foco na empresa selecionada e na distribuição operacional.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Empresas", value: "\(appModel.companies.count)", accent: .blue)
            MetricTile(title: "Agentes", value: "\(appModel.totalActiveAgents)", accent: .green)
            MetricTile(title: "Issues", value: "\(appModel.totalActiveIssues)", accent: .orange)
        } content: {
            VStack(alignment: .leading, spacing: 20) {
                SurfaceCard {
                    Text("Empresa ativa")
                        .font(.headline)
                    SummaryRow(
                        title: appModel.selectedCompanyName,
                        detail: "Status \(appModel.selectedCompanyStatus)",
                        trailing: "\(appModel.dashboard?.pendingApprovals ?? appModel.approvals.count) aprovações"
                    )
                    if let selectedCompany = appModel.selectedCompany {
                        SummaryRow(
                            title: "Capacidade",
                            detail: "\(selectedCompany.activeAgentsCount) agentes · \(selectedCompany.activeIssuesCount) issues",
                            trailing: "\(selectedCompany.recentSignalsCount) sinais"
                        )
                    }
                }

                SurfaceCard {
                    Text("Todas as empresas")
                        .font(.headline)
                    if appModel.companies.isEmpty {
                        EmptyCollectionState(message: "A instância não possui empresas disponíveis.")
                    } else {
                        ForEach(appModel.companies) { company in
                            SummaryRow(
                                title: company.name,
                                detail: "\(company.activeAgentsCount) agentes · \(company.activeIssuesCount) issues",
                                trailing: company.status.uppercased()
                            )
                        }
                    }
                }
            }
        }
    }
}

private struct OperationalSectionScaffold<Metrics: View, Content: View>: View {
    let title: String
    let subtitle: String
    private let metrics: Metrics
    let coordinator: DesktopBootstrapCoordinator
    let appModel: AppModel
    private let content: Content

    init(
        title: String,
        subtitle: String,
        coordinator: DesktopBootstrapCoordinator,
        appModel: AppModel,
        @ViewBuilder metrics: () -> Metrics,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.coordinator = coordinator
        self.appModel = appModel
        self.metrics = metrics()
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SectionHeroView(title: title, subtitle: subtitle) {
                    Button {
                        Task { await coordinator.refresh(appModel: appModel) }
                    } label: {
                        Label("Atualizar", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 16)], spacing: 16) {
                    metrics
                }

                content
            }
            .padding(28)
        }
        .navigationTitle(title)
    }
}

private struct SummaryRow: View {
    let title: String
    let detail: String
    let trailing: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(trailing)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 6)
    }
}

private struct EmptyCollectionState: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 12)
    }
}

func statusColor(for value: String) -> Color {
    switch value.lowercased() {
    case "ok", "ready", "active", "running", "pronta", "monitorando": .green
    case "in_progress", "executando", "connecting": .blue
    case "paused", "pending", "in_review", "planned": .orange
    case "error", "unhealthy", "degraded", "critical", "blocked": .red
    default: .secondary
    }
}

private func priorityColor(for value: String) -> Color {
    switch value.lowercased() {
    case "critical", "alta", "high": .red
    case "média", "medium": .orange
    case "low", "baixa": .yellow
    default: .secondary
    }
}

func formatCurrency(_ cents: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "BRL"
    formatter.locale = Locale(identifier: "pt_BR")
    let value = NSNumber(value: Double(cents) / 100.0)
    return formatter.string(from: value) ?? "R$ 0,00"
}
