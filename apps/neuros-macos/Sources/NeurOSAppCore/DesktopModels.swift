import Foundation

public enum RuntimeMode: String, Codable, CaseIterable, Sendable {
    case hybrid
    case local
    case remote
}

public enum ConnectionState: Sendable, Equatable {
    case disconnected
    case connecting
    case local(nodeName: String)
    case remote(hostname: String)
    case degraded(message: String)

    public var label: String {
        switch self {
        case .disconnected: "Desconectado"
        case .connecting: "Conectando"
        case let .local(nodeName): "Local em \(nodeName)"
        case let .remote(hostname): "Remoto em \(hostname)"
        case .degraded: "Requer atenção"
        }
    }

    public var isConnected: Bool {
        switch self {
        case .local, .remote:
            true
        case .disconnected, .connecting, .degraded:
            false
        }
    }

    public var isLocalConnection: Bool {
        if case .local = self {
            return true
        }
        return false
    }
}

public struct CompanySummary: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var status: String
    public var projectsCount: Int
    public var activeIssuesCount: Int
    public var activeAgentsCount: Int
    public var recentSignalsCount: Int

    public init(
        id: String,
        name: String,
        status: String = "active",
        projectsCount: Int,
        activeIssuesCount: Int,
        activeAgentsCount: Int,
        recentSignalsCount: Int
    ) {
        self.id = id
        self.name = name
        self.status = status
        self.projectsCount = projectsCount
        self.activeIssuesCount = activeIssuesCount
        self.activeAgentsCount = activeAgentsCount
        self.recentSignalsCount = recentSignalsCount
    }
}

public struct OperationsSignal: Identifiable, Hashable, Sendable {
    public let id: String
    public var title: String
    public var detail: String
    public var occurredAt: Date

    public init(id: String = UUID().uuidString, title: String, detail: String, occurredAt: Date) {
        self.id = id
        self.title = title
        self.detail = detail
        self.occurredAt = occurredAt
    }
}

public struct ApprovalSummary: Identifiable, Hashable, Sendable {
    public let id: String
    public var title: String
    public var owner: String
    public var priorityLabel: String
    public var createdAt: Date

    public init(
        id: String = UUID().uuidString,
        title: String,
        owner: String,
        priorityLabel: String,
        createdAt: Date
    ) {
        self.id = id
        self.title = title
        self.owner = owner
        self.priorityLabel = priorityLabel
        self.createdAt = createdAt
    }
}

public struct AgentRuntimeSummary: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var role: String
    public var stateLabel: String
    public var issueLabel: String
    public var budgetLabel: String

    public init(
        id: String,
        name: String,
        role: String,
        stateLabel: String,
        issueLabel: String,
        budgetLabel: String
    ) {
        self.id = id
        self.name = name
        self.role = role
        self.stateLabel = stateLabel
        self.issueLabel = issueLabel
        self.budgetLabel = budgetLabel
    }
}

public struct ActivityFeedEntry: Identifiable, Hashable, Sendable {
    public let id: String
    public var title: String
    public var actorLabel: String
    public var entityLabel: String
    public var detailSummary: String?
    public var action: String
    public var entityType: String
    public var createdAt: Date

    public init(
        id: String,
        title: String,
        actorLabel: String,
        entityLabel: String,
        detailSummary: String?,
        action: String,
        entityType: String,
        createdAt: Date
    ) {
        self.id = id
        self.title = title
        self.actorLabel = actorLabel
        self.entityLabel = entityLabel
        self.detailSummary = detailSummary
        self.action = action
        self.entityType = entityType
        self.createdAt = createdAt
    }
}
