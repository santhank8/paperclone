import { cn } from "../lib/utils";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

const statusLabels: Record<string, string> = {
  active: "活跃",
  paused: "已暂停",
  idle: "空闲",
  running: "运行中",
  error: "错误",
  pending_approval: "待审批",
  terminated: "已终止",
  archived: "已归档",
  backlog: "待规划",
  todo: "待办",
  in_progress: "进行中",
  in_review: "审核中",
  done: "已完成",
  blocked: "已阻塞",
  cancelled: "已取消",
  planned: "已规划",
  achieved: "已达成",
  completed: "已完成",
  pending: "待处理",
  revision_requested: "需修订",
  approved: "已批准",
  rejected: "已拒绝",
  suspended: "已暂停",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {statusLabels[status] ?? status.replace("_", " ")}
    </span>
  );
}
