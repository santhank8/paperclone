import Foundation

public enum NavigationSection: String, CaseIterable, Identifiable, Sendable {
    case operations
    case inbox
    case activity
    case queue
    case agents
    case projects
    case approvals
    case runtime
    case plugins
    case organization
    case settings

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .operations: "Central Operacional"
        case .inbox: "Inbox"
        case .activity: "Atividade"
        case .queue: "Fila e Issues"
        case .agents: "Agentes"
        case .projects: "Projetos e Workspaces"
        case .approvals: "Aprovações"
        case .runtime: "Runtime e Sinais"
        case .plugins: "Plugins"
        case .organization: "Empresa e Equipe"
        case .settings: "Configurações"
        }
    }
}
