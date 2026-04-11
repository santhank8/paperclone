import SwiftUI
import NeurOSAppCore
import NeurOSDesktopServices

public struct InboxSectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Inbox",
            subtitle: "Caixa de entrada operacional com aprovações, issues recentes e sinais que exigem triagem rápida.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Itens", value: "\(workItems.count)", accent: .blue)
            MetricTile(title: "Aprovações", value: "\(appModel.approvals.count)", accent: .yellow)
            MetricTile(title: "Issues críticas", value: "\(criticalIssuesCount)", accent: .red)
            MetricTile(title: "Sinais", value: "\(appModel.signals.count)", accent: .cyan)
        } content: {
            HStack(alignment: .top, spacing: 20) {
                SurfaceCard {
                    Text("Fila priorizada")
                        .font(.headline)

                    if workItems.isEmpty {
                        EmptyCollectionState(message: "Nenhum item entrou na caixa de entrada operacional.")
                    } else {
                        ForEach(workItems.prefix(12)) { item in
                            InboxWorkItemRow(item: item)
                        }
                    }
                }

                SurfaceCard {
                    Text("Resumo de triagem")
                        .font(.headline)

                    SummaryRow(
                        title: "Empresa ativa",
                        detail: appModel.selectedCompanyName,
                        trailing: appModel.selectedCompanyStatus.uppercased()
                    )
                    SummaryRow(
                        title: "Última sincronização",
                        detail: appModel.lastRefreshedAt?.formatted(date: .abbreviated, time: .shortened) ?? "Nunca",
                        trailing: appModel.connectionState.label
                    )
                    SummaryRow(
                        title: "Issues recentes",
                        detail: "\(appModel.issues.count) issues carregadas",
                        trailing: "\(criticalIssuesCount) críticas"
                    )
                    SummaryRow(
                        title: "Decisões humanas",
                        detail: "\(appModel.approvals.count) aprovações pendentes",
                        trailing: "\(highPriorityApprovalsCount) altas"
                    )
                    SummaryRow(
                        title: "Saúde operacional",
                        detail: appModel.health?.status ?? "unknown",
                        trailing: "\(appModel.signals.count) sinais"
                    )

                    if let statusMessage = appModel.statusMessage, statusMessage.isEmpty == false {
                        Divider()
                        Text(statusMessage)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var workItems: [InboxWorkItem] {
        let approvalItems = appModel.approvals.map(InboxWorkItem.approval)
        let issueItems = appModel.issues.map(InboxWorkItem.issue)
        let signalItems = appModel.signals.map(InboxWorkItem.signal)
        return (approvalItems + issueItems + signalItems).sorted(by: { $0.timestamp > $1.timestamp })
    }

    private var criticalIssuesCount: Int {
        appModel.issues.filter { $0.priority.lowercased() == "critical" }.count
    }

    private var highPriorityApprovalsCount: Int {
        appModel.approvals.filter { approval in
            let value = approval.priorityLabel.lowercased()
            return value == "alta" || value == "high" || value == "critical"
        }.count
    }
}

public struct ActivitySectionView: View {
    let appModel: AppModel
    let coordinator: DesktopBootstrapCoordinator

    public init(appModel: AppModel, coordinator: DesktopBootstrapCoordinator) {
        self.appModel = appModel
        self.coordinator = coordinator
    }

    public var body: some View {
        OperationalSectionScaffold(
            title: "Atividade",
            subtitle: "Linha do tempo dos eventos recentes retornados pela API de activity da empresa ativa.",
            coordinator: coordinator,
            appModel: appModel
        ) {
            MetricTile(title: "Eventos", value: "\(appModel.activity.count)", accent: .blue)
            MetricTile(title: "Issues", value: "\(eventCount(for: "issue"))", accent: .orange)
            MetricTile(title: "Aprovações", value: "\(eventCount(for: "approval"))", accent: .yellow)
            MetricTile(title: "System", value: "\(systemEventsCount)", accent: .mint)
        } content: {
            SurfaceCard {
                Text("Timeline recente")
                    .font(.headline)

                if appModel.activity.isEmpty {
                    EmptyCollectionState(message: "Nenhum evento recente retornado para a empresa ativa.")
                } else {
                    ForEach(appModel.activity) { event in
                        ActivityTimelineRow(event: event)
                    }
                }
            }
        }
    }

    private func eventCount(for entityType: String) -> Int {
        appModel.activity.filter { $0.entityType.lowercased() == entityType }.count
    }

    private var systemEventsCount: Int {
        appModel.activity.filter { $0.actorLabel.lowercased() == "system" }.count
    }
}

private enum InboxWorkItem: Identifiable {
    case approval(ApprovalSummary)
    case issue(IssueQueueSummary)
    case signal(OperationsSignal)

    var id: String {
        switch self {
        case let .approval(approval):
            "approval:\(approval.id)"
        case let .issue(issue):
            "issue:\(issue.id)"
        case let .signal(signal):
            "signal:\(signal.id)"
        }
    }

    var timestamp: Date {
        switch self {
        case let .approval(approval):
            approval.createdAt
        case let .issue(issue):
            issue.updatedAt
        case let .signal(signal):
            signal.occurredAt
        }
    }
}

private struct InboxWorkItemRow: View {
    let item: InboxWorkItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            StatusPill(label: item.kindLabel, color: item.kindColor)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                Text(item.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(item.timestamp.formatted(date: .abbreviated, time: .shortened))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 6)
    }
}

private extension InboxWorkItem {
    var kindLabel: String {
        switch self {
        case .approval:
            "Aprovação"
        case .issue:
            "Issue"
        case .signal:
            "Sinal"
        }
    }

    var kindColor: Color {
        switch self {
        case .approval:
            .yellow
        case let .issue(issue):
            issue.priority.lowercased() == "critical" ? .red : .blue
        case .signal:
            .cyan
        }
    }

    var title: String {
        switch self {
        case let .approval(approval):
            approval.title
        case let .issue(issue):
            "\(issue.identifier) · \(issue.title)"
        case let .signal(signal):
            signal.title
        }
    }

    var detail: String {
        switch self {
        case let .approval(approval):
            "\(approval.owner) · prioridade \(approval.priorityLabel)"
        case let .issue(issue):
            "\(issue.assigneeLabel) · \(issue.status.uppercased())"
        case let .signal(signal):
            signal.detail
        }
    }
}

private struct ActivityTimelineRow: View {
    let event: ActivityFeedEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(statusColor(for: event.entityType))
                .frame(width: 10, height: 10)
                .padding(.top, 7)

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(event.title)
                        .font(.subheadline.weight(.semibold))
                    Text(event.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }

                Text("\(event.actorLabel) · \(event.entityLabel)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if let detailSummary = event.detailSummary, detailSummary.isEmpty == false {
                    Text(detailSummary)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(3)
                }
            }
            Spacer()
            StatusPill(label: event.entityType, color: statusColor(for: event.entityType))
        }
        .padding(.vertical, 6)
    }
}
