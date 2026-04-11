import Foundation
import NeurOSAppCore

private struct HealthDTO: Decodable, Sendable {
    let status: String
    let version: String
    let deploymentMode: String?
    let deploymentExposure: String?
}

private struct DashboardDTO: Decodable, Sendable {
    struct Agents: Decodable, Sendable { let active: Int; let running: Int; let paused: Int; let error: Int }
    struct Tasks: Decodable, Sendable { let open: Int; let inProgress: Int; let blocked: Int; let done: Int }
    struct Costs: Decodable, Sendable { let monthSpendCents: Int; let monthBudgetCents: Int; let monthUtilizationPercent: Double }
    struct Budgets: Decodable, Sendable { let activeIncidents: Int; let pausedProjects: Int }

    let agents: Agents
    let tasks: Tasks
    let costs: Costs
    let pendingApprovals: Int
    let budgets: Budgets
}

private struct CompanyStatsDTO: Decodable, Sendable {
    let agentCount: Int
    let issueCount: Int
}

private struct CompanyDTO: Decodable, Sendable {
    let id: String
    let name: String
    let status: String
}

private struct ApprovalDTO: Decodable, Sendable {
    let id: String
    let type: String
    let status: String
    let payload: [String: JSONValue]
    let createdAt: Date
}

private struct AgentDTO: Decodable, Sendable {
    let id: String
    let name: String
    let role: String
    let status: String
    let spentMonthlyCents: Int
}

private struct IssueDTO: Decodable, Sendable {
    let id: String
    let title: String
    let status: String
    let priority: String
    let identifier: String?
    let assigneeAgentId: String?
    let updatedAt: Date
}

private struct ProjectDTO: Decodable, Sendable {
    let id: String
    let name: String
    let status: String
    let goalIds: [String]
    let workspaces: [ProjectWorkspaceDTO]
    let targetDate: String?
}

private struct ProjectWorkspaceDTO: Decodable, Sendable {
    let id: String
}

private struct PluginDTO: Decodable, Sendable {
    struct ManifestDTO: Decodable, Sendable {
        let name: String?
        let displayName: String?
    }

    let id: String
    let pluginKey: String
    let packageName: String
    let version: String
    let status: String
    let manifestJson: ManifestDTO?
}

private actor PaperclipAPIClient {
    private let configuration: ServerConnectionConfiguration
    private let session: URLSession

    init(configuration: ServerConnectionConfiguration) {
        self.configuration = configuration
        self.session = .shared
    }

    func health() async throws -> HealthDTO {
        try await get("health")
    }

    func companies() async throws -> [CompanyDTO] {
        try await get("companies")
    }

    func companyStats() async throws -> [String: CompanyStatsDTO] {
        try await get("companies/stats")
    }

    func dashboard(companyId: String) async throws -> DashboardDTO {
        try await get("companies/\(companyId)/dashboard")
    }

    func approvals(companyId: String) async throws -> [ApprovalDTO] {
        try await get("companies/\(companyId)/approvals?status=pending")
    }

    func agents(companyId: String) async throws -> [AgentDTO] {
        try await get("companies/\(companyId)/agents")
    }

    func issues(companyId: String) async throws -> [IssueDTO] {
        try await get("companies/\(companyId)/issues")
    }

    func projects(companyId: String) async throws -> [ProjectDTO] {
        try await get("companies/\(companyId)/projects")
    }

    func plugins() async throws -> [PluginDTO] {
        try await get("plugins")
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let baseURL = configuration.apiBaseURL else {
            throw URLError(.badURL)
        }

        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appending(path: normalizedPath)
        let (data, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw NSError(
                domain: "io.goldneuron.neurOS.network",
                code: httpResponse.statusCode,
                userInfo: [NSLocalizedDescriptionKey: "Resposta HTTP \(httpResponse.statusCode) em \(url.absoluteString)"]
            )
        }

        return try Self.decoder.decode(T.self, from: data)
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            if let date = PaperclipAPIClient.parseISO8601Date(value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO-8601 date: \(value)")
        }
        return decoder
    }()

    private static func parseISO8601Date(_ value: String) -> Date? {
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }

        let formatter = ISO8601DateFormatter()
        return formatter.date(from: value)
    }
}

public actor PaperclipDesktopService: OperationsSnapshotProviding, ConnectionStateProviding {
    public init() {}

    public func currentConnectionState(configuration: ServerConnectionConfiguration) async -> ConnectionState {
        guard let apiBaseURL = configuration.apiBaseURL else {
            return .degraded(message: "URL da instância inválida.")
        }

        let client = PaperclipAPIClient(configuration: configuration)
        do {
            _ = try await client.health()
            let host = apiBaseURL.host ?? configuration.trimmedBaseURLString
            let localHosts = ["127.0.0.1", "localhost", "::1"]
            return localHosts.contains(host) ? .local(nodeName: host) : .remote(hostname: host)
        } catch {
            return .degraded(message: error.localizedDescription)
        }
    }

    public func loadSnapshot(
        configuration: ServerConnectionConfiguration,
        selectedCompanyID: String?
    ) async throws -> OperationsSnapshot {
        let client = PaperclipAPIClient(configuration: configuration)
        async let healthTask = client.health()
        async let pluginsTask = client.plugins()
        async let companiesTask = client.companies()
        async let statsTask = client.companyStats()

        let companies = try await companiesTask
        let stats = try await statsTask
        let selectedID = selectedCompanyID ?? companies.first?.id

        guard let selectedID else {
            let plugins = try await pluginsTask
            let health = try await healthTask
            return OperationsSnapshot(
                companies: [],
                selectedCompanyID: nil,
                dashboard: nil,
                approvals: [],
                signals: [],
                agents: [],
                issues: [],
                projects: [],
                plugins: plugins.map(Self.mapPlugin),
                health: Self.mapHealth(health)
            )
        }

        async let dashboardTask = client.dashboard(companyId: selectedID)
        async let approvalsTask = client.approvals(companyId: selectedID)
        async let agentsTask = client.agents(companyId: selectedID)
        async let issuesTask = client.issues(companyId: selectedID)
        async let projectsTask = client.projects(companyId: selectedID)

        let dashboard = try await dashboardTask
        let approvals = try await approvalsTask
        let agents = try await agentsTask
        let issues = try await issuesTask
        let projects = try await projectsTask
        let health = try await healthTask
        let plugins = try await pluginsTask

        let mappedCompanies = companies.map { company in
            let counts = stats[company.id]
            return CompanySummary(
                id: company.id,
                name: company.name,
                status: company.status,
                projectsCount: company.id == selectedID ? projects.count : 0,
                activeIssuesCount: counts?.issueCount ?? 0,
                activeAgentsCount: counts?.agentCount ?? 0,
                recentSignalsCount: company.id == selectedID ? max(dashboard.pendingApprovals, dashboard.budgets.activeIncidents) : 0
            )
        }

        let agentSummaries = agents.map { agent in
            let activeIssue = issues.first(where: {
                $0.assigneeAgentId == agent.id && ["done", "cancelled"].contains($0.status) == false
            })
            return AgentRuntimeSummary(
                id: agent.id,
                name: agent.name,
                role: agent.role,
                stateLabel: agent.status,
                issueLabel: activeIssue?.identifier ?? activeIssue?.title ?? "Sem issue ativa",
                budgetLabel: Self.formatCurrency(cents: agent.spentMonthlyCents)
            )
        }

        let signals = Self.buildSignals(health: health, dashboard: dashboard, approvals: approvals, issueCount: issues.count)

        return OperationsSnapshot(
            companies: mappedCompanies,
            selectedCompanyID: selectedID,
            dashboard: DashboardSummary(
                openTasks: dashboard.tasks.open,
                inProgressTasks: dashboard.tasks.inProgress,
                blockedTasks: dashboard.tasks.blocked,
                doneTasks: dashboard.tasks.done,
                activeAgents: dashboard.agents.active,
                runningAgents: dashboard.agents.running,
                pausedAgents: dashboard.agents.paused,
                erroredAgents: dashboard.agents.error,
                pendingApprovals: dashboard.pendingApprovals,
                monthSpendCents: dashboard.costs.monthSpendCents,
                monthBudgetCents: dashboard.costs.monthBudgetCents,
                monthUtilizationPercent: dashboard.costs.monthUtilizationPercent,
                activeBudgetIncidents: dashboard.budgets.activeIncidents,
                pausedProjects: dashboard.budgets.pausedProjects
            ),
            approvals: approvals.map(Self.mapApproval),
            signals: signals,
            agents: agentSummaries,
            issues: issues
                .filter { ["done", "cancelled"].contains($0.status) == false }
                .sorted(by: { $0.updatedAt > $1.updatedAt })
                .prefix(24)
                .map(Self.mapIssue),
            projects: projects.map(Self.mapProject),
            plugins: plugins.map(Self.mapPlugin),
            health: Self.mapHealth(health)
        )
    }

    private static func mapHealth(_ dto: HealthDTO) -> ServerHealthSummary {
        ServerHealthSummary(
            status: dto.status,
            version: dto.version,
            deploymentMode: dto.deploymentMode,
            deploymentExposure: dto.deploymentExposure
        )
    }

    private static func mapApproval(_ dto: ApprovalDTO) -> ApprovalSummary {
        let owner = dto.payload["agentName"]?.stringValue
            ?? dto.payload["name"]?.stringValue
            ?? dto.payload["role"]?.stringValue
            ?? "Board"
        let priority = dto.payload["priority"]?.stringValue ?? dto.type.replacingOccurrences(of: "_", with: " ")
        return ApprovalSummary(
            id: dto.id,
            title: dto.payload["title"]?.stringValue ?? dto.payload["name"]?.stringValue ?? dto.type.replacingOccurrences(of: "_", with: " "),
            owner: owner,
            priorityLabel: priority.capitalized
        )
    }

    private static func mapIssue(_ dto: IssueDTO) -> IssueQueueSummary {
        IssueQueueSummary(
            id: dto.id,
            identifier: dto.identifier ?? dto.id,
            title: dto.title,
            status: dto.status,
            priority: dto.priority,
            assigneeLabel: "Em fila operacional",
            updatedAt: dto.updatedAt
        )
    }

    private static func mapProject(_ dto: ProjectDTO) -> ProjectSummary {
        ProjectSummary(
            id: dto.id,
            name: dto.name,
            status: dto.status,
            workspaceCount: dto.workspaces.count,
            goalCount: dto.goalIds.count,
            targetDateLabel: dto.targetDate ?? "Sem data"
        )
    }

    private static func mapPlugin(_ dto: PluginDTO) -> PluginSummary {
        PluginSummary(
            id: dto.id,
            displayName: dto.manifestJson?.displayName ?? dto.manifestJson?.name ?? dto.pluginKey,
            packageName: dto.packageName,
            version: dto.version,
            status: dto.status
        )
    }

    private static func buildSignals(
        health: HealthDTO,
        dashboard: DashboardDTO,
        approvals: [ApprovalDTO],
        issueCount: Int
    ) -> [OperationsSignal] {
        var signals = [
            OperationsSignal(
                title: "Servidor \(health.status)",
                detail: "Versão \(health.version) em modo \(health.deploymentMode ?? "unknown")/\(health.deploymentExposure ?? "unknown").",
                occurredAt: .now
            ),
            OperationsSignal(
                title: "Fila operacional",
                detail: "\(issueCount) issues abertas, \(dashboard.tasks.inProgress) em andamento e \(dashboard.tasks.blocked) bloqueadas.",
                occurredAt: .now
            ),
        ]

        if dashboard.budgets.activeIncidents > 0 {
            signals.append(
                OperationsSignal(
                    title: "Budget requer atenção",
                    detail: "\(dashboard.budgets.activeIncidents) incidentes ativos de orçamento no momento.",
                    occurredAt: .now
                )
            )
        }

        if approvals.isEmpty == false {
            signals.append(
                OperationsSignal(
                    title: "Aprovações pendentes",
                    detail: "\(approvals.count) decisões aguardando o board.",
                    occurredAt: .now
                )
            )
        }

        return signals
    }

    private static func formatCurrency(cents: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "BRL"
        formatter.locale = Locale(identifier: "pt_BR")
        let value = NSNumber(value: Double(cents) / 100.0)
        return formatter.string(from: value) ?? "R$ 0,00"
    }
}

private enum JSONValue: Decodable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    var stringValue: String? {
        switch self {
        case let .string(value): value
        case let .number(value): String(value)
        case let .bool(value): value ? "true" : "false"
        default: nil
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }
}
